-- =============================================================================
-- Serfuplagapp v2 — Migración 0010: tareas pendientes (módulo Pendientes)
-- -----------------------------------------------------------------------------
-- Réplica de la colección `tareas` de la v1: recordatorios manuales del
-- administrador, agrupados por fecha (vencidas/hoy/semana/más adelante/sin
-- fecha). Opcionalmente enlazadas a un cliente. RLS estándar por empresa.
-- =============================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_priority') then
    create type public.task_priority as enum ('alta', 'normal');
  end if;
  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type public.task_status as enum ('pendiente', 'hecha');
  end if;
end$$;

create table if not exists public.tasks (
  id          uuid not null default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete restrict,
  title       text not null,
  due_date    date,                            -- null = "sin fecha"
  priority    public.task_priority not null default 'normal',
  client_id   uuid,                            -- opcional: tarea ligada a un cliente
  notes       text,
  status      public.task_status not null default 'pendiente',
  done_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (id),
  unique (tenant_id, id),
  foreign key (tenant_id, client_id) references public.clients (tenant_id, id) on delete set null (client_id)
);
create index if not exists tasks_tenant_status_due_idx on public.tasks(tenant_id, status, due_date);

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;
drop policy if exists tasks_tenant_isolation on public.tasks;
create policy tasks_tenant_isolation on public.tasks
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
grant select, insert, update, delete on public.tasks to authenticated;
revoke all on public.tasks from anon;
