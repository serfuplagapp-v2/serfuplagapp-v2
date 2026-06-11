// =============================================================================
// Diagnóstico SOLO LECTURA de la v1 (Firestore) para la importación Fase 3:
// layouts, estaciones, certificados, facturación (cobros/facturas/pagos) y
// catálogos (productos, plagas, textos). No modifica nada.
// Uso: node migration/diagnose-fase3.mjs
// =============================================================================
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import admin from "firebase-admin";

const SECRETS_DIR = "C:\\Users\\carlo\\serfuplagapp-v2\\Secretos";
const keyFile = readdirSync(SECRETS_DIR).find((f) => f.toLowerCase().endsWith(".json"));
const serviceAccount = JSON.parse(readFileSync(path.join(SECRETS_DIR, keyFile), "utf8"));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// 1) Listar TODAS las colecciones raíz con su tamaño (count aggregate, barato).
const cols = await db.listCollections();
console.log("— Colecciones raíz de la v1 —");
const counts = [];
for (const c of cols) {
  const agg = await c.count().get();
  counts.push({ col: c.id, n: agg.data().count });
}
counts.sort((a, b) => b.n - a.n);
console.table(counts);

// 2) Detalle de las colecciones objetivo: muestra de campos + fechas.
const TARGETS = [
  "layouts", "estaciones", "certificados", "cobros", "facturas", "pagos",
  "productos", "plagas", "textos", "catalogos", "empresa_config", "casos_slip",
  "unidades", "plantillas_correo",
];
const existentes = new Set(counts.map((c) => c.col));

for (const t of TARGETS) {
  if (!existentes.has(t)) {
    console.log(`\n— ${t}: NO existe como colección raíz —`);
    continue;
  }
  const snap = await db.collection(t).limit(3).get();
  console.log(`\n— ${t} (muestra de campos) —`);
  for (const d of snap.docs) {
    const data = d.data();
    const campos = Object.entries(data)
      .map(([k, v]) => {
        const tipo = v instanceof admin.firestore.Timestamp ? "ts"
          : Array.isArray(v) ? `arr[${v.length}]`
          : typeof v === "object" && v !== null ? "obj"
          : typeof v;
        return `${k}:${tipo}`;
      })
      .sort()
      .join(", ");
    console.log(`  [${d.id.slice(0, 10)}] ${campos.slice(0, 700)}`);
  }
}

// 3) Conteos con corte 1-may-2026 para lo transaccional.
console.log("\n— Conteos transaccionales (todo vs ≥ 2026-05-01) —");
const cortes = [
  ["certificados", ["fecha_emision", "creado_en", "fecha"]],
  ["cobros", ["periodo", "fecha_creacion", "creado_en"]],
  ["facturas", ["fecha_emision", "creado_en"]],
  ["pagos", ["fecha_pago", "creado_en"]],
];
for (const [colName, dateFields] of cortes) {
  if (!existentes.has(colName)) continue;
  const all = (await db.collection(colName).count().get()).data().count;
  let line = `${colName}: total=${all}`;
  for (const f of dateFields) {
    try {
      // Probar como Timestamp y como string ISO/period.
      const desdeTs = admin.firestore.Timestamp.fromDate(new Date("2026-05-01T00:00:00Z"));
      const nTs = (await db.collection(colName).where(f, ">=", desdeTs).count().get()).data().count;
      const nStr = (await db.collection(colName).where(f, ">=", "2026-05").count().get()).data().count;
      line += ` · ${f}: ts≥may=${nTs} str≥may=${nStr}`;
    } catch (e) {
      line += ` · ${f}: (err ${e.code ?? e.message?.slice(0, 30)})`;
    }
  }
  console.log(line);
}

// 4) Folio máximo en certificados (para validar continuidad 30697).
if (existentes.has("certificados")) {
  const snap = await db.collection("certificados").orderBy("folio", "desc").limit(3).get();
  console.log("\n— Certificados: folios más altos —");
  for (const d of snap.docs) {
    const x = d.data();
    console.log(`  folio=${x.folio} ot=${x.ot_id ?? "?"} fecha=${x.fecha_emision ?? x.creado_en ?? "?"}`);
  }
}

console.log("\n✅ Diagnóstico listo (solo lectura).");
process.exit(0);
