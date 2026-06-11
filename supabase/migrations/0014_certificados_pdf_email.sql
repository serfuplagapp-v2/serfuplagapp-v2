-- =============================================================================
-- Serfuplagapp v2 — Migración 0014: PDF del certificado + correo + verificación QR
-- -----------------------------------------------------------------------------
-- · certificates.verify_code: código único por certificado para la página
--   PÚBLICA de verificación (/verificar/{code}, enlazada desde el QR del PDF).
--   Es un uuid aleatorio: imposible de adivinar; NO expone el folio ni ids.
-- · certificates.sent_at / sent_to: registro del último envío por correo.
-- · Bucket privado `certificados`: el PDF generado de cada certificado.
--   Rutas {tenant_id}/{certificate_id}.pdf — la primera carpeta es el tenant
--   (mismo aislamiento por empresa que el bucket `terreno`, migración 0013).
-- · verify_certificate(p_code): función SECURITY DEFINER para que la página
--   pública (rol anon) consulte SOLO los campos seguros de UN certificado por
--   su código. No abre la tabla a anon: la RLS sigue igual.
-- =============================================================================

-- 1) Columnas nuevas en certificates -----------------------------------------
alter table public.certificates
  add column if not exists verify_code uuid not null default gen_random_uuid(),
  add column if not exists sent_at timestamptz,
  add column if not exists sent_to text;

create unique index if not exists certificates_verify_code_idx
  on public.certificates(verify_code);

-- 2) Bucket privado para los PDF ----------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('certificados', 'certificados', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

drop policy if exists certificados_select on storage.objects;
create policy certificados_select on storage.objects
  for select to authenticated
  using (bucket_id = 'certificados' and (storage.foldername(name))[1] = public.current_tenant_id()::text);

drop policy if exists certificados_insert on storage.objects;
create policy certificados_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'certificados' and (storage.foldername(name))[1] = public.current_tenant_id()::text);

-- UPDATE es necesario porque regenerar el PDF usa upsert (sobrescribe el archivo).
drop policy if exists certificados_update on storage.objects;
create policy certificados_update on storage.objects
  for update to authenticated
  using (bucket_id = 'certificados' and (storage.foldername(name))[1] = public.current_tenant_id()::text)
  with check (bucket_id = 'certificados' and (storage.foldername(name))[1] = public.current_tenant_id()::text);

drop policy if exists certificados_delete on storage.objects;
create policy certificados_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'certificados' and (storage.foldername(name))[1] = public.current_tenant_id()::text);

-- 3) Verificación pública -------------------------------------------------------
-- Devuelve los datos mínimos para confirmar autenticidad. valid_until se entrega
-- como TEXTO crudo (data->>'fecha_vigencia'): en certificados importados de la
-- v1 el formato no está garantizado y un ::timestamptz inválido botaría la
-- función completa; la página lo interpreta con tolerancia.
create or replace function public.verify_certificate(p_code uuid)
returns table (
  folio        integer,
  client_name  text,
  branch_name  text,
  service_date timestamptz,
  issued_at    timestamptz,
  valid_until  text,
  tenant_name  text
)
language sql
security definer
set search_path = public
stable
as $$
  select c.folio,
         coalesce(nullif(c.data->>'cliente_nombre', ''), cl.name) as client_name,
         coalesce(nullif(c.data->>'sucursal_nombre', ''), b.name) as branch_name,
         c.service_date,
         c.issued_at,
         nullif(c.data->>'fecha_vigencia', '') as valid_until,
         t.name as tenant_name
    from public.certificates c
    join public.tenants t   on t.id = c.tenant_id
    left join public.clients  cl on cl.tenant_id = c.tenant_id and cl.id = c.client_id
    left join public.branches b  on b.tenant_id  = c.tenant_id and b.id  = c.branch_id
   where c.verify_code = p_code
   limit 1;
$$;

revoke all on function public.verify_certificate(uuid) from public;
grant execute on function public.verify_certificate(uuid) to anon, authenticated;
