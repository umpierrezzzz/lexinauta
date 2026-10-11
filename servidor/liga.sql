-- Ligas semanales de Lexinauta (Supabase / PostgreSQL).
--
-- Cómo instalarlo: en Supabase, SQL Editor → New query → pega este archivo entero → Run.
-- Se puede volver a ejecutar sin perder datos (crea lo que falte y reemplaza las funciones).
--
-- Funcionamiento:
--  · Cada jugador es anónimo: un alias y un «secreto» (uuid) que solo conoce su navegador.
--  · Solo cuentan las misiones diarias: una por jugador y día, 0-595 puntos, con la fecha de hoy.
--  · Las ligas son semanales (de lunes a domingo, hora UTC) en grupos de hasta 30 jugadores
--    de la misma división. Al empezar la semana siguiente, los primeros suben y los últimos bajan.
--  · Las tablas no son accesibles desde fuera: todo pasa por las funciones liga_registrar,
--    liga_enviar y liga_estado, que validan lo que reciben.

create table if not exists liga_jugadores (
  id bigint generated always as identity primary key,
  secreto uuid not null unique,
  alias text not null check (char_length(alias) between 1 and 16),
  modelo text not null default 'clasico',
  division smallint not null default 0,
  cambio smallint not null default 0,          -- +1 subió, -1 bajó, 0 igual (al empezar la semana actual)
  creado timestamptz not null default now()
);

create table if not exists liga_partidas (
  jugador bigint not null references liga_jugadores on delete cascade,
  fecha date not null,
  puntos smallint not null check (puntos between 0 and 595),
  primary key (jugador, fecha)
);

create table if not exists liga_grupos (
  id bigint generated always as identity primary key,
  semana date not null,                        -- el lunes de la semana
  division smallint not null
);

create table if not exists liga_miembros (
  jugador bigint not null references liga_jugadores on delete cascade,
  semana date not null,
  grupo bigint not null references liga_grupos on delete cascade,
  primary key (jugador, semana)
);
create index if not exists liga_miembros_grupo on liga_miembros (grupo);

-- Nadie entra a las tablas directamente
alter table liga_jugadores enable row level security;
alter table liga_partidas enable row level security;
alter table liga_grupos enable row level security;
alter table liga_miembros enable row level security;

-- ---------------------------------------------------------------- reglas

create or replace function liga_tamano_zona(n int, sube boolean) returns int
language sql immutable as $$
  select case
    when sube then case when n >= 10 then 5 else greatest(1, n / 5) end   -- con pocos jugadores, al menos sube el primero
    else case when n >= 10 then 5 when n >= 5 then n / 5 else 0 end
  end
$$;

-- Clasificación de un grupo: puntos de la semana de cada miembro.
create or replace function liga_clasificacion(p_grupo bigint)
returns table (jugador bigint, alias text, modelo text, puntos int, dias int, posicion int)
language sql stable security definer set search_path = public as $$
  select j.id, j.alias, j.modelo, coalesce(sum(p.puntos), 0)::int, count(p.fecha)::int,
         row_number() over (order by coalesce(sum(p.puntos), 0) desc, max(p.fecha) asc nulls last, j.id)::int
  from liga_miembros m
  join liga_jugadores j on j.id = m.jugador
  left join liga_partidas p on p.jugador = j.id and p.fecha between m.semana and m.semana + 6
  where m.grupo = p_grupo
  group by j.id, j.alias, j.modelo
$$;

-- Mete al jugador en un grupo de la semana (aplicando antes el ascenso o descenso de su última liga).
create or replace function liga_asignar(p_jugador bigint, p_semana date) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_grupo bigint;
  v_prev record;
  v_pos int;
  v_n int;
  v_div smallint;
  v_cambio smallint := 0;
