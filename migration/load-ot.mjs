// =============================================================================
// Carga a Supabase: programas_servicio → contracts, ordenes_trabajo(>=1-may) →
// services. TODO en una transacción. Preserva la data de certificados en
// services.legacy_data y enlaza por legacy_id. Aditivo. Lee raw + preview locales.
// =============================================================================
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import pg from "pg";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1"));
const connectionString = readFileSync("C:\\Users\\carlo\\serfuplagapp-v2\\Secretos\\db.txt", "utf8").trim();
const exportsDir = path.join(HERE, "exports");
const fechaDir = readdirSync(exportsDir).filter((f) => existsSync(path.join(exportsDir, f, "raw", "ordenes_trabajo.json"))).sort().reverse()[0];
const raw = (n) => JSON.parse(readFileSync(path.join(exportsDir, fechaDir, "raw", n), "utf8"));
const pv = (n) => JSON.parse(readFileSync(path.join(exportsDir, fechaDir, "preview", n), "utf8"));

const ots = raw("ordenes_trabajo.json");
const progs = raw("programas_servicio.json");
const sucursales = pv("sucursales_v2.json");
const clientesV2 = pv("clientes_v2.json");

const CUT = new Date(2026, 4, 1);
const txt = (v) => (v == null ? "" : String(v).trim());
const num = (v) => { const n = Number(v); return Number.isNaN(n) ? null : Math.round(n); };
const dateOnly = (v) => { const m = txt(v).match(/^\d{4}-\d{2}-\d{2}/); return m ? m[0] : null; };
const validTime = (v) => (/^\d{1,2}:\d{2}/.test(txt(v)) ? txt(v).slice(0, 5) : null);
const validTs = (v) => { const s = txt(v); return s && !Number.isNaN(new Date(s).getTime()) ? s : null; };

const DIAS_FREC = { 7: "Semanal", 14: "Quincenal", 30: "Mensual", 60: "Bimestral", 90: "Trimestral", 120: "Cuatrimestral", 180: "Semestral", 365: "Anual" };
const AGENDA = { conf: "confirmado", prog: "programado", envi: "enviado", reprog: "reprogramado", canc: "cancelado", prop: "propuesto", propuesta: "propuesto" };
const FIELD = { terminada: "terminada", terminado: "terminada", propuesta: "planificada", planificada: "planificada", asignada: "asignada", en_proceso: "en_proceso", por_validar: "por_validar", confirmada: "asignada" };
const CERT_FIELDS = ["folio", "genera_certificado", "cert_por_unidad", "certificado_enviado", "plagas_detectadas", "productos_usados", "areas_tratadas", "areas_tratadas_arr", "grado_infestacion", "nombre_firmante", "rut_firmante", "observaciones", "recomendaciones", "trabajo_realizado", "metodologia", "insumos", "unidades_atendidas", "tipo_visita", "tipo_visita_label", "servicios", "precio_acordado", "contrato_nombre", "tecnicos_ids", "tecnico_nombre", "rut_cliente", "direccion", "comuna", "fecha_inicio_real", "checkin_hora", "checkout_hora"];

function matchTypeName(name) {
  const t = (name || "").toLowerCase();
  if (/cucaracha/.test(t)) return "Control de Cucarachas";
  if (/paloma/.test(t)) return "Control de Palomas";
  if (/aromatiz/.test(t)) return "Aromatización";
  if (/sanitiz|desinfec/.test(t)) return "Sanitización/Desinfección";
  if (/desinsect|insecto|mosca|zancudo|hormiga|avispa|termita|polilla/.test(t)) return "Desinsectación";
  return "Desratización";
}

async function insertBatch(db, table, cols, rows) {
  const CHUNK = 400;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const params = [];
    const tuples = slice.map((row) => {
      const ph = cols.map((c) => { params.push(row[c] ?? null); return `$${params.length}`; });
      return `(${ph.join(",")})`;
    });
    if (tuples.length) await db.query(`insert into public.${table} (${cols.join(",")}) values ${tuples.join(",")}`, params);
  }
}

