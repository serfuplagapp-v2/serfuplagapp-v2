-- =============================================================================
-- Serfuplagapp v2 — Migración 0008: geometría de la ruta del día
-- -----------------------------------------------------------------------------
-- La "ruta del día" ordena las visitas de un técnico/día por cercanía y, si se
-- usa la Routes API de Google, calcula el trazado real por calles. Para poder
-- REABRIR una ruta guardada sin recalcular, guardamos en `routes`:
--   · polyline     — trazado codificado (encoded polyline de Google) o NULL.
--   · distance_km  — distancia total estimada.
--   · duration_min — duración total estimada en minutos.
-- Aditivo y seguro: no afecta datos existentes.
-- =============================================================================
alter table public.routes
  add column if not exists polyline     text,
  add column if not exists distance_km  numeric(8,1),
  add column if not exists duration_min integer;
