// Conexión con la liga online (Supabase). Rellénalo con los datos de tu proyecto:
// Supabase → botón «Connect» (o Project Settings → Data API / API Keys): la «Project URL» y la clave
// pública («Publishable key» sb_publishable_… o la antigua «anon public» eyJ…). Nunca la secret/service_role.
// La clave anon es pública por diseño: solo permite llamar a las funciones de servidor/liga.sql.
// Si se deja vacío, el juego funciona igual pero sin ligas.
export const LIGA = {
  url: "",
  clave: "",
};
