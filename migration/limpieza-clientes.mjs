// Limpieza de clientes (sesión Clientes, 11-jun-2026). Transaccional.
// Uso: node migration/limpieza-clientes.mjs           (simulación, no guarda)
//      node migration/limpieza-clientes.mjs --apply   (aplica de verdad)
// Acciones: borrar cliente de prueba "dasda" (+su visita de prueba);
// fusionar El Gran Corte (2 fichas) y Globe S.A. (3 fichas) reasignando
// sucursales/contactos; corregir RUT de Educain (77901786-9), El Gran Corte
// (77377229-0) y ABINGRAF (77325180-0, encontrado en su certificado v1);
// fusionar la sucursal Apoquindo duplicada de Globe.
import { readFileSync } from "node:fs";
import pg from "pg";

const APPLY = process.argv.includes("--apply");
const cs = readFileSync("Secretos/db.txt", "utf8").trim();
const db = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
await db.connect();

function dv(num) {
  let m = 2, s = 0;
  for (const d of String(num).split("").reverse()) { s += Number(d) * m; m = m === 7 ? 2 : m + 1; }
  const r = 11 - (s % 11);
  return r === 11 ? "0" : r === 10 ? "K" : String(r);
}
// Validación de los DV antes de tocar nada.
for (const [n, esperado] of [[77901786, "9"], [77377229, "0"], [77325180, "0"]]) {
  if (dv(n) !== esperado) { console.error(`DV de ${n} NO es ${esperado} (es ${dv(n)}) — ABORTO`); process.exit(1); }
}

const DASDA      = "26dc3042-21a4-4a51-a872-ed70f7594409";
const GC_BORRAR  = "a37c4176-19b6-4656-a8ba-df0c7b2629f2"; // El Gran Corte sin operación
const GC_QUEDA   = "c5f7556d-45c3-4849-a092-e270d4d856d5"; // El Gran Corte con contrato/servicios
const GLOBE_REAL = "1fc70a17-16ed-4209-8838-949ee6d8f9a2"; // RUT 99544220-5
const GLOBE_X1   = "0bca4d58-ffa3-4e1d-9bcc-bfcfb6556161"; // RUT erróneo (16571001-0)
const GLOBE_X2   = "a62bdfcc-62b4-441b-9847-9210cd6eebcf"; // RUT erróneo (18302021-8)

