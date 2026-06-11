-- =============================================================================
-- Serfuplagapp v2 — Migración 0013: Storage para fotos de terreno
-- -----------------------------------------------------------------------------
-- Bucket PRIVADO `terreno`: fotos de las visitas (y a futuro PDFs).
-- Estructura de rutas: {tenant_id}/{service_id}/{archivo}
-- Las políticas exigen que la PRIMERA carpeta sea el tenant del usuario →
-- aislamiento por empresa también en los archivos. La app muestra las fotos
-- con URLs firmadas (no hay acceso público).
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('terreno', 'terreno', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists terreno_select on storage.objects;
create policy terreno_select on storage.objects
  for select to authenticated
  using (bucket_id = 'terreno' and (storage.foldername(name))[1] = public.current_tenant_id()::text);

drop policy if exists terreno_insert on storage.objects;
create policy terreno_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'terreno' and (storage.foldername(name))[1] = public.current_tenant_id()::text);

drop policy if exists terreno_delete on storage.objects;
create policy terreno_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'terreno' and (storage.foldername(name))[1] = public.current_tenant_id()::text);
