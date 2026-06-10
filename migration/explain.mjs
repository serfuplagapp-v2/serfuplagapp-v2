import { readFileSync } from "node:fs";
import pg from "pg";
const connectionString = readFileSync("C:\\Users\\carlo\\serfuplagapp-v2\\Secretos\\db.txt", "utf8").trim();
const db = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
await db.connect();
const t = "9f8bac49-a1f7-4db7-8ff0-74457906a3ba";
// Simula la consulta de la página Clientes (lista paginada + conteo)
const r = await db.query(
  `explain (analyze, buffers, format text)
   select id, name, rut, type from public.clients
   where tenant_id = $1 order by name asc limit 25 offset 0`, [t]);
console.log("--- Lista de clientes (paginada) ---");
console.log(r.rows.map((x) => x["QUERY PLAN"]).join("\n"));
const c = await db.query(`explain (analyze) select count(*) from public.clients where tenant_id = $1`, [t]);
console.log("\n--- Conteo exacto ---");
console.log(c.rows.map((x) => x["QUERY PLAN"]).join("\n"));
await db.end();
