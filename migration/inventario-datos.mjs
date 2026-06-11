// Inventario de datos: qué hay HOY en Firestore (v1) y en Supabase (v2).
// SOLO LECTURA. Uso: node migration/inventario-datos.mjs
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import admin from "firebase-admin";
import pg from "pg";

const SECRETS_DIR = "C:\\Users\\carlo\\serfuplagapp-v2\\Secretos";
const keyFile = readdirSync(SECRETS_DIR).find((f) => f.toLowerCase().endsWith(".json"));
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(readFileSync(path.join(SECRETS_DIR, keyFile), "utf8"))),
});
const fs = admin.firestore();

console.log("════════ FIRESTORE (v1) — colecciones y cantidad de documentos ════════");
const cols = await fs.listCollections();
const fsRows = [];
for (const c of cols.sort((a, b) => a.id.localeCompare(b.id))) {
  try {
    const agg = await c.count().get();
    fsRows.push({ coleccion: c.id, docs: agg.data().count });
  } catch {
    fsRows.push({ coleccion: c.id, docs: "?" });
  }
}
console.table(fsRows);

console.log("\n════════ SUPABASE (v2) — tablas y cantidad de filas ════════");
const cs = readFileSync(path.join(SECRETS_DIR, "..", "Secretos", "db.txt"), "utf8").trim();
const db = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
await db.connect();
const { rows: tables } = await db.query(`
  select tablename from pg_tables where schemaname = 'public' order by tablename`);
const sbRows = [];
for (const t of tables) {
  const r = await db.query(`select count(*)::int n from public."${t.tablename}"`);
  sbRows.push({ tabla: t.tablename, filas: r.rows[0].n });
}
console.table(sbRows);
await db.end();
process.exit(0);