try {
  await db.query("begin");

  // ── 1) dasda: borrar su visita de prueba y el cliente ─────────────────────
  const s1 = await db.query("delete from services where client_id=$1 and legacy_id is null returning id", [DASDA]);
  const c1 = await db.query("delete from clients where id=$1 returning name", [DASDA]);
  console.log(`1) dasda: ${s1.rowCount} visita(s) de prueba + cliente '${c1.rows[0]?.name}' eliminados`);

  // ── 2) RUTs ────────────────────────────────────────────────────────────────
  const r1 = await db.query("update clients set rut='77901786-9' where name ilike '%educain%' returning name, rut");
  const r2 = await db.query("update clients set rut='77325180-0' where name ilike '%abingraf%' returning name, rut");
  console.log(`2) RUTs: ${r1.rows.map(r => `${r.name}→${r.rut}`).join(", ")} · ${r2.rows.map(r => `${r.name}→${r.rut}`).join(", ")}`);

  // ── 3) El Gran Corte: fusionar ─────────────────────────────────────────────
  // La sucursal San Bernardo (real) pasa a la ficha que queda; el contacto es
  // idéntico (mismo correo) → se elimina el duplicado; RUT con DV correcto.
  const gb = await db.query("update branches set client_id=$1 where client_id=$2 returning name", [GC_QUEDA, GC_BORRAR]);
  const gk = await db.query("delete from contacts where client_id=$1 returning name", [GC_BORRAR]);
  await db.query("update clients set rut='77377229-0' where id=$1", [GC_QUEDA]);
  const gd = await db.query("delete from clients where id=$1 returning name", [GC_BORRAR]);
  console.log(`3) Gran Corte: sucursal '${gb.rows[0]?.name}' movida, ${gk.rowCount} contacto dup eliminado, ficha '${gd.rows[0]?.name}' borrada, RUT 77377229-0`);

  // ── 4) Globe S.A.: fusionar las 2 fichas erróneas en la real ──────────────
  // Seguridad: las fichas erróneas no deben tener operación.
  for (const id of [GLOBE_X1, GLOBE_X2]) {
    const chk = await db.query(
      `select (select count(*) from services where client_id=$1)::int s,
              (select count(*) from contracts where client_id=$1)::int c,
              (select count(*) from certificates where client_id=$1)::int ce,
              (select count(*) from movements where client_id=$1)::int m`, [id]);
    const { s, c, ce, m } = chk.rows[0];
    if (s + c + ce + m > 0) throw new Error(`Globe ${id} tiene operación (${s}/${c}/${ce}/${m}) — ABORTO`);
  }
  // Sus sucursales son duplicados de Burgos/Apoquindo reales: verificar que nada las referencie.
  const refLay = await db.query(
    "select count(*)::int n from layouts where branch_id in (select id from branches where client_id = any($1))",
    [[GLOBE_X1, GLOBE_X2]]);
  if (refLay.rows[0].n > 0) throw new Error("Hay layouts apuntando a sucursales de las fichas Globe erróneas — ABORTO");
  // Mover el contacto real (Ana María Fernández, X2 tiene su teléfono real) a la ficha real.
  const burgosReal = await db.query(
    "select id from branches where client_id=$1 and name ilike '%burgos%' limit 1", [GLOBE_REAL]);
  const mv = await db.query(
    "update contacts set client_id=$1, branch_id=$2 where client_id=$3 returning name",
    [GLOBE_REAL, burgosReal.rows[0]?.id ?? null, GLOBE_X2]);
  // El contacto duplicado mal etiquetado de la ficha real (afernandez@ con otro nombre) sobra.
  const dupCon = await db.query(
    "delete from contacts where client_id=$1 and email='afernandez@globe.cl' and name not ilike '%fernandez%' returning name",
    [GLOBE_REAL]);
  // Borrar fichas erróneas (cascade elimina sus sucursales duplicadas y el contacto restante).
  const gx = await db.query("delete from clients where id = any($1) returning name, rut", [[GLOBE_X1, GLOBE_X2]]);
  console.log(`4) Globe: contacto '${mv.rows[0]?.name}' movido a la ficha real (Burgos), ${dupCon.rowCount} contacto mal etiquetado borrado, ${gx.rowCount} fichas erróneas eliminadas`);

  // ── 5) Globe real: fusionar la sucursal Apoquindo duplicada ───────────────
  const apoq = await db.query(
    `select id, name, legacy_id from branches where client_id=$1 and address ilike 'Apoquindo 4001%' order by name`, [GLOBE_REAL]);
  if (apoq.rowCount === 2) {
    const queda = apoq.rows.find(r => r.name.startsWith("Globe S.A.")) ?? apoq.rows[0];
    const sobra = apoq.rows.find(r => r.id !== queda.id);
    for (const t of ["services", "certificates", "contacts", "layouts"]) {
      const u = await db.query(`update ${t} set branch_id=$1 where branch_id=$2`, [queda.id, sobra.id]);
      if (u.rowCount) console.log(`   ${t}: ${u.rowCount} fila(s) reasignadas a '${queda.name}'`);
    }
    await db.query("delete from branches where id=$1", [sobra.id]);
    console.log(`5) Globe: sucursal duplicada '${sobra.name}' fusionada en '${queda.name}'`);
  } else {
    console.log(`5) Globe: ${apoq.rowCount} sucursal(es) Apoquindo — sin fusión`);
  }

  if (APPLY) { await db.query("commit"); console.log("\n✅ APLICADO (commit)"); }
  else { await db.query("rollback"); console.log("\n🔍 SIMULACIÓN (rollback) — nada se guardó. Corre con --apply para aplicar."); }
} catch (e) {
  await db.query("rollback");
  console.error("❌ ROLLBACK:", e.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
