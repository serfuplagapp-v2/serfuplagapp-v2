// =============================================================================
// Vista previa de importación: programas_servicio → contracts, y
// ordenes_trabajo (>= 1-may-2026) → services.  SOLO LECTURA + archivos locales.
// No carga nada en Supabase. Genera CSV/JSON para que Carlos revise.
// =============================================================================
import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import admin from "firebase-admin";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1"));
const SECRETS = "C:\\Users\\carlo\\serfuplagapp-v2\\Secretos";
const CUT = new Date(2026, 4, 1); // 1-may-2026

const keyFile = readdirSync(SECRETS).find((f) => f.toLowerCase().endsWith(".json"));
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(path.join(SECRETS, keyFile), "utf8"))) });
const db = admin.firestore();

const serialize = (v) => {
  if (v == null) return v;
  if (v instanceof admin.firestore.Timestamp) return v.toDate().toISOString();
  if (Array.isArray(v)) return v.map(serialize);
  if (typeof v === "object") { const o = {}; for (const [k, x] of Object.entries(v)) o[k] = serialize(x); return o; }
  return v;
};
const fetchAll = async (name) => (await db.collection(name).get()).docs.map((d) => ({ _id: d.id, ...serialize(d.data()) }));

const txt = (v) => (v == null ? "" : String(v).trim());
const toISODate = (v) => { if (!v) return null; const d = new Date(v); return isNaN(d) ? null : d.toISOString().slice(0, 10); };

// --- localizar carpeta de exports con la preview de clientes ya hecha ---------
const exportsDir = path.join(HERE, "exports");
const fechaDir = readdirSync(exportsDir).filter((f) => existsSync(path.join(exportsDir, f, "preview", "sucursales_v2.json"))).sort().reverse()[0];
const pv = (n) => JSON.parse(readFileSync(path.join(exportsDir, fechaDir, "preview", n), "utf8"));
const sucursales = pv("sucursales_v2.json"); // {_v1_id, _clientKey, name, address}
const clientesV2 = pv("clientes_v2.json");   // {_key, name, rut}
const clientByKey = new Map(clientesV2.map((c) => [c._key, c]));

// ficha Firestore (_v1_id) → { branchName, clientName, clientKey }
const fichaMap = new Map();
for (const b of sucursales) {
  const cli = clientByKey.get(b._clientKey);
  fichaMap.set(b._v1_id, { branchName: b.name, clientName: cli?.name ?? "", clientKey: b._clientKey });
}

// --- export raw ---------------------------------------------------------------
const ots = await fetchAll("ordenes_trabajo");
const progs = await fetchAll("programas_servicio");
const rawDir = path.join(exportsDir, fechaDir, "raw");
mkdirSync(rawDir, { recursive: true });
writeFileSync(path.join(rawDir, "ordenes_trabajo.json"), JSON.stringify(ots, null, 1), "utf8");
writeFileSync(path.join(rawDir, "programas_servicio.json"), JSON.stringify(progs, null, 1), "utf8");

// --- mapeos -------------------------------------------------------------------
const DIAS_FREC = { 7: "Semanal", 14: "Quincenal", 30: "Mensual", 60: "Bimestral", 90: "Trimestral", 120: "Cuatrimestral", 180: "Semestral", 365: "Anual" };
const AGENDA = { conf: "confirmado", prog: "programado", envi: "enviado", reprog: "reprogramado", canc: "cancelado", prop: "propuesto", propuesta: "propuesto" };
const FIELD = { terminada: "terminada", terminado: "terminada", propuesta: "planificada", planificada: "planificada", asignada: "asignada", en_proceso: "en_proceso", por_validar: "por_validar", confirmada: "asignada" };

// --- programas → contracts ----------------------------------------------------
const contracts = [];
const progsSinCliente = [];
for (const p of progs) {
  if (p.activo !== true) continue;
  const ficha = fichaMap.get(p.cliente_id);
  if (!ficha) { progsSinCliente.push(txt(p.nombre) || p._id); continue; }
  const mv = p.modo_visita && typeof p.modo_visita === "object" ? p.modo_visita : {};
  const visit_mode = txt(mv.tipo) || txt(p.tipo_periodicidad) || null;
  const visit_params = {};
  for (const k of ["n", "dow", "dia", "dia1", "dia2"]) if (mv[k] != null) visit_params[k] = mv[k];
  if (visit_params.dia == null && p.dia_mes != null) visit_params.dia = p.dia_mes;
  contracts.push({
    _v1_id: p._id, clientName: ficha.clientName, clientKey: ficha.clientKey,
    nombre: txt(p.nombre), frequency: DIAS_FREC[p.frecuencia_dias] ?? String(p.frecuencia_dias ?? ""),
    visit_mode, current_price: Number(p.precio_acordado) || null,
    start_date: toISODate(p.fecha_inicio_programa), end_date: toISODate(p.fecha_termino),
    preferred_time: txt(p.hora_desde) || null,
  });
}

