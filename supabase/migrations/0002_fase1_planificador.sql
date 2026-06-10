-- =============================================================================
-- Serfuplagapp v2 — Migración 0002: Fase 1 (Planificador)
-- -----------------------------------------------------------------------------
-- Tablas de negocio del planificador (01_ARQUITECTURA_V2.md §4):
--   clients, branches, contacts, service_types, contracts, technicians,
--   services (DOS estados: agenda + terreno), service_technicians,
--   routes, route_stops, geocode_cache.
--
-- Reglas aplicadas:
--   · Toda tabla de negocio lleva tenant_id NOT NULL + RLS de aislamiento (§3).
--   · AISLAMIENTO REFORZADO: las FKs son COMPUESTAS con tenant_id, de modo que
--     es IMPOSIBLE (a nivel del motor, incluso para procesos con service_role)
--     enlazar una fila de una empresa con la de otra. Para ello cada tabla padre
--     declara UNIQUE (tenant_id, id). (Hallazgo de la revisión de seguridad
--     adversarial de Fase 1: las FKs simples no validan el tenant del padre.)
--   · Índices obligatorios (§4) + índices de búsqueda (pg_trgm) para listas
--     filtradas/paginadas EN EL SERVIDOR (§5).
--   · Estados como enums cerrados, en español sin tildes (04_DICCIONARIO §2).
--   · geocode_cache: compartida (sin tenant_id), acceso SOLO desde el servidor.
-- =============================================================================

create extension if not exists "pg_trgm";   -- búsquedas ILIKE con índice GIN

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'client_type') then
    create type public.client_type as enum ('residencial', 'empresa', 'institucional');
  end if;
  if not exists (select 1 from pg_type where typname = 'contract_status') then
    create type public.contract_status as enum ('vigente', 'terminado', 'suspendido');
  end if;
  if not exists (select 1 from pg_type where typname = 'service_agenda_status') then
    create type public.service_agenda_status as enum
      ('propuesto', 'programado', 'enviado', 'confirmado', 'reprogramado', 'cancelado');
  end if;
  if not exists (select 1 from pg_type where typname = 'service_field_status') then
    create type public.service_field_status as enum
      ('planificada', 'asignada', 'en_proceso', 'por_validar', 'terminada');
  end if;
  if not exists (select 1 from pg_type where typname = 'route_status') then
    create type public.route_status as enum ('planificada', 'en_curso', 'completada', 'cancelada');
  end if;
  -- Modo de facturación del contrato (modelo comercial añadido por Carlos, jun 2026).
  if not exists (select 1 from pg_type where typname = 'billing_mode') then
    create type public.billing_mode as enum ('por_servicio', 'mensual_consolidada');
  end if;
end$$;

-- -----------------------------------------------------------------------------
-- clients
-- -----------------------------------------------------------------------------
create table if not exists public.clients (
  id          uuid not null default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete restrict,
  name        text not null,
  rut         text,                          -- formato único: sin puntos, con guion y DV (76818360-0)
  type        public.client_type,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (id),
  unique (tenant_id, id)                     -- habilita FKs compuestas intra-tenant
);
create index if not exists clients_tenant_id_idx on public.clients(tenant_id);
create index if not exists clients_name_trgm_idx on public.clients using gin (name gin_trgm_ops);
create index if not exists clients_rut_trgm_idx  on public.clients using gin (rut gin_trgm_ops) where rut is not null;

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at before update on public.clients
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- branches  (FK compuesta a clients)
-- -----------------------------------------------------------------------------
create table if not exists public.branches (
  id          uuid not null default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete restrict,
  client_id   uuid not null,
  name        text not null,
  address     text,
  lat         double precision,
  lng         double precision,
  geocoded_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (id),
  unique (tenant_id, id),
  foreign key (tenant_id, client_id) references public.clients (tenant_id, id) on delete cascade
);
create index if not exists branches_tenant_client_idx on public.branches(tenant_id, client_id);   -- §4 obligatorio
create index if not exists branches_name_trgm_idx     on public.branches using gin (name gin_trgm_ops);
create index if not exists branches_address_trgm_idx  on public.branches using gin (address gin_trgm_ops) where address is not null;

