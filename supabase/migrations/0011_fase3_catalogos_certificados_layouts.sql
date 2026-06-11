-- =============================================================================
-- Serfuplagapp v2 — Migración 0011: capa de datos Fase 3 + facturación legacy
-- -----------------------------------------------------------------------------
-- Tablas para importar la información de la v1 (decisión Carlos 11-jun-2026:
-- traer layouts, facturación, certificados y sus catálogos):
--   · products / pests / predefined_texts  — catálogos para certificados.
--   · certificates  — certificados emitidos (folio correlativo; las re-emisiones
--     de la v1 duplican folio, por eso NO hay unique en folio; se controla en app).
--   · layouts       — planos con estaciones (elementos jsonb, fondo/miniatura).
--   · tenant_settings — config de empresa (folio siguiente de certificado y
--     cotización + datos legales/PDF en jsonb).
--   · movements.legacy_id / dte_documents.legacy_id (+pdf_path) — enlace v1
--     para importar cobros/facturas sin duplicar.
-- Reglas de siempre: tenant_id + RLS + FKs COMPUESTAS (unique(tenant_id,id)).
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'predefined_text_kind') then
    create type public.predefined_text_kind as enum ('trabajo', 'observacion', 'recomendacion');
  end if;
end$$;

-- -----------------------------------------------------------------------------
-- products (catálogo de productos químicos)
-- -----------------------------------------------------------------------------
create table if not exists public.products (
  id                 uuid not null default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete restrict,
  name               text not null,
  active             boolean not null default true,
  favorito           boolean not null default false,
  dosis              text,
  formulacion        text,
  concentracion      text,
  ingrediente_activo text,
  isp                text,                      -- registro ISP
  laboratorio        text,
  unidad             text,
  service_names      text[],                    -- tipos de servicio donde aplica (nombres v1)
  legacy_id          text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  primary key (id),
  unique (tenant_id, id)
);
create index if not exists products_tenant_idx on public.products(tenant_id);
create index if not exists products_legacy_idx on public.products(legacy_id) where legacy_id is not null;
drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- pests (catálogo de plagas)
-- -----------------------------------------------------------------------------
create table if not exists public.pests (
  id              uuid not null default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete restrict,
  name            text not null,
  scientific_name text,
  active          boolean not null default true,
  legacy_id       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (id),
  unique (tenant_id, id)
);
create index if not exists pests_tenant_idx on public.pests(tenant_id);
drop trigger if exists pests_set_updated_at on public.pests;
create trigger pests_set_updated_at before update on public.pests
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- predefined_texts (textos por defecto: trabajo realizado / observaciones / recomendaciones)
-- -----------------------------------------------------------------------------
create table if not exists public.predefined_texts (
  id          uuid not null default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete restrict,
  kind        public.predefined_text_kind not null,
  body        text not null,
  sort_order  integer not null default 0,
  active      boolean not null default true,
  legacy_id   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (id),
  unique (tenant_id, id)
);
create index if not exists predefined_texts_tenant_idx on public.predefined_texts(tenant_id, kind);
drop trigger if exists predefined_texts_set_updated_at on public.predefined_texts;
create trigger predefined_texts_set_updated_at before update on public.predefined_texts
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- certificates (certificados emitidos; folio correlativo desde tenant_settings)
-- -----------------------------------------------------------------------------
create table if not exists public.certificates (
  id           uuid not null default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete restrict,
  folio        integer not null,
  service_id   uuid,                         -- OT origen (null si es anterior al 1-may)
  client_id    uuid,
  branch_id    uuid,
  issued_at    timestamptz,                  -- fecha de emisión
  service_date timestamptz,                  -- fecha del servicio certificado
  data         jsonb not null default '{}'::jsonb,  -- metodología, productos, plagas, técnico(s), titular, superficie…
  pdf_path     text,                         -- PDF en Storage (Fase 3 lo genera)
  legacy_id    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (id),
  unique (tenant_id, id),
  foreign key (tenant_id, service_id) references public.services (tenant_id, id) on delete set null (service_id),
  foreign key (tenant_id, client_id)  references public.clients (tenant_id, id)  on delete set null (client_id),
  foreign key (tenant_id, branch_id)  references public.branches (tenant_id, id) on delete set null (branch_id)
);
create index if not exists certificates_tenant_folio_idx  on public.certificates(tenant_id, folio);
create index if not exists certificates_tenant_client_idx on public.certificates(tenant_id, client_id);
create index if not exists certificates_service_idx       on public.certificates(service_id);
create index if not exists certificates_legacy_idx        on public.certificates(legacy_id) where legacy_id is not null;
drop trigger if exists certificates_set_updated_at on public.certificates;
create trigger certificates_set_updated_at before update on public.certificates
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- layouts (planos con estaciones; los elementos viven en jsonb como en la v1)
-- OJO rendimiento: bg_image/thumbnail pueden pesar cientos de KB (base64 v1);
-- las listas deben seleccionar SOLO columnas livianas (nunca select *).
-- -----------------------------------------------------------------------------
create table if not exists public.layouts (
  id           uuid not null default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete restrict,
  name         text not null,
  client_id    uuid,
  branch_id    uuid,                          -- el plano es de la sucursal (casino, bodega…)
  bg_color     text,
  bg_image     text,                          -- base64 o URL (heredado v1)
  header       jsonb,
  elements     jsonb not null default '[]'::jsonb,  -- estaciones y figuras del plano
  thumbnail    text,
  snapshot_url text,
  snapshot_w   integer,
  snapshot_h   integer,
  legacy_id    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (id),
  unique (tenant_id, id),
  foreign key (tenant_id, client_id) references public.clients (tenant_id, id)  on delete set null (client_id),
  foreign key (tenant_id, branch_id) references public.branches (tenant_id, id) on delete set null (branch_id)
);
create index if not exists layouts_tenant_idx        on public.layouts(tenant_id);
create index if not exists layouts_tenant_branch_idx on public.layouts(tenant_id, branch_id);
create index if not exists layouts_legacy_idx        on public.layouts(legacy_id) where legacy_id is not null;
drop trigger if exists layouts_set_updated_at on public.layouts;
create trigger layouts_set_updated_at before update on public.layouts
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- tenant_settings (1 fila por empresa: folios correlativos + config legal/PDF)
-- -----------------------------------------------------------------------------
create table if not exists public.tenant_settings (
  tenant_id        uuid not null primary key references public.tenants(id) on delete cascade,
  cert_next_folio  integer not null default 1,   -- próximo folio de certificado
  quote_next_folio integer not null default 1,   -- próximo folio de cotización
  data             jsonb not null default '{}'::jsonb,  -- rep_legal, res_san, colores PDF, firma, textos default…
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
drop trigger if exists tenant_settings_set_updated_at on public.tenant_settings;
create trigger tenant_settings_set_updated_at before update on public.tenant_settings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Facturación legacy: enlaces v1 + ruta del PDF del DTE
-- -----------------------------------------------------------------------------
alter table public.movements     add column if not exists legacy_id text;
alter table public.dte_documents add column if not exists legacy_id text;
alter table public.dte_documents add column if not exists pdf_path text;
create index if not exists movements_legacy_idx     on public.movements(legacy_id)     where legacy_id is not null;
create index if not exists dte_documents_legacy_idx on public.dte_documents(legacy_id) where legacy_id is not null;

-- =============================================================================
-- RLS — patrón estándar en todas las tablas nuevas.
-- =============================================================================
do $$
declare
  t text;
  tenant_tables text[] := array['products','pests','predefined_texts','certificates','layouts','tenant_settings'];
begin
  foreach t in array tenant_tables loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I on public.%I;', t || '_tenant_isolation', t);
    execute format($f$
      create policy %I on public.%I
        for all
        using (tenant_id = public.current_tenant_id())
        with check (tenant_id = public.current_tenant_id());
    $f$, t || '_tenant_isolation', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated;', t);
    execute format('revoke all on public.%I from anon;', t);
  end loop;
end$$;
