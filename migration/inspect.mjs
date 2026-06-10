// =============================================================================
// Serfuplagapp v2 — Inspección focalizada de la v1  ·  SOLO LECTURA
// Resuelve 3 dudas para afinar el mapeo:
//   1) ¿Cómo agrupar sucursales? Comparar RUT compartido vs campo explícito
//      grupo_padre_id (+ es_cabeza_grupo / es_mandante / mandante_id).
//   2) Forma real de los contactos: contactos_adicionales (lista) y/o
//      subcolección "contactos" en algún cliente.
//   3) Registros de prueba/basura a excluir.
// NO modifica nada.
// =============================================================================
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import admin from "firebase-admin";

const SECRETS_DIR = "C:\\Users\\carlo\\serfuplagapp-v2\\Secretos";
const keyFile = readdirSync(SECRETS_DIR).find((f) => f.toLowerCase().endsWith(".json"));
const serviceAccount = JSON.parse(readFileSync(path.join(SECRETS_DIR, keyFile), "utf8"));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const normRut = (r) => String(r ?? "").replace(/[^0-9kK]/g, "").toLowerCase();

const snap = await db.collection("clientes").get();
const docs = snap.docs.map((d) => ({ _id: d.id, ...d.data() }));
const byId = new Map(docs.map((d) => [d._id, d]));
console.log(`\nTotal clientes: ${docs.length}\n`);

// -----------------------------------------------------------------------------
// 1) Agrupamiento: grupo_padre_id vs RUT
// -----------------------------------------------------------------------------
console.log("=".repeat(70));
console.log("1) AGRUPAMIENTO  (grupo_padre_id explícito vs RUT compartido)");
console.log("=".repeat(70));

const conPadre = docs.filter((d) => d.grupo_padre_id);
const cabezaTrue = docs.filter((d) => d.es_cabeza_grupo === true);
const mandanteTrue = docs.filter((d) => d.es_mandante === true);
const sucursalTrue = docs.filter((d) => d.sucursal === true);

console.log(`Con grupo_padre_id (hijo explícito) .. ${conPadre.length}`);
console.log(`es_cabeza_grupo = true ............... ${cabezaTrue.length}`);
console.log(`es_mandante = true ................... ${mandanteTrue.length}`);
console.log(`sucursal = true ...................... ${sucursalTrue.length}`);

// ¿El padre apuntado existe y comparte RUT?
let padreExiste = 0, padreMismoRut = 0, padreDistintoRut = 0, padreNoExiste = 0;
for (const d of conPadre) {
  const p = byId.get(d.grupo_padre_id);
  if (!p) { padreNoExiste++; continue; }
  padreExiste++;
  if (normRut(p.rut) && normRut(p.rut) === normRut(d.rut)) padreMismoRut++;
  else padreDistintoRut++;
}
console.log(`\nDe los ${conPadre.length} con grupo_padre_id:`);
console.log(`  · el padre EXISTE en clientes ...... ${padreExiste}`);
console.log(`  · padre con MISMO rut .............. ${padreMismoRut}`);
console.log(`  · padre con rut DISTINTO ........... ${padreDistintoRut}`);
console.log(`  · el padre NO existe (huérfano) .... ${padreNoExiste}`);

// Concordancia entre los dos métodos
const sucSet = new Set(sucursalTrue.map((d) => d._id));
const padreSet = new Set(conPadre.map((d) => d._id));
const enAmbos = [...padreSet].filter((id) => sucSet.has(id)).length;
const soloPadre = [...padreSet].filter((id) => !sucSet.has(id)).length;
const soloSucursal = [...sucSet].filter((id) => !padreSet.has(id)).length;
console.log(`\nConcordancia sucursal:true  vs  grupo_padre_id:`);
console.log(`  · en AMBOS (hijo y sucursal) ....... ${enAmbos}`);
console.log(`  · solo grupo_padre_id (no marcado sucursal) ... ${soloPadre}`);
console.log(`  · solo sucursal:true (sin padre explícito) .... ${soloSucursal}`);

// -----------------------------------------------------------------------------
// 2) Contactos: contactos_adicionales + subcolección "contactos"
// -----------------------------------------------------------------------------
console.log("\n" + "=".repeat(70));
console.log("2) CONTACTOS");
console.log("=".repeat(70));

const conAdic = docs.filter((d) => Array.isArray(d.contactos_adicionales) && d.contactos_adicionales.length > 0);
const totalAdic = conAdic.reduce((n, d) => n + d.contactos_adicionales.length, 0);
console.log(`Clientes con contactos_adicionales no vacíos ... ${conAdic.length}  (total contactos: ${totalAdic})`);
const keys = new Set();
for (const d of conAdic) for (const c of d.contactos_adicionales) Object.keys(c || {}).forEach((k) => keys.add(k));
console.log(`Campos vistos dentro de cada contacto adicional: ${[...keys].join(", ") || "(ninguno)"}`);
console.log(`Ejemplos (enmascarados):`);
let shown = 0;
for (const d of conAdic) {
  for (const c of d.contactos_adicionales) {
    if (shown >= 4) break;
    const masked = {};
    for (const [k, v] of Object.entries(c || {})) {
      let s = typeof v === "string" ? v : JSON.stringify(v);
      if (/rut|fono|tel|celular|mail|correo|whats/i.test(k) && typeof v === "string" && v.length > 4) s = s.slice(0, 3) + "…";
      masked[k] = typeof s === "string" && s.length > 30 ? s.slice(0, 30) + "…" : s;
    }
    console.log(`   - ${JSON.stringify(masked)}`);
    shown++;
  }
  if (shown >= 4) break;
}

// ¿Existe subcolección "contactos" en algún cliente? (revisar 60 docs)
const subTally = {};
for (const doc of snap.docs.slice(0, 60)) {
  const subs = await doc.ref.listCollections();
  for (const s of subs) subTally[s.id] = (subTally[s.id] || 0) + 1;
}
console.log(`\nSubcolecciones encontradas (en 60 clientes): ${JSON.stringify(subTally)}`);

// -----------------------------------------------------------------------------
// 3) Registros de prueba / basura
// -----------------------------------------------------------------------------
console.log("\n" + "=".repeat(70));
console.log("3) REGISTROS DE PRUEBA / BASURA (candidatos a excluir)");
console.log("=".repeat(70));
const basura = docs.filter((d) => /prueba|test|^\s*sda\s*$|^\s*xxx/i.test(String(d.razon_social ?? "")));
console.log(`Encontrados: ${basura.length}`);
basura.forEach((d) => console.log(`   - "${d.razon_social}"  (rut ${normRut(d.rut) || "—"}, sucursal:${d.sucursal === true})`));

console.log("\n✅ Inspección terminada (no se modificó nada).\n");
process.exit(0);
