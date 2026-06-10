-- =============================================================================
-- Serfuplagapp v2 — Migración 0003: campo de Notas en sucursales
-- -----------------------------------------------------------------------------
-- Cada sucursal (heredada de una ficha de la v1) trae datos de su propio local
-- que hoy no tienen pantalla propia (frecuencia, días de visita, cartera,
-- dirección tributaria, rubro…). Para no perderlos en la importación, se guardan
-- en un campo de texto libre `notes` (decisión Carlos, jun 2026: "extras → Notas").
-- Aditivo y seguro: no afecta datos existentes.
-- =============================================================================
alter table public.branches add column if not exists notes text;
