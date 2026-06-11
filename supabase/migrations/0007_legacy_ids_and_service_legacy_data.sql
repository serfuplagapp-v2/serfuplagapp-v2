-- =============================================================================
-- Serfuplagapp v2 — Migración 0007: enlaces heredados + data de certificados
-- -----------------------------------------------------------------------------
-- Para importar la historia de la v1 (órdenes de trabajo, programas) y NO perder
-- la información que alimenta los certificados (Fase 3):
--   · legacy_id  — id original de Firestore, para reconectar con la v1 y enlazar
--                  importaciones futuras sin crear huérfanos.
--   · services.legacy_data (jsonb) — toda la data de certificado/terreno que trae
--     cada orden (folio, plagas detectadas, productos usados, áreas tratadas,
--     firmante, observaciones, recomendaciones, metodología, unidades…). El folio
--     correlativo se preserva acá; la generación de certificados (Fase 3) lo usará.
-- Aditivo y seguro.
-- =============================================================================
alter table public.clients   add column if not exists legacy_id text;
alter table public.branches  add column if not exists legacy_id text;
alter table public.contracts add column if not exists legacy_id text;
alter table public.services  add column if not exists legacy_id text;
alter table public.services  add column if not exists legacy_data jsonb;

create index if not exists clients_legacy_idx   on public.clients(legacy_id)   where legacy_id is not null;
create index if not exists branches_legacy_idx  on public.branches(legacy_id)  where legacy_id is not null;
create index if not exists contracts_legacy_idx on public.contracts(legacy_id) where legacy_id is not null;
create index if not exists services_legacy_idx  on public.services(legacy_id)  where legacy_id is not null;
