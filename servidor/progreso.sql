-- Progreso guardado en la nube para quien inicia sesión (con Google) en Lexinauta.
--
-- Cómo instalarlo: en Supabase, SQL Editor → New query → pega este archivo → Run.
-- Se puede volver a ejecutar sin perder datos.
--
-- Cada usuario tiene una fila con su progreso (historial de misiones, récords, cohete elegido,
-- nombre e identidad de la liga) en JSON. Solo él puede leerla y escribirla: la regla de seguridad
-- compara la fila con el usuario de la sesión (auth.uid()).

create table if not exists progreso (
  usuario uuid primary key references auth.users on delete cascade default auth.uid(),
  datos jsonb not null default '{}'::jsonb,
  actualizado timestamptz not null default now()
);

alter table progreso enable row level security;

drop policy if exists "cada uno su progreso" on progreso;
create policy "cada uno su progreso" on progreso
  for all to authenticated
  using (usuario = auth.uid())
  with check (usuario = auth.uid());

revoke all on progreso from anon;
grant select, insert, update on progreso to authenticated;

-- Límite de tamaño (un historial de años ocupa unas decenas de KB)
alter table progreso drop constraint if exists progreso_tamano;
alter table progreso add constraint progreso_tamano check (pg_column_size(datos) < 512000);
