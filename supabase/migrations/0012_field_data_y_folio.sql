-- =============================================================================
-- Serfuplagapp v2 — Migración 0012: captura de terreno + folio atómico
-- -----------------------------------------------------------------------------
-- · services.field_data (jsonb): el registro de terreno de OTs NUEVAS de la v2
--   (metodología, grado de infestación, insumos, áreas, plagas, productos
--   usados, trabajo realizado, observaciones, recomendaciones, firmante…).
--   Mismo esqueleto que legacy_data (que queda como artefacto de importación,
--   solo lectura). El certificado se alimenta de field_data ?? legacy_data.
-- · next_cert_folio(): entrega el siguiente folio correlativo de certificado y
--   avanza el contador EN UNA SOLA SENTENCIA (atómico: dos emisiones
--   simultáneas no pueden repetir folio). SECURITY INVOKER: la RLS de
--   tenant_settings limita el update a la propia empresa.
-- =============================================================================
alter table public.services
  add column if not exists field_data jsonb not null default '{}'::jsonb;

create or replace function public.next_cert_folio()
returns integer
language sql
security invoker
as $$
  update public.tenant_settings
     set cert_next_folio = cert_next_folio + 1
   where tenant_id = public.current_tenant_id()
   returning cert_next_folio - 1;
$$;

grant execute on function public.next_cert_folio() to authenticated;
revoke execute on function public.next_cert_folio() from anon;
