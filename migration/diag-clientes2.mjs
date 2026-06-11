import { readFileSync } from "node:fs";
import pg from "pg";
const cs = readFileSync("Secretos/db.txt", "utf8").trim();
const db = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
await db.connect();

function dv(num) {
  let m = 2, s = 0;
  for (const d of String(num).split("").reverse()) { s += Number(d) * m; m = m === 7 ? 2 : m + 1; }
  const r = 11 - (s % 11);
  return r === 11 ? "0" : r === 10 ? "K" : String(r);
}
console.log("DV(77901786) =", dv(77901786), "| DV(779017869) =", dv(779017869), "| DV(77377229) =", dv(77377229));

const ids = {
  dasda: "26dc3042-21a4-4a51-a872-ed70f7594409",
  granCorteA: "a37c4176-19b6-4656-a8ba-df0c7b2629f2",
  granCorteB: "c5f7556d-45c3-4849-a092-e270d4d856d5",
  globeReal: "1fc70a17-16ed-4209-8838-949ee6d8f9a2",
  globeX1: "0bca4d58-ffa3-4e1d-9bcc-bfcfb6556161",
  globeX2: "a62bdfcc-62b4-441b-9847-9210cd6eebcf",
};
for (const [k, id] of Object.entries(ids)) {
  const b = await db.query("select id, name, address, legacy_id from branches where client_id=$1", [id]);
  const c = await db.query("select name, email, phone from contacts where client_id=$1", [id]);
  console.log(`\n== ${k} ==`);
  for (const r of b.rows) console.log("  SUC:", r.name, "|", r.address, "| legacy:", r.legacy_id);
  for (const r of c.rows) console.log("  CON:", r.name, "|", r.email, "|", r.phone);
}
const svc = await db.query("select id, scheduled_at, agenda_status, field_status, legacy_id from services where client_id=$1", [ids.dasda]);
console.log("\ndasda servicios:", JSON.stringify(svc.rows));
const ab = await db.query("select folio, data->>'cliente_rut' rut, data->>'cliente_nombre' nom from certificates where client_id=(select id from clients where name ilike '%abingraf%')");
console.log("ABINGRAF cert:", JSON.stringify(ab.rows));
await db.end();