drop trigger if exists branches_set_updated_at on public.branches;
create trigger branches_set_updated_at before update on public.branches
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- contacts  (FK compuesta a clients y branches; con flags de comunicación v1)
-- -----------------------------------------------------------------------------
create table if not exists public.contacts (
  id              uuid not null default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete restrict,
  client_id       uuid not null,
  branch_id       uuid,                       -- nullable: contacto a nivel cliente o sucursal
  name            text not null,
  role            text,                       -- cargo: administrador, conserje, prevencionista, etc.
  phone           text,
  email           text,
  es_destinatario boolean not null default false,   -- destinatario principal de correo
  es_cc           boolean not null default false,   -- va en copia (CC)
  recibe_whatsapp boolean not null default false,   -- recibe avisos por WhatsApp
  orden           integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (id),
  foreign key (tenant_id, client_id) references public.clients (tenant_id, id) on delete cascade,
  foreign key (tenant_id, branch_id) references public.branches (tenant_id, id) on delete cascade
);
create index if not exists contacts_tenant_client_idx on public.contacts(tenant_id, client_id);
create index if not exists contacts_branch_idx        on public.contacts(branch_id);

drop trigger if exists contacts_set_updated_at on public.contacts;
create trigger contacts_set_updated_at before update on public.contacts
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- service_types  (catálogo EDITABLE por empresa; nombre único por empresa)
-- -----------------------------------------------------------------------------
create table if not exists public.service_types (
  id          uuid not null default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete restrict,
  name        text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (id),
  unique (tenant_id, id),
  unique (tenant_id, name)                    -- evita tipos duplicados dentro de una empresa
);
create index if not exists service_types_tenant_idx on public.service_types(tenant_id);

drop trigger if exists service_types_set_updated_at on public.service_types;
create trigger service_types_set_updated_at before update on public.service_types
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- contracts  (FK compuesta a clients y service_types)
-- -----------------------------------------------------------------------------
create table if not exists public.contracts (
  id              uuid not null default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete restrict,
  client_id       uuid not null,
  service_type_id uuid not null,
  frequency       text,                          -- ej: mensual, bimensual, trimestral, semanal, unica
  current_price   numeric(12,0),                 -- CLP sin decimales
  start_date      date,
  end_date        date,
  status          public.contract_status not null default 'vigente',
  oc_number       text,                          -- N° de Orden de Compra marco del cliente institucional
  oc_file_path    text,                          -- ruta al PDF de la OC en Storage (se sube en Fase 2)
  billing_mode    public.billing_mode not null default 'por_servicio',  -- por_servicio | mensual_consolidada
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (id),
  unique (tenant_id, id),
  foreign key (tenant_id, client_id)       references public.clients (tenant_id, id)       on delete cascade,
  foreign key (tenant_id, service_type_id) references public.service_types (tenant_id, id) on delete restrict
);
create index if not exists contracts_tenant_client_idx on public.contracts(tenant_id, client_id);

drop trigger if exists contracts_set_updated_at on public.contracts;
create trigger contracts_set_updated_at before update on public.contracts
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- technicians
-- -----------------------------------------------------------------------------
create table if not exists public.technicians (
  id           uuid not null default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete restrict,
  profile_id   uuid references public.profiles(id) on delete set null,  -- cuenta de app del técnico (si tiene)
  full_name    text not null,                  -- nombre visible (el técnico puede no tener login)
  license_info text,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (id),
  unique (tenant_id, id)
);
create index if not exists technicians_tenant_idx on public.technicians(tenant_id);

drop trigger if exists technicians_set_updated_at on public.technicians;
create trigger technicians_set_updated_at before update on public.technicians
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- services  (DOS estados: agenda + terreno; FKs compuestas)
-- -----------------------------------------------------------------------------
create table if not exists public.services (
  id              uuid not null default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete restrict,
  client_id       uuid not null,
  branch_id       uuid,
  contract_id     uuid,
  service_type_id uuid not null,
  scheduled_at    timestamptz,
  agenda_status   public.service_agenda_status not null default 'propuesto',
  field_status    public.service_field_status  not null default 'planificada',
  notes           text,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (id),
  unique (tenant_id, id),
  foreign key (tenant_id, client_id)       references public.clients (tenant_id, id)       on delete restrict,
  foreign key (tenant_id, branch_id)       references public.branches (tenant_id, id)      on delete set null (branch_id),
  foreign key (tenant_id, contract_id)     references public.contracts (tenant_id, id)     on delete set null (contract_id),
  foreign key (tenant_id, service_type_id) references public.service_types (tenant_id, id) on delete restrict
  -- detected_pests text[], photos_before/after: se agregan en Fase 3.
);
create index if not exists services_tenant_scheduled_idx on public.services(tenant_id, scheduled_at);  -- §4 obligatorio
create index if not exists services_tenant_client_idx    on public.services(tenant_id, client_id);     -- §4 obligatorio
create index if not exists services_branch_idx           on public.services(branch_id);