begin
  select grupo into v_grupo from liga_miembros where jugador = p_jugador and semana = p_semana;
  if found then return v_grupo; end if;

  select division into v_div from liga_jugadores where id = p_jugador for update;

  -- Resultado de la última liga jugada
  select m.grupo, m.semana into v_prev from liga_miembros m
   where m.jugador = p_jugador and m.semana < p_semana order by m.semana desc limit 1;
  if found then
    select count(*) into v_n from liga_miembros where grupo = v_prev.grupo;
    select c.posicion into v_pos from liga_clasificacion(v_prev.grupo) c where c.jugador = p_jugador;
    if v_pos <= liga_tamano_zona(v_n, true) and v_div < 5 then v_div := v_div + 1; v_cambio := 1;
    elsif v_pos > v_n - liga_tamano_zona(v_n, false) and v_div > 0 then v_div := v_div - 1; v_cambio := -1;
    end if;
  end if;
  update liga_jugadores set division = v_div, cambio = v_cambio where id = p_jugador;

  -- Un grupo con hueco de su división (el bloqueo evita que dos altas a la vez llenen de más un grupo)
  perform pg_advisory_xact_lock(hashtext('liga:' || p_semana || ':' || v_div));
  select g.id into v_grupo from liga_grupos g
   where g.semana = p_semana and g.division = v_div
     and (select count(*) from liga_miembros m where m.grupo = g.id) < 30
   order by g.id limit 1;
  if not found then
    insert into liga_grupos (semana, division) values (p_semana, v_div) returning id into v_grupo;
  end if;
  insert into liga_miembros (jugador, semana, grupo) values (p_jugador, p_semana, v_grupo);
  return v_grupo;
end $$;

-- ---------------------------------------------------------------- API pública

create or replace function liga_registrar(p_secreto uuid, p_alias text, p_modelo text default 'clasico') returns json
language plpgsql security definer set search_path = public as $$
declare
  v_alias text := left(btrim(coalesce(p_alias, '')), 16);
begin
  if v_alias = '' then v_alias := 'Lexinauta'; end if;
  insert into liga_jugadores (secreto, alias, modelo) values (p_secreto, v_alias, left(coalesce(p_modelo, 'clasico'), 20))
  on conflict (secreto) do update set alias = excluded.alias, modelo = excluded.modelo;
  return liga_estado(p_secreto);
end $$;

create or replace function liga_enviar(p_secreto uuid, p_fecha date, p_puntos int, p_modelo text default null) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_jugador bigint;
begin
  select id into v_jugador from liga_jugadores where secreto = p_secreto;
  if not found then raise exception 'jugador desconocido'; end if;
  -- La fecha del jugador (su día local) puede ir un día por delante o por detrás de la del servidor
  if p_fecha not between current_date - 1 and current_date + 1 then raise exception 'fecha fuera de plazo'; end if;
  if p_puntos not between 0 and 595 then raise exception 'puntos no válidos'; end if;
  if p_modelo is not null then update liga_jugadores set modelo = left(p_modelo, 20) where id = v_jugador; end if;
  insert into liga_partidas (jugador, fecha, puntos) values (v_jugador, p_fecha, p_puntos)
  on conflict (jugador, fecha) do nothing;                       -- la primera partida del día es la que vale
  perform liga_asignar(v_jugador, date_trunc('week', p_fecha)::date);
  return liga_estado(p_secreto);
end $$;

create or replace function liga_estado(p_secreto uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  v_j liga_jugadores;
  v_semana date := date_trunc('week', current_date)::date;
  v_grupo bigint;
  v_n int;
begin
  select * into v_j from liga_jugadores where secreto = p_secreto;
  if not found then return null; end if;
  select grupo into v_grupo from liga_miembros where jugador = v_j.id and semana = v_semana;
  if v_grupo is not null then select count(*) into v_n from liga_miembros where grupo = v_grupo; end if;
  return json_build_object(
    'alias', v_j.alias,
    'division', v_j.division,
    'cambio', v_j.cambio,
    'semana', v_semana,
    'fin', (v_semana + 7)::timestamp at time zone 'UTC',
    'ahora', now(),
    'sube', case when v_grupo is null then 0 else liga_tamano_zona(v_n, true) end,
    'baja', case when v_grupo is null then 0 else liga_tamano_zona(v_n, false) end,
    'grupo', case when v_grupo is null then null else (
      select json_agg(json_build_object('alias', c.alias, 'modelo', c.modelo, 'puntos', c.puntos, 'dias', c.dias,
                                        'posicion', c.posicion, 'yo', c.jugador = v_j.id) order by c.posicion)
      from liga_clasificacion(v_grupo) c) end
  );
end $$;

-- Permisos: solo las tres funciones públicas
revoke all on liga_jugadores, liga_partidas, liga_grupos, liga_miembros from anon, authenticated;
revoke execute on function liga_asignar(bigint, date), liga_clasificacion(bigint) from public, anon, authenticated;
grant execute on function liga_registrar(uuid, text, text), liga_enviar(uuid, date, int, text), liga_estado(uuid) to anon, authenticated;
