// Diagnóstico de SOLO LECTURA para diseñar el generador de servicios.
// Uso: node migration/diagnose-generator.mjs
import { readFileSync } from "node:fs";
import pg from "pg";
const cs = readFileSync("C:\\Users\\carlo\\serfuplagapp-v2\\Secretos\\db.txt", "utf8").trim();
const db = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
await db.connect();
const q = async (l, sql) => { const r = await db.query(sql); console.log(`\n— ${l} —`); console.table(r.rows); };

await q("Contratos: total / con visit_mode / por status", `
  select 'total' k, count(*) n from public.contracts
  union all select 'con visit_mode', count(*) from public.contracts where visit_mode is not null
  union all select 'con visit_params no vacio', count(*) from public.contracts where visit_params <> '{}'::jsonb
  union all select 'con allowed_days', count(*) from public.contracts where allowed_days is not null
  union all select 'con preferred_time', count(*) from public.contracts where preferred_time is not null
  union all select 'con start_date', count(*) from public.contracts where start_date is not null
  union all select 'con end_date', count(*) from public.contracts where end_date is not null
  union all select 'status vigente', count(*) from public.contracts where status='vigente'`);

await q("Contratos por frequency (texto)", `
  select coalesce(frequency,'(null)') frequency, count(*) n
  from public.contracts group by 1 order by n desc`);

await q("Contratos por visit_mode", `
  select coalesce(visit_mode,'(null)') visit_mode, count(*) n
  from public.contracts group by 1 order by n desc`);

await q("Muestra de 8 contratos (lo que trae legacy_data del contrato)", `
  select c.name cliente, ct.frequency, ct.visit_mode, ct.visit_params::text params,
         ct.allowed_days, ct.preferred_time, ct.start_date, ct.status,
         left(ct.legacy_id,12) legacy
  from public.contracts ct join public.clients c on c.id=ct.client_id
  order by ct.created_at limit 8`);

await q("Servicios: por agenda_status", `
  select agenda_status, count(*) n,
         count(*) filter (where contract_id is not null) con_contrato
  from public.services group by 1 order by n desc`);

await q("Servicios con scheduled_at: rango de fechas", `
  select min(scheduled_at)::date desde, max(scheduled_at)::date hasta, count(*) n
  from public.services where scheduled_at is not null`);

await q("Servicios por mes futuro (>= hoy)", `
  select to_char(scheduled_at,'YYYY-MM') mes, count(*) n
  from public.services
  where scheduled_at::date >= current_date
  group by 1 order by 1`);

await q("¿Los contratos tienen branch? (servicios enlazan branch, contratos no)", `
  select 'contracts con client' k, count(distinct client_id) n from public.contracts
  union all select 'branches por client (prom)', round(avg(nb))::int from (
    select client_id, count(*) nb from public.branches group by client_id) x`);

// ¿Cómo se ve la frequency y el visit_mode juntos en contratos legacy?
await q("Cruce frequency x visit_mode", `
  select coalesce(frequency,'(null)') frequency, coalesce(visit_mode,'(null)') visit_mode, count(*) n
  from public.contracts group by 1,2 order by n desc limit 20`);

await db.end();
console.log("\n✅ Diagnóstico listo.");
