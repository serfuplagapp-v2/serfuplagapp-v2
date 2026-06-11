// Prueba de SOLO LECTURA del motor de generación contra los contratos reales.
// Uso: node migration/test-generator.mts
import { readFileSync } from "node:fs";
import pg from "pg";
import { generarVisitas, type ContractSchedule } from "../src/lib/scheduling.ts";

const cs = readFileSync("C:\\Users\\carlo\\serfuplagapp-v2\\Secretos\\db.txt", "utf8").trim();
const db = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
await db.connect();

const FROM = "2026-06-10"; // hoy
const TO = "2027-12-31"; // proponer hasta fin de 2027

// Contratos vigentes con su detalle de periodicidad.
const { rows: contracts } = await db.query(`
  select ct.id, c.name cliente, ct.frequency, ct.visit_mode, ct.visit_params,
         ct.allowed_days, ct.preferred_time::text preferred_time, ct.start_date::text start_date,
         ct.end_date::text end_date, ct.client_id
  from public.contracts ct join public.clients c on c.id = ct.client_id
  where ct.status = 'vigente'`);

// Fechas (Santiago) de servicios existentes por contrato + sucursal + ancla (1ra fecha).
const { rows: svc } = await db.query(`
  select contract_id,
         to_char(scheduled_at at time zone 'America/Santiago','YYYY-MM-DD') d,
         branch_id
  from public.services where contract_id is not null and scheduled_at is not null`);

const existingByContract = new Map<string, Set<string>>();
const anchorByContract = new Map<string, string>();
const branchByContract = new Map<string, Set<string>>();
for (const r of svc) {
  if (!existingByContract.has(r.contract_id)) existingByContract.set(r.contract_id, new Set());
  existingByContract.get(r.contract_id)!.add(r.d);
  const a = anchorByContract.get(r.contract_id);
  if (!a || r.d < a) anchorByContract.set(r.contract_id, r.d);
  if (r.branch_id) {
    if (!branchByContract.has(r.contract_id)) branchByContract.set(r.contract_id, new Set());
    branchByContract.get(r.contract_id)!.add(r.branch_id);
  }
}

// Sucursales por cliente (para contratos sin servicios).
const { rows: brs } = await db.query(`select id, client_id from public.branches`);
const branchesByClient = new Map<string, string[]>();
for (const b of brs) {
  if (!branchesByClient.has(b.client_id)) branchesByClient.set(b.client_id, []);
  branchesByClient.get(b.client_id)!.push(b.id);
}

let totalProposals = 0;
let collisions = 0;
let sinSucursal = 0;
let sinFrecuencia = 0;
let nearDup = 0; // propuestas en un MES que ya tiene un servicio existente (posible casi-duplicado)
let rollForwardOnly = 0; // propuestas estrictamente posteriores al último servicio existente
const nearDupSamples: string[] = [];
const samples: string[] = [];

for (const ct of contracts) {
  const sched: ContractSchedule = {
    frequency: ct.frequency,
    visitMode: ct.visit_mode,
    visitParams: ct.visit_params ?? {},
    allowedDays: ct.allowed_days,
    preferredTime: ct.preferred_time,
    startDate: ct.start_date,
    endDate: ct.end_date,
  };
  const existing = existingByContract.get(ct.id) ?? new Set<string>();
  const anchor = anchorByContract.get(ct.id) ?? ct.start_date ?? FROM;
  const visits = generarVisitas(sched, { from: FROM, to: TO, anchorDate: anchor });
  const fresh = visits.filter((v) => !existing.has(v.date));

  // ¿Hay colisión? (alguna propuesta cae el mismo día que un servicio existente)
  const collided = visits.filter((v) => existing.has(v.date)).length;
  collisions += collided;
  totalProposals += fresh.length;

  // POLÍTICA roll-forward: solo proponer DESPUÉS del último servicio existente.
  const existingMonths = new Set([...existing].map((d) => d.slice(0, 7)));
  const lastExisting = [...existing].sort().at(-1) ?? null;
  const rollFwd = fresh.filter((v) => !lastExisting || v.date > lastExisting);
  rollForwardOnly += rollFwd.length;
  // ¿Quedan casi-duplicados bajo la política roll-forward? (debe ser 0)
  for (const v of rollFwd) {
    if (existingMonths.has(v.date.slice(0, 7))) {
      nearDup++;
      if (nearDupSamples.length < 10)
        nearDupSamples.push(`${ct.cliente.slice(0, 24).padEnd(24)} prop:${v.date} (mes ya tiene servicio)`);
    }
  }

  if (!sched.frequency) sinFrecuencia++;

  // Derivar sucursal.
  const derived = branchByContract.get(ct.id);
  const branchOk =
    (derived && derived.size === 1) ||
    (branchesByClient.get(ct.client_id)?.length === 1);
  if (fresh.length > 0 && !branchOk) sinSucursal++;

  if (samples.length < 12 && fresh.length > 0) {
    samples.push(
      `${ct.cliente.slice(0, 28).padEnd(28)} ${ct.frequency?.padEnd(13)} ${(ct.visit_mode ?? "-").padEnd(14)} ` +
        `existentes:${String(existing.size).padStart(3)} nuevas:${String(fresh.length).padStart(3)} ` +
        `1ra:${fresh[0]?.date ?? "-"} ult:${fresh.at(-1)?.date ?? "-"}`,
    );
  }
}

console.log(`\nVentana: ${FROM} → ${TO}`);
console.log(`Contratos vigentes: ${contracts.length}`);
console.log(`Propuestas NUEVAS (sin duplicar): ${totalProposals}`);
console.log(`Colisiones con servicios existentes (debe ser 0): ${collisions}`);
console.log(`Contratos con propuestas pero SIN sucursal clara: ${sinSucursal}`);
console.log(`Contratos sin frecuencia válida: ${sinFrecuencia}`);
console.log(`Propuestas en un MES que ya tiene servicio (casi-dup): ${nearDup}`);
console.log(`Propuestas posteriores al último servicio (roll-forward): ${rollForwardOnly}`);
console.log(`\nMuestra de posibles casi-duplicados:`);
for (const s of nearDupSamples) console.log("  " + s);
console.log(`\nMuestra:`);
for (const s of samples) console.log("  " + s);

await db.end();
