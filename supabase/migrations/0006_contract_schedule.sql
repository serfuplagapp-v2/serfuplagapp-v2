-- =============================================================================
-- Serfuplagapp v2 — Migración 0006: detalle de periodicidad en contracts
-- -----------------------------------------------------------------------------
-- El contrato ya tiene `frequency` (cada cuánto). Para que el MOTOR de
-- generación de servicios (portado de la v1: core/periodicidades.js) sepa
-- EXACTAMENTE cuándo cae cada visita dentro del ciclo, se agregan:
--   · visit_mode    — id del modo de visita (primer_habil, dow_x, dia_mes, …)
--   · visit_params  — parámetros del modo ({n, dow, dia, dia1, dia2})
--   · allowed_days  — días permitidos (0=dom..6=sab); NULL = cualquier día hábil
--   · preferred_time — hora preferida de la visita
-- Aditivo y seguro: no afecta datos existentes.
-- =============================================================================
alter table public.contracts
  add column if not exists visit_mode     text,
  add column if not exists visit_params   jsonb not null default '{}'::jsonb,
  add column if not exists allowed_days    smallint[],
  add column if not exists preferred_time time;
