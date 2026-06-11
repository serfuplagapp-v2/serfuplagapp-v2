// Prueba de la función de folio (con rollback: NO consume folios).
import { readFileSync } from "node:fs";
import pg from "pg";
const cs = readFileSync("C:\\Users\\carlo\\serfuplagapp-v2\\Secretos\\db.txt", "utf8").trim();
const db = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
await db.connect();

const f = await db.query("select proname, prosecdef from pg_proc where proname = 'next_cert_folio'");
console.log("función existe:", f.rows.length === 1, JSON.stringify(f.rows[0]));

await db.query("begin");
const r = await db.query(
  "update public.tenant_settings set cert_next_folio = cert_next_folio + 1 returning cert_next_folio - 1 as folio_entregado, cert_next_folio as siguiente",
);
console.log("simulación:", JSON.stringify(r.rows[0]));
await db.query("rollback");
const v = await db.query("select cert_next_folio from public.tenant_settings");
console.log("tras rollback sigue en:", JSON.stringify(v.rows[0]));
await db.end();
