// Aplica un archivo .sql a la base de Supabase (vía pg). Uso:
//   node migration/apply-sql.mjs <ruta-al-archivo.sql>
// Conexión en Secretos/db.txt (ignorada por git).
import { readFileSync } from "node:fs";
import pg from "pg";

const file = process.argv[2];
if (!file) { console.error("Falta la ruta del .sql"); process.exit(1); }
const sql = readFileSync(file, "utf8");
const connectionString = readFileSync("C:\\Users\\carlo\\serfuplagapp-v2\\Secretos\\db.txt", "utf8").trim();

const db = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
await db.connect();
try {
  await db.query(sql);
  console.log(`✅ Migración aplicada: ${file}`);
} catch (e) {
  console.error(`❌ Error: ${e.message}`);
  process.exitCode = 1;
} finally {
  await db.end();
}
