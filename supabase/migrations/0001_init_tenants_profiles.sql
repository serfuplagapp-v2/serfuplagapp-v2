-- =============================================================================
-- Serfuplagapp v2 — Migración 0001: tenants y profiles con RLS
-- -----------------------------------------------------------------------------
-- Implementa el corazón del multi-tenant (01_ARQUITECTURA_V2.md §3 y §4):
--   · Base compartida con aislamiento por fila (Row Level Security / RLS).
--   · Cada usuario pertenece a UNA empresa (tenant) vía profiles.tenant_id.
--   · Roles: owner, admin, tecnico, cliente_portal.
--
-- LECCIÓN DE LA v1 (05_DIAGNOSTICO_V1.md §2.1): en la v1, un usuario sin perfil
-- terminaba siendo "admin" por defecto. Aquí es al revés: un usuario nuevo nace
-- SIN empresa y SIN rol, por lo tanto SIN acceso a ningún dato, hasta que un
-- owner/admin lo habilita explícitamente.
-- =============================================================================

-- Para gen_random_uuid()
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Enum de roles de usuario
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum (
      'owner',
      'admin',
      'tecnico',
      'cliente_portal'
    );
  end if;
end$$;

-- -----------------------------------------------------------------------------
-- Función utilitaria: mantener updated_at al día automáticamente
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tabla: tenants  (la empresa que usa la app; hoy solo Serfuplagas)
-- -----------------------------------------------------------------------------
create table if not exists public.tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  rut         text,
  plan        text not null default 'gratis',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists tenants_set_updated_at on public.tenants;
create trigger tenants_set_updated_at
  before update on public.tenants
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Tabla: profiles  (un perfil por usuario de auth, ligado a una empresa)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  tenant_id   uuid references public.tenants(id) on delete restrict,
  full_name   text,
  role        public.user_role,
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Invariante: un perfil está o totalmente sin habilitar (ambos NULL) o
  -- totalmente habilitado (empresa y rol presentes). Nunca a medias.
  constraint profiles_tenant_role_together check ((tenant_id is null) = (role is null))
);

comment on column public.profiles.role is
  'NUNCA poner DEFAULT: un perfil nace sin rol hasta habilitación explícita (lección de la v1, 05_DIAGNOSTICO_V1 §2.1).';

create index if not exists profiles_tenant_id_idx on public.profiles(tenant_id);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Funciones de ayuda para las políticas RLS.
-- Son SECURITY DEFINER: corren con los permisos de su dueño y NO vuelven a
-- aplicar RLS sobre profiles, evitando la recursión infinita (problema clásico
-- al referenciar la propia tabla profiles dentro de sus políticas).
-- -----------------------------------------------------------------------------
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

grant execute on function public.current_tenant_id() to authenticated;
grant execute on function public.current_user_role() to authenticated;

-- -----------------------------------------------------------------------------
-- Trigger: crear el perfil automáticamente al registrarse un usuario.
-- El perfil nace SIN tenant ni rol (acceso denegado por defecto).
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- RLS — habilitado SIEMPRE en toda tabla de negocio (arquitectura §3).
-- =============================================================================
alter table public.tenants  enable row level security;
alter table public.profiles enable row level security;

-- ---- tenants ----------------------------------------------------------------
-- Cada usuario solo ve su propia empresa.
drop policy if exists tenants_select on public.tenants;
create policy tenants_select on public.tenants
  for select
  using (id = public.current_tenant_id());

-- Solo owner/admin pueden modificar los datos de su empresa.
drop policy if exists tenants_update on public.tenants;
create policy tenants_update on public.tenants
  for update
  using (
    id = public.current_tenant_id()
    and public.current_user_role() in ('owner', 'admin')
  )
  -- WITH CHECK simétrico al USING (práctica defensiva estándar en RLS).
  with check (
    id = public.current_tenant_id()
    and public.current_user_role() in ('owner', 'admin')
  );

-- ---- profiles ---------------------------------------------------------------
-- Un usuario ve su propio perfil y los de su misma empresa (equipo).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select
  using (
    id = auth.uid()
    or tenant_id = public.current_tenant_id()
  );

-- Un usuario puede actualizar SU propio perfil...
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ...pero a NIVEL DE COLUMNA solo puede tocar su nombre y teléfono.
-- El rol y la empresa (tenant_id) NUNCA se cambian desde la app por el propio
-- usuario: eso evita que alguien se auto-promueva a owner (escalada de privilegios).
-- La asignación de rol/empresa se hace por SQL (Fase 0) o por una función con
-- control de permisos (Fase 1+).
revoke update on public.profiles from authenticated;
grant  update (full_name, phone) on public.profiles to authenticated;

-- Aseguramos lectura para usuarios autenticados (la RLS filtra las filas).
grant select on public.tenants  to authenticated;
grant select on public.profiles to authenticated;

-- Defensa en profundidad: el rol anónimo (no autenticado) no debe tener NINGÚN
-- privilegio sobre estas tablas. La RLS ya lo bloquea, pero no queremos que la
-- protección dependa SOLO de que la RLS esté perfecta (Supabase otorga
-- privilegios amplios por defecto a 'anon'; aquí los quitamos).
revoke all on public.profiles from anon;
revoke all on public.tenants  from anon;
