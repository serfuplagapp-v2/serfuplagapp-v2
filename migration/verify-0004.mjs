import { readFileSync } from "node:fs";
import pg from "pg";
const connectionString = readFileSync("C:\\Users\\carlo\\serfuplagapp-v2\\Secretos\\db.txt", "utf8").trim();
const db = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
await db.connect();
const tablas = ["movements", "movement_services", "dte_documents"];
for (const t of tablas) {
  const cols = await db.query(
    `select column_name, data_type, is_nullable from information_schema.columns
     where table_schema='public' and table_name=$1 order by ordinal_position`, [t]);
  const rls = await db.query(
    `select relrowsecurity from pg_class where oid = ('public.'||$1)::regclass`, [t]);
  const cnt = await db.query(`select count(*)::int n from public.${t}`);
  console.log(`\n📁 ${t}  · filas: ${cnt.rows[0].n} · RLS: ${rls.rows[0].relrowsecurity ? "ON ✅" : "OFF ❌"}`);
  console.log(cols.rows.map((c) => `   ${c.column_name} (${c.data_type}${c.is_nullable === "YES" ? ", null" : ""})`).join("\n"));
}
await db.end();
console.log("\n✅ Verificación 0004 lista.");
