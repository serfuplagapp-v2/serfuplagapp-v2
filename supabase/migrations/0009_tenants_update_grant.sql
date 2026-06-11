-- =============================================================================
-- Serfuplagapp v2 — Migración 0009: permitir editar los datos de la empresa
-- -----------------------------------------------------------------------------
-- La política RLS `tenants_update` (0001) ya restringe el UPDATE a owner/admin
-- de su propia empresa, pero faltaba el GRANT a nivel de privilegios: sin él,
-- el módulo Configuración no puede guardar nombre/RUT. Se otorga SOLO sobre
-- esas dos columnas (el plan u otros campos sensibles siguen bloqueados).
-- =============================================================================
grant update (name, rut) on public.tenants to authenticated;
