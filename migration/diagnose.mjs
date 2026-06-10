// =============================================================================
// Serfuplagapp v2 — Diagnóstico de la v1 (Firestore)  ·  SOLO LECTURA
// -----------------------------------------------------------------------------
// Objetivo: mirar la estructura REAL de los datos de la v1 antes de importar.
//   · Lista las colecciones de Firestore y cuenta los documentos.
//   · Perfila los CAMPOS de cada colección (nombre, tipo, % de llenado, ejemplos).
//   · Detecta subcolecciones (ej: contactos colgando de cada cliente).
//   · Analiza el agrupamiento de SUCURSALES por RUT (sucursal:true → casa matriz).
//
// NO modifica ni borra NADA en la v1. Solo lee.
// Guarda una muestra en migration/exports/<fecha>/ (carpeta ignorada por git).
// =============================================================================

import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import admin from "firebase-admin";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1"));
const SECRETS_DIR = "C:\\Users\\carlo\\serfuplagapp-v2\\Secretos";

// --- Límites de seguridad (solo lectura, pero acotamos por si acaso) ----------
const SAMPLE_PER_COLLECTION = 25; // docs muestreados para perfilar campos
const MAX_DOCS_FOR_GROUPING = 20000; // tope al analizar agrupación por RUT
const CLIENT_SUBCOLLECTION_SAMPLE = 30; // clientes de los que miramos contactos
const EXAMPLES_PER_FIELD = 2; // ejemplos por campo en el perfil

// -----------------------------------------------------------------------------
// 1) Cargar la llave de servicio (cualquier .json dentro de Secretos/)
// -----------------------------------------------------------------------------
const keyFile = readdirSync(SECRETS_DIR).find((f) => f.toLowerCase().endsWith(".json"));
if (!keyFile) {
  console.error(`No encontré ninguna llave .json en ${SECRETS_DIR}`);
  process.exit(1);
}
const serviceAccount = JSON.parse(readFileSync(path.join(SECRETS_DIR, keyFile), "utf8"));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
console.log(`\n🔑 Llave: ${keyFile}`);
console.log(`📦 Proyecto v1: ${serviceAccount.project_id}\n`);

// -----------------------------------------------------------------------------
// Utilidades de perfilado
// -----------------------------------------------------------------------------
function typeOf(v) {
  if (v === null || v === undefined) return "null/vacío";
  if (Array.isArray(v)) return "lista";
  if (v instanceof admin.firestore.Timestamp) return "fecha";
  if (v instanceof admin.firestore.GeoPoint) return "geopunto";
  if (v && typeof v === "object" && v._latitude !== undefined) return "geopunto";
  if (v && typeof v === "object" && v._path) return "referencia";
  if (typeof v === "object") return "objeto";
  return typeof v; // string | number | boolean
}

// Acorta y enmascara un valor para mostrarlo sin exponer datos completos.
function preview(field, v) {
  const f = field.toLowerCase();
  if (v === null || v === undefined) return "∅";
  if (v instanceof admin.firestore.Timestamp) return v.toDate().toISOString();
  if (Array.isArray(v)) return `[${v.length} elementos]`;
  if (typeof v === "object") return JSON.stringify(v).slice(0, 60);
  let s = String(v);
  if (/rut/.test(f) && s.length > 4) s = s.slice(0, 4) + "…" + s.slice(-2);
  else if (/(fono|phone|tel|celular|whats)/.test(f) && s.length > 4) s = s.slice(0, 3) + "…" + s.slice(-2);
  else if (/(mail|correo)/.test(f) && s.includes("@")) s = s.slice(0, 2) + "…@" + s.split("@")[1];
  return s.length > 45 ? s.slice(0, 45) + "…" : s;
}

function profileDocs(docs) {
  const fields = {}; // name -> { count, types:Set, examples:[] }
  for (const data of docs) {
    for (const [k, v] of Object.entries(data)) {
      if (!fields[k]) fields[k] = { count: 0, types: new Set(), examples: [] };
      fields[k].count++;
      fields[k].types.add(typeOf(v));
      if (fields[k].examples.length < EXAMPLES_PER_FIELD && v !== null && v !== undefined && v !== "") {
        const p = preview(k, v);
        if (!fields[k].examples.includes(p)) fields[k].examples.push(p);
      }
    }
  }
  return fields;
}

