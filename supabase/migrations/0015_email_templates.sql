-- =============================================================================
-- Serfuplagapp v2 — Migración 0015: plantilla de correo por cliente
-- -----------------------------------------------------------------------------
-- Réplica de `plantillas_correo` de la v1 (pestaña "Correo" de la ficha):
-- una plantilla por cliente con destinatario(s), CC, asunto y cuerpo. La usan
-- el envío del certificado (destinatario sugerido) y los correos automáticos
-- de programación/recordatorio (se portarán en la sesión de Agenda).
-- Variables en asunto/cuerpo (mismas de la v1): {cliente}, {nombre_pila},
-- {servicios}, {fecha_servicio}, {dia}, {dia_numero}, {mes}, {anio},
-- {hora_servicio}, {direccion}.
-- Reglas de siempre: tenant_id + RLS + FK compuesta.
-- =============================================================================
create table if not exists public.email_templates (
  id         uuid not null default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete restrict,
  client_id  uuid not null,
  to_emails  text,                -- "correo@cliente.cl, otro@cliente.cl"
  cc_emails  text,
  subject    text,
  body       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id),
  unique (tenant_id, id),
  unique (client_id),             -- una plantilla por cliente
  foreign key (tenant_id, client_id) references public.clients (tenant_id, id) on delete cascade
);
create index if not exists email_templates_tenant_idx on public.email_templates(tenant_id);

drop trigger if exists email_templates_set_updated_at on public.email_templates;
create trigger email_templates_set_updated_at before update on public.email_templates
  for each row execute function public.set_updated_at();

alter table public.email_templates enable row level security;
drop policy if exists email_templates_tenant_isolation on public.email_templates;
create policy email_templates_tenant_isolation on public.email_templates
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
grant select, insert, update, delete on public.email_templates to authenticated;
revoke all on public.email_templates from anon;