// --- ordenes_trabajo (>= 1-may) → services -----------------------------------
const services = [];
const otsHuerfanas = [];
let otTotal = 0, otDesdeMayo = 0;
for (const o of ots) {
  const d = o.fecha_programada ? new Date(o.fecha_programada) : null;
  if (!d || isNaN(d)) continue;
  otTotal++;
  if (d < CUT) continue;
  otDesdeMayo++;
  const ficha = fichaMap.get(o.cliente_id);
  if (!ficha) { otsHuerfanas.push({ cliente: txt(o.cliente_nombre), fecha: toISODate(o.fecha_programada) }); continue; }
  services.push({
    _v1_id: o._id, clientName: ficha.clientName, branchName: ficha.branchName,
    date: toISODate(o.fecha_programada),
    agenda_status: AGENDA[txt(o.estado_cal)] ?? "programado",
    field_status: FIELD[txt(o.estado_op)] ?? "planificada",
    nServicios: Array.isArray(o.servicios) ? o.servicios.length : 0,
    precio: Number(o.precio_acordado) || 0,
    contrato: txt(o.contrato_nombre),
  });
}

// --- salidas ------------------------------------------------------------------
const outDir = path.join(exportsDir, fechaDir, "preview");
const W = (n, d) => writeFileSync(path.join(outDir, n), JSON.stringify(d, null, 2), "utf8");
W("contracts_v2.json", contracts);
W("services_v2.json", services);

const csv = (rows, cols) => "﻿" + cols.map((c) => `"${c.h}"`).join(",") + "\r\n" +
  rows.map((r) => cols.map((c) => `"${String(c.f(r) ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
writeFileSync(path.join(outDir, "servicios.csv"), csv(services, [
  { h: "Cliente", f: (r) => r.clientName }, { h: "Sucursal", f: (r) => r.branchName },
  { h: "Fecha", f: (r) => r.date }, { h: "Agenda", f: (r) => r.agenda_status },
  { h: "Terreno", f: (r) => r.field_status }, { h: "Contrato", f: (r) => r.contrato }, { h: "Precio", f: (r) => r.precio },
]), "utf8");
writeFileSync(path.join(outDir, "contratos.csv"), csv(contracts, [
  { h: "Cliente", f: (r) => r.clientName }, { h: "Programa", f: (r) => r.nombre },
  { h: "Frecuencia", f: (r) => r.frequency }, { h: "Modo", f: (r) => r.visit_mode },
  { h: "Precio", f: (r) => r.current_price }, { h: "Inicio", f: (r) => r.start_date },
]), "utf8");

const agendaDist = {}, fieldDist = {};
services.forEach((s) => { agendaDist[s.agenda_status] = (agendaDist[s.agenda_status] || 0) + 1; fieldDist[s.field_status] = (fieldDist[s.field_status] || 0) + 1; });
const totalServicios = services.reduce((a, s) => a + s.precio, 0);

console.log(`\n===== VISTA PREVIA — IMPORTACIÓN OT/PROGRAMAS (desde 1-may-2026) =====`);
console.log(`\nCONTRATOS (desde programas activos):`);
console.log(`  → a importar: ${contracts.length}`);
console.log(`  → programas sin cliente que calce: ${progsSinCliente.length}${progsSinCliente.length ? " ej: " + progsSinCliente.slice(0, 3).join("; ") : ""}`);
console.log(`\nSERVICIOS (órdenes de trabajo):`);
console.log(`  OT totales con fecha: ${otTotal} · desde 1-may: ${otDesdeMayo}`);
console.log(`  → a importar (con cliente): ${services.length}`);
console.log(`  → HUÉRFANAS (sin cliente que calce): ${otsHuerfanas.length}${otsHuerfanas.length ? " ej: " + otsHuerfanas.slice(0, 3).map((h) => h.cliente).join("; ") : ""}`);
console.log(`  cuadre: ${services.length} + ${otsHuerfanas.length} huérfanas = ${services.length + otsHuerfanas.length} (debe ser ${otDesdeMayo}) ${services.length + otsHuerfanas.length === otDesdeMayo ? "✅" : "❌"}`);
console.log(`  Estado AGENDA: ${JSON.stringify(agendaDist)}`);
console.log(`  Estado TERRENO: ${JSON.stringify(fieldDist)}`);
console.log(`  Suma precios servicios: $${totalServicios.toLocaleString("es-CL")}`);
console.log(`\n💾 Vista previa en: migration/exports/${fechaDir}/preview/ (contratos.csv, servicios.csv, *_v2.json)`);
process.exit(0);