function printFieldProfile(fields, total) {
  const names = Object.keys(fields).sort();
  if (!names.length) {
    console.log("   (sin campos / colección vacía)");
    return;
  }
  for (const name of names) {
    const f = fields[name];
    const pct = total ? Math.round((f.count / total) * 100) : 0;
    const types = [...f.types].join(", ");
    const ex = f.examples.length ? `  ej: ${f.examples.join(" | ")}` : "";
    console.log(`   • ${name.padEnd(22)} ${String(pct).padStart(3)}% lleno  [${types}]${ex}`);
  }
}

const docDataArray = (snap) => snap.docs.map((d) => d.data());

// -----------------------------------------------------------------------------
// 2) Recorrer todas las colecciones de nivel superior
// -----------------------------------------------------------------------------
const report = { project: serviceAccount.project_id, collections: {} };

const topCollections = await db.listCollections();
console.log("=".repeat(78));
console.log(`COLECCIONES DE NIVEL SUPERIOR: ${topCollections.map((c) => c.id).join(", ")}`);
console.log("=".repeat(78));

let clientsCollName = null;

for (const col of topCollections) {
  const id = col.id;
  let total = 0;
  try {
    total = (await col.count().get()).data().count;
  } catch {
    total = NaN;
  }
  const sampleSnap = await col.limit(SAMPLE_PER_COLLECTION).get();
  const sample = docDataArray(sampleSnap);
  const fields = profileDocs(sample);

  console.log(`\n📁 ${id}  —  ${Number.isNaN(total) ? "?" : total} documentos  (muestra: ${sample.length})`);
  printFieldProfile(fields, sample.length);

  // ¿esta colección parece la de clientes? (tiene un campo tipo "sucursal")
  const hasSucursal = Object.keys(fields).some((k) => /sucursal/i.test(k));
  const looksLikeClients = id === "clientes" || id === "clients" || hasSucursal;
  if (looksLikeClients && !clientsCollName) clientsCollName = id;

  // Subcolecciones: mirar las de algunos documentos de la muestra
  const subFound = {}; // subId -> docsAcumulados
  for (const doc of sampleSnap.docs.slice(0, CLIENT_SUBCOLLECTION_SAMPLE)) {
    const subs = await doc.ref.listCollections();
    for (const sub of subs) {
      const sSnap = await sub.limit(10).get();
      if (!subFound[sub.id]) subFound[sub.id] = [];
      subFound[sub.id].push(...docDataArray(sSnap));
    }
  }
  for (const [subId, subDocs] of Object.entries(subFound)) {
    console.log(`   └─ subcolección "${subId}" (muestra ${subDocs.length} de varios documentos):`);
    const sf = profileDocs(subDocs);
    for (const name of Object.keys(sf).sort()) {
      const f = sf[name];
      const ex = f.examples.length ? `  ej: ${f.examples.join(" | ")}` : "";
      console.log(`        • ${name.padEnd(20)} [${[...f.types].join(", ")}]${ex}`);
    }
  }

  report.collections[id] = {
    total,
    fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, { fill: v.count, types: [...v.types] }])),
    subcollections: Object.keys(subFound),
  };
}

// -----------------------------------------------------------------------------
// 3) Análisis de agrupamiento de SUCURSALES por RUT
// -----------------------------------------------------------------------------
console.log("\n" + "=".repeat(78));
console.log("ANÁLISIS DE SUCURSALES (agrupar por RUT: sucursal:true → casa matriz)");
console.log("=".repeat(78));

