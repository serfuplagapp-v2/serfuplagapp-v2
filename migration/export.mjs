// =============================================================================
// Serfuplagapp v2 — Export de la v1 (Firestore)  ·  SOLO LECTURA
// Descarga la colección "clientes" completa a un archivo JSON local con fecha.
// NO modifica la v1. El archivo queda en migration/exports/<fecha>/raw/ (ignorado por git).
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

// Convierte tipos especiales de Firestore (fechas, geopuntos) a JSON limpio.
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

const snap = await db.collection("clientes").get();
const docs = snap.docs.map((d) => ({ _id: d.id, ...serialize(d.data()) }));
writeFileSync(path.join(rawDir, "clientes.json"), JSON.stringify(docs, null, 2), "utf8");

console.log(`✅ Exportados ${docs.length} clientes → migration/exports/${fecha}/raw/clientes.json`);
console.log("   (solo lectura — no se modificó nada en la v1)");
process.exit(0);