const db = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
await db.connect();
try {
  const tenant = (await db.query("select id from public.tenants where name='Serfuplagas Ltda.'")).rows[0].id;
  const before = {
    contracts: (await db.query("select count(*)::int n from public.contracts")).rows[0].n,
    services: (await db.query("select count(*)::int n from public.services")).rows[0].n,
  };
  console.log(`Antes → contracts:${before.contracts} services:${before.services}`);
  if (before.services > 50 && !process.argv.includes("--force")) throw new Error(`Ya hay ${before.services} servicios; aborto (usa --force).`);

  // Tipos de servicio (nombre → id)
  const stRows = (await db.query("select id, name from public.service_types where tenant_id=$1", [tenant])).rows;
  const stByName = new Map(stRows.map((r) => [r.name, r.id]));
  const defaultST = stByName.get("Desratización") ?? stRows[0].id;
  const resolveST = (name) => stByName.get(matchTypeName(name)) ?? defaultST;

  // Sucursales: (name|address) → {branchId, clientId}; ficha Firestore → branch
  const brRows = (await db.query("select id, client_id, name, coalesce(address,'') address from public.branches where tenant_id=$1", [tenant])).rows;
  const brByKey = new Map(brRows.map((r) => [`${r.name}|${r.address}`, { branchId: r.id, clientId: r.client_id }]));
  const fichaMap = new Map();
  const branchLegacy = [];
  for (const b of sucursales) {
    const hit = brByKey.get(`${b.name}|${b.address ?? ""}`);
    if (hit) { fichaMap.set(b._v1_id, hit); branchLegacy.push([hit.branchId, b._v1_id]); }
  }
  console.log(`Fichas v1 mapeadas a sucursal: ${fichaMap.size} de ${sucursales.length}`);

  // Clientes: rut → id (para legacy_id por la cabeza)
  const clRows = (await db.query("select id, rut from public.clients where tenant_id=$1", [tenant])).rows;
  const clByRut = new Map(clRows.filter((r) => r.rut).map((r) => [r.rut, r.id]));

  await db.query("begin");

  // Backfill legacy_id
  for (const [bid, fid] of branchLegacy) await db.query("update public.branches set legacy_id=$1 where id=$2 and legacy_id is null", [fid, bid]);
  for (const c of clientesV2) {
    const id = c.rut ? clByRut.get(c.rut) : null;
    if (id) await db.query("update public.clients set legacy_id=$1 where id=$2 and legacy_id is null", [c._v1_id, id]);
  }

  // CONTRACTS
  const contractByLegacy = new Map();
  const contractRows = [];
  let progsSinCliente = 0;
  for (const p of progs) {
    if (p.activo !== true) continue;
    const ficha = fichaMap.get(p.cliente_id);
    if (!ficha) { progsSinCliente++; continue; }
    const id = randomUUID();
    contractByLegacy.set(p._id, id);
    const mv = p.modo_visita && typeof p.modo_visita === "object" ? p.modo_visita : {};
    const vp = {};
    for (const k of ["n", "dow", "dia", "dia1", "dia2"]) if (typeof mv[k] === "number") vp[k] = mv[k];
    if (vp.dia == null && typeof p.dia_mes === "number") vp.dia = p.dia_mes;
    if (vp.dow == null && typeof p.dia_semana === "number") vp.dow = p.dia_semana;
    if (vp.n == null && typeof p.semana_x === "number") vp.n = p.semana_x;
    if (vp.dia1 == null && typeof p.dia_n1 === "number") vp.dia1 = p.dia_n1;
    if (vp.dia2 == null && typeof p.dia_n2 === "number") vp.dia2 = p.dia_n2;
    const allowed = Array.isArray(p.dias_permitidos) ? p.dias_permitidos.filter((d) => typeof d === "number") : [];
    const primary = Array.isArray(p.servicios) && p.servicios.length ? p.servicios[0] : p.nombre;
    contractRows.push({
      id, tenant_id: tenant, client_id: ficha.clientId,
      service_type_id: resolveST(typeof primary === "string" ? primary : txt(p.nombre)),
      frequency: DIAS_FREC[p.frecuencia_dias] ?? (p.frecuencia_dias ? String(p.frecuencia_dias) : null),
      current_price: num(p.precio_acordado),
      start_date: dateOnly(p.fecha_inicio_programa), end_date: dateOnly(p.fecha_termino),
      status: "vigente",
      visit_mode: txt(mv.tipo) || txt(p.tipo_periodicidad) || null,
      visit_params: JSON.stringify(vp),
      allowed_days: allowed.length ? allowed : null,
      preferred_time: validTime(p.hora_desde),
      legacy_id: p._id,
    });
  }
  await insertBatch(db, "contracts", ["id", "tenant_id", "client_id", "service_type_id", "frequency", "current_price", "start_date", "end_date", "status", "visit_mode", "visit_params", "allowed_days", "preferred_time", "legacy_id"], contractRows);
  console.log(`✓ ${contractRows.length} contratos (programas sin cliente omitidos: ${progsSinCliente})`);

  // SERVICES (OT >= 1-may)
  const serviceRows = [];
  const huerfanas = [];
  let maxFolio = 0;
  for (const o of ots) {
    const d = o.fecha_programada ? new Date(o.fecha_programada) : null;
    if (!d || Number.isNaN(d.getTime()) || d < CUT) continue;
    const ficha = fichaMap.get(o.cliente_id);
    if (!ficha) { huerfanas.push({ id: o._id, cliente: txt(o.cliente_nombre) }); continue; }
    const servName = Array.isArray(o.servicios) && o.servicios.length ? o.servicios[0] : txt(o.contrato_nombre);
    const legacy_data = {};
    for (const f of CERT_FIELDS) if (o[f] != null && o[f] !== "") legacy_data[f] = o[f];
    const fol = num(o.folio);
    if (fol && fol > maxFolio && fol < 100000) maxFolio = fol;
    const field_status = FIELD[txt(o.estado_op)] ?? "planificada";
    serviceRows.push({
      id: randomUUID(), tenant_id: tenant, client_id: ficha.clientId, branch_id: ficha.branchId,
      contract_id: contractByLegacy.get(o.programa_id) ?? contractByLegacy.get(o.contrato_id) ?? null,
      service_type_id: resolveST(typeof servName === "string" ? servName : ""),
      scheduled_at: validTs(o.fecha_programada),
      agenda_status: AGENDA[txt(o.estado_cal)] ?? "programado",
      field_status,
      completed_at: field_status === "terminada" ? (validTs(o.checkout_hora) ?? validTs(o.actualizada_en)) : null,
      notes: txt(o.observaciones) || null,
      legacy_id: o._id,
      legacy_data: JSON.stringify(legacy_data),
    });
  }
  await insertBatch(db, "services", ["id", "tenant_id", "client_id", "branch_id", "contract_id", "service_type_id", "scheduled_at", "agenda_status", "field_status", "completed_at", "notes", "legacy_id", "legacy_data"], serviceRows);
  console.log(`✓ ${serviceRows.length} servicios (huérfanas omitidas: ${huerfanas.length}) · folio máx preservado: ${maxFolio}`);

  // Validación
  const after = {
    contracts: (await db.query("select count(*)::int n from public.contracts")).rows[0].n,
    services: (await db.query("select count(*)::int n from public.services")).rows[0].n,
  };
  const huerf = (await db.query("select count(*)::int n from public.services s left join public.clients c on c.id=s.client_id where c.id is null")).rows[0].n;
  console.log(`Después → contracts:${after.contracts} services:${after.services} · servicios huérfanos en BD: ${huerf}`);
  if (huerf !== 0) throw new Error("Hay servicios sin cliente; reviso.");
  if (after.services - before.services !== serviceRows.length) throw new Error("El conteo de servicios no cuadra.");

  await db.query("commit");
  console.log("\n✅ Carga CONFIRMADA (commit). Contratos y servicios desde 1-may en producción.");
} catch (e) {
  await db.query("rollback").catch(() => {});
  console.error(`\n❌ Error — rollback, nada quedó cargado.\n   ${e.message}`);
  process.exitCode = 1;
} finally {
  await db.end();
}
