-- =============================================================================
-- Convierte a Carlos en OWNER de Serfuplagas Ltda.
-- -----------------------------------------------------------------------------
-- Ejecutar UNA vez, DESPUÉS de:
--   1) correr la migración 0001 y el seed,
--   2) haber creado tu cuenta (registrándote en la app o con "Add user" en Supabase).
-- Si lo corres antes de tener cuenta, no pasa nada: actualiza 0 filas.
-- =============================================================================
update public.profiles
set
  tenant_id = (
    select id from public.tenants
    where name = 'Serfuplagas Ltda.'
    order by created_at
    limit 1
  ),
  role = 'owner'
where id = (
  select id from auth.users
  where lower(email) = lower('cdagnino@serfuplagas.cl')
);

-- Verifica el resultado (debería mostrar tu fila con role = owner y tenant_id lleno):
select p.id, u.email, p.full_name, p.role, t.name as empresa
from public.profiles p
join auth.users u on u.id = p.id
left join public.tenants t on t.id = p.tenant_id
where lower(u.email) = lower('cdagnino@serfuplagas.cl');