if (!clientsCollName) {
  console.log("⚠️  No detecté una colección de clientes con campo 'sucursal'. Reviso manualmente.");
} else {
  console.log(`Colección de clientes detectada: "${clientsCollName}"`);
  const total = (await db.collection(clientsCollName).count().get()).data().count;
  if (total > MAX_DOCS_FOR_GROUPING) {
    console.log(`⚠️  Hay ${total} clientes (> ${MAX_DOCS_FOR_GROUPING}); el análisis de agrupación se omite por seguridad.`);
  } else {
    const snap = await db.collection(clientsCollName).get();
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Detectar nombres de campos reales
    const keys = new Set();
    docs.forEach((d) => Object.keys(d).forEach((k) => keys.add(k)));
    const find = (re) => [...keys].find((k) => re.test(k));
    const rutField = find(/rut/i);
    const sucField = find(/sucursal/i);
    const nameField = find(/(nombre|name|razon|razón)/i) || "id";
    const empField = find(/empresa/i);
    console.log(`Campos usados → RUT: "${rutField}" · sucursal: "${sucField}" · nombre: "${nameField}" · empresa: "${empField || "—"}"`);

    const isSucursal = (d) => sucField && (d[sucField] === true || d[sucField] === "true");
    const normRut = (d) => String(d[rutField] ?? "").replace(/[^0-9kK]/g, "").toLowerCase();

    const empresaIds = new Set(empField ? docs.map((d) => d[empField]).filter(Boolean) : []);

    const groups = new Map(); // rutNorm -> { matriz:[], sucursales:[] }
    const sinRut = [];
    for (const d of docs) {
      const r = normRut(d);
      if (!r) { sinRut.push(d); continue; }
      if (!groups.has(r)) groups.set(r, { rut: d[rutField], matriz: [], sucursales: [] });
      (isSucursal(d) ? groups.get(r).sucursales : groups.get(r).matriz).push(d);
    }

    const totalSucursales = docs.filter(isSucursal).length;
    const totalMatriz = docs.length - totalSucursales;
    const gruposConSucursales = [...groups.values()].filter((g) => g.sucursales.length > 0);
    const sinMatriz = [...groups.values()].filter((g) => g.sucursales.length > 0 && g.matriz.length === 0);
    const multiMatriz = [...groups.values()].filter((g) => g.matriz.length > 1);
    const sucursalSinRut = sinRut.filter(isSucursal);

    console.log(`\nRESUMEN:`);
    console.log(`  Total clientes en la v1 ............ ${docs.length}`);
    console.log(`  → marcados como sucursal (true) .... ${totalSucursales}`);
    console.log(`  → casas matrices / normales ........ ${totalMatriz}`);
    console.log(`  Empresas (empresa_id) distintas .... ${empresaIds.size}${empresaIds.size ? " → " + [...empresaIds].join(", ") : ""}`);
    console.log(`  RUTs distintos (grupos) ............ ${groups.size}`);
    console.log(`  Grupos con ≥1 sucursal ............. ${gruposConSucursales.length}`);

    console.log(`\nCASOS A REVISAR (bordes):`);
    console.log(`  ⚠️  Clientes sin RUT ............... ${sinRut.length}  (de ellos, sucursales: ${sucursalSinRut.length})`);
    console.log(`  ⚠️  Grupos con sucursal pero SIN matriz: ${sinMatriz.length}`);
    console.log(`  ⚠️  Grupos con MÁS de una matriz ...... ${multiMatriz.length}`);

    // Mostrar los grupos con más sucursales (ej: La Araucana)
    const top = [...groups.values()].sort((a, b) => b.sucursales.length - a.sucursales.length).slice(0, 8);
    console.log(`\nGRUPOS CON MÁS SUCURSALES (top 8):`);
    for (const g of top) {
      const matrizName = g.matriz[0]?.[nameField] ?? "(sin matriz)";
      console.log(`  • ${String(g.sucursales.length).padStart(3)} sucursales  |  matriz: ${preview(nameField, matrizName)}  (rut ${preview("rut", g.rut)})`);
    }

    // Ejemplos de los casos raros para entenderlos
    if (sinMatriz.length) {
      console.log(`\n  Ejemplos de grupos SIN matriz:`);
      sinMatriz.slice(0, 5).forEach((g) =>
        console.log(`    - rut ${preview("rut", g.rut)} · ${g.sucursales.length} sucursal(es) · ej: ${preview(nameField, g.sucursales[0]?.[nameField])}`)
      );
    }
    if (multiMatriz.length) {
      console.log(`\n  Ejemplos de grupos con varias matrices:`);
      multiMatriz.slice(0, 5).forEach((g) =>
        console.log(`    - rut ${preview("rut", g.rut)} · ${g.matriz.length} matrices · ej: ${g.matriz.map((m) => preview(nameField, m[nameField])).slice(0, 3).join(" / ")}`)
      );
    }

    report.grouping = {
      total: docs.length, sucursales: totalSucursales, matriz: totalMatriz,
      ruts: groups.size, gruposConSucursales: gruposConSucursales.length,
      sinRut: sinRut.length, sucursalSinRut: sucursalSinRut.length,
      sinMatriz: sinMatriz.length, multiMatriz: multiMatriz.length,
      fields: { rutField, sucField, nameField, empField },
    };
  }
}

// -----------------------------------------------------------------------------
// 4) Guardar el resumen (estructura, NO los datos completos) para el registro
// -----------------------------------------------------------------------------
const fecha = new Date().toISOString().slice(0, 10);
const outDir = path.join(HERE, "exports", fecha);
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, "diagnostico_estructura.json"), JSON.stringify(report, null, 2), "utf8");
console.log(`\n💾 Resumen de estructura guardado en: migration/exports/${fecha}/diagnostico_estructura.json`);
console.log("\n✅ Diagnóstico terminado (no se modificó nada en la v1).\n");
process.exit(0);
