// Diagnóstico de ordenes_trabajo + programas_servicio (SOLO LECTURA).
// Para planear la importación de historia desde el 1-may-2026.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import admin from "firebase-admin";

const SECRETS = "C:\\Users\\carlo\\serfuplagapp-v2\\Secretos";
const keyFile = readdirSync(SECRETS).find((f) => f.toLowerCase().endsWith(".json"));
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(path.join(SECRETS, keyFile), "utf8"))) });
const db = admin.firestore();

const CUT = new Date(2026, 4, 1); // 1-may-2026 local

const typeOf = (v) =>
  v == null ? "vacío"
  : v instanceof admin.firestore.Timestamp ? "fecha"
  : Array.isArray(v) ? "lista"
  : typeof v === "object" ? "objeto"
  : typeof v;
const toDate = (v) => {
  if (!v) return null;
  if (v instanceof admin.firestore.Timestamp) return v.toDate();
  const d = new Date(v);
  return isNaN(d) ? null : d;
};
const mask = (k, v) => {
  if (v == null) return "∅";
  if (v instanceof admin.firestore.Timestamp) return v.toDate().toISOString().slice(0, 10);
  if (Array.isArray(v)) return `[${v.length}]`;
  if (typeof v === "object") return JSON.stringify(v).slice(0, 50);
  let s = String(v);
  if (/rut|fono|mail|correo/i.test(k) && s.length > 4) s = s.slice(0, 4) + "…";
  return s.length > 40 ? s.slice(0, 40) + "…" : s;
};
function profile(docs) {
  const f = {};
  for (const d of docs)
    for (const [k, v] of Object.entries(d)) {
      if (!f[k]) f[k] = { n: 0, types: new Set(), ex: [] };
      f[k].n++;
      f[k].types.add(typeOf(v));
      if (f[k].ex.length < 2 && v != null && v !== "") {
        const m = mask(k, v);
        if (!f[k].ex.includes(m)) f[k].ex.push(m);
      }
    }
  for (const k of Object.keys(f).sort()) {
    const x = f[k];
    console.log(`   • ${k.padEnd(22)} ${String(Math.round((x.n / docs.length) * 100)).padStart(3)}%  [${[...x.types].join(",")}]  ${x.ex.join(" | ")}`);
  }
}
const find = (keys, re) => [...keys].find((k) => re.test(k));

async function review(name) {
  const snap = await db.collection(name).get();
  const docs = snap.docs.map((d) => ({ _id: d.id, ...d.data() }));
  console.log(`\n================ ${name} — ${docs.length} docs ================`);
  profile(docs);
  return docs;
}

const ots = await review("ordenes_trabajo");
const keys = new Set();
ots.forEach((o) => Object.keys(o).forEach((k) => keys.add(k)));
const fFecha = find(keys, /fecha_programada|fecha_servicio|^fecha$|programad/i);
const fCliente = find(keys, /cliente_id|clienteid/i);
const fPrograma = find(keys, /programa/i);
const fEstado = find(keys, /^estado|estado_op|estado_ot/i);
const fTec = find(keys, /tecnico|tecnicos_ids/i);
const fEstab = find(keys, /establecimiento|sucursal/i);
console.log(`\nCampos clave OT → fecha:"${fFecha}" cliente:"${fCliente}" programa:"${fPrograma}" estado:"${fEstado}" técnicos:"${fTec}" sucursal:"${fEstab}"`);

const desdeMayo = ots.filter((o) => { const d = toDate(o[fFecha]); return d && d >= CUT; });
const fechas = ots.map((o) => toDate(o[fFecha])).filter(Boolean).sort((a, b) => a - b);
console.log(`OT con fecha válida: ${fechas.length} · rango: ${fechas[0]?.toISOString().slice(0, 10)} → ${fechas.at(-1)?.toISOString().slice(0, 10)}`);
console.log(`OT con fecha >= 1-may-2026: ${desdeMayo.length}`);
const estados = {};
ots.forEach((o) => { const e = String(o[fEstado] ?? "?"); estados[e] = (estados[e] || 0) + 1; });
console.log(`Estados (todas): ${JSON.stringify(estados)}`);
console.log(`OT con ${fCliente}: ${ots.filter((o) => o[fCliente]).length} · ${fPrograma}: ${ots.filter((o) => o[fPrograma]).length} · ${fTec}: ${ots.filter((o) => Array.isArray(o[fTec]) && o[fTec].length).length}`);

// ¿Las OT enlazan con las fichas de cliente que exportamos?
const exportsDir = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "exports");
const fecha = existsSync(exportsDir) ? readdirSync(exportsDir).filter((f) => existsSync(path.join(exportsDir, f, "raw", "clientes.json"))).sort().reverse()[0] : null;
if (fecha) {
  const raw = JSON.parse(readFileSync(path.join(exportsDir, fecha, "raw", "clientes.json"), "utf8"));
  const ids = new Set(raw.map((c) => c._id));
  const m = ots.filter((o) => ids.has(o[fCliente])).length;
  console.log(`OT cuyo ${fCliente} calza con una ficha v1 exportada: ${m} de ${ots.filter((o) => o[fCliente]).length}`);
}

const progs = await review("programas_servicio");
const pkeys = new Set();
progs.forEach((p) => Object.keys(p).forEach((k) => pkeys.add(k)));
console.log(`\nCampos clave Programa → cliente:"${find(pkeys, /cliente/i)}" frecuencia:"${find(pkeys, /frec|periodic/i)}" modo:"${find(pkeys, /modo|visita/i)}" precio:"${find(pkeys, /precio|valor|monto/i)}" activo:"${find(pkeys, /activo|estado/i)}"`);
console.log(`Programas activos: ${progs.filter((p) => p.activo === true || /activo|vigente/i.test(String(p.estado ?? ""))).length}`);

await db.terminate?.();
console.log("\n✅ Diagnóstico OT/Programas listo (solo lectura).");
process.exit(0);
