// Diagnóstico 2 (solo lectura): de dónde sacar la sucursal por contrato + bordes.
import { readFileSync } from "node:fs";
import pg from "pg";
const cs = readFileSync("C:\\Users\\carlo\\serfuplagapp-v2\\Secretos\\db.txt", "utf8").trim();
const db = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
await db.connect();
const q = async (l, sql) => { const r = await db.query(sql); console.log(`\n— ${l} —`); console.table(r.rows); };

await q("¿Cuántas sucursales distintas toca cada contrato (en sus servicios)?", `
  with x as (
    select contract_id, count(distinct branch_id) nb
    from public.services where contract_id is not null group by contract_id)
  select nb sucursales_por_contrato, count(*) contratos from x group by 1 order by 1`);

await q("Contratos SIN ningún servicio (brand new / no generados)", `
  select count(*) contratos_sin_servicios from public.contracts ct
  where not exists (select 1 from public.services s where s.contract_id=ct.id)`);

await q("Contratos con visit_mode no soportado por el motor", `
  select coalesce(visit_mode,'(null)') visit_mode, count(*) n
  from public.contracts
  where visit_mode is null or visit_mode not in
    ('primer_habil','dia_habil_mes','dow_x','dia_mes','doble_dow_1_3','doble_dow_2_4',
     'doble_habil_1_3','doble_habil_2_4','dia_dia','todos_dow','cada_n_dias','puntual')
  group by 1 order by n desc`);

await q("Para esos modos raros: ¿qué params traen? (muestra)", `
  select c.name cliente, ct.frequency, ct.visit_mode, ct.visit_params::text params, ct.preferred_time
  from public.contracts ct join public.clients c on c.id=ct.client_id
  where ct.visit_mode in ('default','semana_x','1') or ct.visit_mode is null
  limit 12`);

await q("Último servicio por contrato (hasta dónde llega cada uno)", `
  with x as (
    select contract_id, max(scheduled_at)::date ult, count(*) n
    from public.services where contract_id is not null group by contract_id)
  select to_char(ult,'YYYY-MM') ultimo_mes, count(*) contratos, sum(n) servicios
  from x group by 1 order by 1`);

await q("¿Servicios traen hora? (distribución de hora local aprox)", `
  select to_char(scheduled_at,'HH24:MI') hora, count(*) n
  from public.services where scheduled_at is not null group by 1 order by n desc limit 8`);

await q("Técnicos existentes", `select id, full_name, active from public.technicians order by full_name`);

await db.end();
console.log("\n✅ Diagnóstico 2 listo.");
