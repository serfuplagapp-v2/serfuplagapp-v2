# Base de datos (Supabase)

Aquí vive **toda la definición de la base de datos como código** (migraciones SQL),
no se crea nada "a mano" en el panel de Supabase (regla de la arquitectura §4).

## Estructura

```
supabase/
├─ migrations/
│  └─ 0001_init_tenants_profiles.sql   ← tablas tenants y profiles + RLS
├─ sql/
│  └─ asignar_owner.sql                ← te convierte en owner (paso único)
└─ seed.sql                            ← crea la empresa "Serfuplagas Ltda."
```

## Cómo aplicar los cambios (Fase 0 — la forma simple)

En el panel de Supabase → **SQL Editor**, ejecuta en este orden:

1. El contenido de `migrations/0001_init_tenants_profiles.sql`
2. El contenido de `seed.sql`
3. Crea tu cuenta (regístrate en la app o usa Authentication → Add user).
4. El contenido de `sql/asignar_owner.sql`

> Cada archivo se pega completo en el editor y se presiona **Run**.

## Cómo aplicar los cambios (más adelante — con la CLI de Supabase)

Cuando el proyecto crezca, conviene usar la CLI para aplicar migraciones de forma
automática:

```bash
npx supabase login
npx supabase link --project-ref <ID-de-tu-proyecto>
npx supabase db push      # aplica las migraciones de /migrations
```

## Reglas

- **Un archivo de migración por cambio de esquema**, con número correlativo y nombre
  descriptivo (`0002_clientes_sucursales.sql`, etc.).
- **RLS habilitado siempre** en toda tabla de negocio. Patrón estándar de aislamiento
  por empresa para las tablas que vienen:

  ```sql
  alter table public.<tabla> enable row level security;
  create policy <tabla>_tenant_isolation on public.<tabla>
    for all using (tenant_id = public.current_tenant_id());
  ```
- Nunca guardar claves/secretos en estos archivos.
