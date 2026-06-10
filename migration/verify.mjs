// Validación post-carga (solo lectura): conteos, agrupaciones y muestras reales.
import { readFileSync } from "node:fs";
import pg from "pg";
const connectionString = readFileSync("C:\\Users\\carlo\\serfuplagapp-v2\\Secretos\\db.txt", "utf8").trim();
const db = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
await db.connect();
const q = async (label, sql) => { const r = await db.query(sql); console.log(`\n— ${label} —`); console.table(r.rows); };

await q("Conteos por tabla", `
  select 'clients' t, count(*) n from public.clients
  union all select 'branches', count(*) from public.branches
  union all select 'contacts', count(*) from public.contacts`);

await q("Top 6 clientes por nº de sucursales", `
  select c.name as cliente, count(b.id) as sucursales
  from public.clients c join public.branches b on b.client_id = c.id
  group by c.name order by sucursales desc limit 6`);

await q("Clientes SIN sucursales (incluye el registro previo de prueba)", `
  select c.name as cliente, c.rut
  from public.clients c left join public.branches b on b.client_id = c.id
  where b.id is null`);

await q("Sucursales con/sin coordenadas", `
  select case when lat is not null then 'con coordenadas' else 'sin coordenadas' end estado, count(*) n
  from public.branches group by 1`);

await q("Contactos: a nivel cliente vs a nivel sucursal", `
  select case when branch_id is null then 'nivel cliente (todas)' else 'nivel sucursal' end nivel, count(*) n
  from public.contacts group by 1`);

await q("Muestra: 1 sucursal de La Araucana con su nota y coordenadas", `
  select b.name as sucursal, b.address as direccion, b.lat, b.lng, left(b.notes,60) as notas
  from public.branches b join public.clients c on c.id=b.client_id
  where c.name ilike '%araucana%' and b.lat is not null limit 1`);

await db.end();
console.log("\n✅ Validación terminada.");
