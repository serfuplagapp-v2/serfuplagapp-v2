-- =============================================================================
-- Serfuplagapp v2 — Migración 0004: Fase 2 (Comercial)
-- -----------------------------------------------------------------------------
-- Modelo del 04_DICCIONARIO (decisiones comerciales de Carlos, jun 2026):
--   movements: flujo cotizado → aprobado (venta) → facturado → pagado, o rechazado.
--     · type: venta | cotizacion | nota_credito   (NC con monto NEGATIVO)
--     · amount = foto del monto cobrado (preserva historia ante reajustes)
--     · OC puntual del carril spot (oc_number + oc_file_path)
--   movement_services: factura consolidada (carril institucional) — un movimiento
--     mensual agrupa N servicios del contrato → un solo DTE por período.
--   dte_documents: documento tributario electrónico vinculado a un movimiento.
-- Mismo blindaje que Fase 1: FKs COMPUESTAS con tenant_id + unique(tenant_id,id) + RLS.
-- Refinamiento para la importación histórica: client_id y contract_id NULLABLE
--   (un movimiento histórico del Excel puede no calzar con un cliente/contrato actual;
--    se conserva el nombre crudo en client_name_raw para no perder información).
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'movement_type') then
    create type public.movement_type as enum ('venta', 'cotizacion', 'nota_credito');
  end if;
  if not exists (select 1 from pg_type where typname = 'movement_status') then
    create type public.movement_status as enum
      ('cotizado', 'aprobado', 'facturado', 'pagado', 'rechazado');
  end if;
end$$;

-- -----------------------------------------------------------------------------
-- movements
-- -----------------------------------------------------------------------------
create table if not exists public.movements (
  id              uuid not null default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete restrict,
  client_id       uuid,                      -- nullable (ver cabecera)
  contract_id     uuid,
  date            date not null,
  type            public.movement_type not null,
  amount          numeric(12,0) not null,    -- CLP sin decimales; NC en negativo
  status          public.movement_status not null default 'cotizado',
  description     text,                      -- glosa/concepto (del Excel histórico)
  client_name_raw text,                      -- nombre de cliente crudo si no calza con uno actual
  dte_folio       text,
  oc_number       text,
  oc_file_path    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (id),
  unique (tenant_id, id),
  foreign key (tenant_id, client_id)   references public.clients (tenant_id, id)   on delete set null (client_id),
  foreign key (tenant_id, contract_id) references public.contracts (tenant_id, id) on delete set null (contract_id)
);
create index if not exists movements_tenant_date_idx   on public.movements(tenant_id, date);   -- §4 obligatorio
create index if not exists movements_tenant_client_idx on public.movements(tenant_id, client_id);

drop trigger if exists movements_set_updated_at on public.movements;
create trigger movements_set_updated_at before update on public.movements
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- movement_services  (puente: factura consolidada; FKs compuestas)
-- -----------------------------------------------------------------------------
create table if not exists public.movement_services (
  tenant_id   uuid not null references public.tenants(id) on delete restrict,
  movement_id uuid not null,
  service_id  uuid not null,
  primary key (movement_id, service_id),
  foreign key (tenant_id, movement_id) references public.movements (tenant_id, id) on delete cascade,
  foreign key (tenant_id, service_id)  references public.services (tenant_id, id)  on delete cascade
);
create index if not exists movement_services_service_idx on public.movement_services(service_id);

-- -----------------------------------------------------------------------------
-- dte_documents  (FK compuesta a movements)
-- -----------------------------------------------------------------------------
create table if not exists public.dte_documents (
  id          uuid not null default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete restrict,
  movement_id uuid not null,
  sii_type    integer,                       -- código SII (33 factura, 61 NC, 39 boleta…)
  folio       text,
  xml_path    text,
  status      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (id),
  unique (tenant_id, id),
  foreign key (tenant_id, movement_id) references public.movements (tenant_id, id) on delete cascade
);
create index if not exists dte_documents_movement_idx on public.dte_documents(movement_id);

drop trigger if exists dte_documents_set_updated_at on public.dte_documents;
create trigger dte_documents_set_updated_at before update on public.dte_documents
  for each row execute function public.set_updated_at();

-- =============================================================================
-- RLS — aislamiento por empresa (§3), patrón estándar.
-- =============================================================================
do $$
declare
  t text;
  tabs text[] := array['movements', 'movement_services', 'dte_documents'];
begin
  foreach t in array tabs loop
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