drop trigger if exists services_set_updated_at on public.services;
create trigger services_set_updated_at before update on public.services
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- service_technicians  (puente: una OT puede tener VARIOS técnicos; FKs compuestas)
-- -----------------------------------------------------------------------------
create table if not exists public.service_technicians (
  tenant_id     uuid not null references public.tenants(id) on delete restrict,
  service_id    uuid not null,
  technician_id uuid not null,
  primary key (service_id, technician_id),
  foreign key (tenant_id, service_id)    references public.services (tenant_id, id)    on delete cascade,
  foreign key (tenant_id, technician_id) references public.technicians (tenant_id, id) on delete cascade
);
create index if not exists service_technicians_tech_idx on public.service_technicians(technician_id);

-- -----------------------------------------------------------------------------
-- routes  (FK compuesta a technicians)
-- -----------------------------------------------------------------------------
create table if not exists public.routes (
  id            uuid not null default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete restrict,
  technician_id uuid,
  date          date not null,
  status        public.route_status not null default 'planificada',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (id),
  unique (tenant_id, id),
  foreign key (tenant_id, technician_id) references public.technicians (tenant_id, id) on delete set null (technician_id)
);
create index if not exists routes_tenant_date_idx on public.routes(tenant_id, date);  -- §4 obligatorio

drop trigger if exists routes_set_updated_at on public.routes;
create trigger routes_set_updated_at before update on public.routes
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- route_stops  (FKs compuestas a routes y services)
-- -----------------------------------------------------------------------------
create table if not exists public.route_stops (
  id          uuid not null default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete restrict,
  route_id    uuid not null,
  service_id  uuid not null,
  position    integer not null default 0,
  eta         timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (id),
  foreign key (tenant_id, route_id)   references public.routes (tenant_id, id)   on delete cascade,
  foreign key (tenant_id, service_id) references public.services (tenant_id, id) on delete cascade
);
create index if not exists route_stops_route_idx on public.route_stops(route_id);

drop trigger if exists route_stops_set_updated_at on public.route_stops;
create trigger route_stops_set_updated_at before update on public.route_stops
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- geocode_cache (COMPARTIDA, sin tenant_id) — acceso SOLO desde el servidor.
-- Sin acceso para 'authenticated' (no exponer el conjunto de direcciones entre
-- empresas); el módulo de mapa la usará vía service_role o función SECURITY DEFINER.
-- -----------------------------------------------------------------------------
create table if not exists public.geocode_cache (
  address_hash text primary key,
  address      text not null,
  lat          double precision,
  lng          double precision,
  created_at   timestamptz not null default now()
);

-- =============================================================================
-- RLS — aislamiento por empresa en TODAS las tablas de negocio (§3).
-- Patrón estándar: tenant_id = public.current_tenant_id() (SECURITY DEFINER, 0001).
-- =============================================================================
do $$
declare
  t text;
  tenant_tables text[] := array[
    'clients','branches','contacts','service_types','contracts','technicians',
    'services','service_technicians','routes','route_stops'
  ];
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

-- geocode_cache: RLS habilitada, SIN políticas para authenticated/anon.
alter table public.geocode_cache enable row level security;
revoke all on public.geocode_cache from anon;
revoke all on public.geocode_cache from authenticated;

-- =============================================================================
-- Semilla: tipos de servicio iniciales de Serfuplagas (04_DICCIONARIO §4.2).
-- Idempotente. Nuevos tenants: se sembrará en el onboarding (Fase 5).
-- =============================================================================
do $$
declare
  v_tenant uuid;
begin
  select id into v_tenant from public.tenants where name = 'Serfuplagas Ltda.' limit 1;
  if v_tenant is not null then
    insert into public.service_types (tenant_id, name)
    select v_tenant, x.name
    from (values
      ('Desratización'), ('Desinsectación'), ('Sanitización/Desinfección'),
      ('Control de Palomas'), ('Aromatización'), ('Control de Cucarachas')
    ) as x(name)
    on conflict (tenant_id, name) do nothing;
  end if;
end$$;
