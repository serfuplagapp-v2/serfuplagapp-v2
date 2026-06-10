-- =============================================================================
-- Serfuplagapp v2 — Datos iniciales (seed)
-- Ejecutar UNA vez, DESPUÉS de la migración 0001.
-- Es idempotente: correrlo dos veces no duplica nada.
-- =============================================================================

-- Crea la empresa Serfuplagas Ltda. (tenant #1).
-- Nota: el RUT se deja vacío a propósito; complétalo cuando quieras desde la app
-- o con un UPDATE, para no guardar un dato inventado.
insert into public.tenants (name, plan)
select 'Serfuplagas Ltda.', 'gratis'
where not exists (
  select 1 from public.tenants where name = 'Serfuplagas Ltda.'
);
