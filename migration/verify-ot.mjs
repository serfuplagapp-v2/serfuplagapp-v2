import { readFileSync } from "node:fs";
import pg from "pg";
const cs = readFileSync("C:\\Users\\carlo\\serfuplagapp-v2\\Secretos\\db.txt", "utf8").trim();
const db = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
await db.connect();
const q = async (l, sql) => { const r = await db.query(sql); console.log(`\n— ${l} —`); console.table(r.rows); };

await q("Conteos", `
  select 'contracts' t, count(*) n from public.contracts
  union all select 'services', count(*) from public.services
  union all select 'services c/ legacy_data', count(*) from public.services where legacy_data is not null
  union all select 'services c/ folio', count(*) from public.services where legacy_data ? 'folio'
  union all select 'branches c/ legacy_id', count(*) from public.branches where legacy_id is not null`);

await q("Servicios por mes (agenda)", `
  select to_char(scheduled_at,'YYYY-MM') mes, count(*) servicios
  from public.services where scheduled_at is not null group by 1 order by 1`);

await q("Top 5 clientes por nº de servicios", `
  select c.name cliente, count(*) servicios
  from public.services s join public.clients c on c.id=s.client_id
  group by c.name order by servicios desc limit 5`);

await q("Estados (agenda x terreno)", `
  select agenda_status, field_status, count(*) n from public.services
  group by 1,2 order by n desc limit 8`);

await q("Muestra: data de certificado preservada en 1 servicio terminado", `
  select c.name cliente, s.scheduled_at::date fecha,
         s.legacy_data->>'folio' folio,
         jsonb_array_length(coalesce(s.legacy_data->'plagas_detectadas','[]'::jsonb)) plagas,
         jsonb_array_length(coalesce(s.legacy_data->'productos_usados','[]'::jsonb)) productos,
         left(s.legacy_data->>'trabajo_realizado',40) trabajo
  from public.services s join public.clients c on c.id=s.client_id
  where s.field_status='terminada' and s.legacy_data ? 'folio' limit 1`);

await db.end();
console.log("\n✅ Verificación lista.");
