// =============================================================================
// Export SOLO LECTURA de la v1 para la importación Fase 3:
// layouts, certificados, cobros, facturas, pagos, productos, plagas,
// textos_predefinidos y empresa_config.
// Los archivos quedan en migration/exports/<fecha>/raw/ (ignorado por git).
// Uso: node migration/export-fase3.mjs
// =============================================================================
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import admin from "firebase-admin";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1"));
const SECRETS_DIR = "C:\\Users\\carlo\\serfuplagapp-v2\\Secretos";
const keyFile = readdirSync(SECRETS_DIR).find((f) => f.toLowerCase().endsWith(".json"));
const serviceAccount = JSON.parse(readFileSync(path.join(SECRETS_DIR, keyFile), "utf8"));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

function serialize(v) {
  if (v === null || v === undefined) return v;
  if (v instanceof admin.firestore.Timestamp) return v.toDate().toISOString();
  if (v instanceof admin.firestore.GeoPoint) return { _geo: true, lat: v.latitude, lng: v.longitude };
  if (Array.isArray(v)) return v.map(serialize);
  if (typeof v === "object") {
    const o = {};
    for (const [k, val] of Object.entries(v)) o[k] = serialize(val);
    return o;
  }
  return v;
}

const fecha = new Date().toISOString().slice(0, 10);
const rawDir = path.join(HERE, "exports", fecha, "raw");
mkdirSync(rawDir, { recursive: true });

const COLS = [
  "layouts",
  "certificados",
  "cobros",
  "facturas",
  "pagos",
  "productos",
  "plagas",
  "textos_predefinidos",
  "empresa_config",
];

for (const col of COLS) {
  const snap = await db.collection(col).get();
  const docs = snap.docs.map((d) => ({ _id: d.id, ...serialize(d.data()) }));
  const file = path.join(rawDir, `${col}.json`);
  writeFileSync(file, JSON.stringify(docs, null, 2), "utf8");
  const kb = Math.round(Buffer.byteLength(JSON.stringify(docs)) / 1024);
  console.log(`✅ ${col}: ${docs.length} docs (${kb} KB)`);
}

console.log(`\nListo → migration/exports/${fecha}/raw/ (solo lectura, la v1 no se tocó)`);
process.exit(0);
