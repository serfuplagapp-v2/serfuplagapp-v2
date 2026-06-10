// Prueba de conexión a Supabase (Postgres). Lee la cadena desde Secretos/db.txt
// (ignorada por git) y prueba host directo + pooler hasta encontrar uno que funcione.
import { readFileSync } from "node:fs";
import pg from "pg";

const base = readFileSync("C:\\Users\\carlo\\serfuplagapp-v2\\Secretos\\db.txt", "utf8").trim();
const m = base.match(/postgres:([^@]+)@db\.([a-z0-9]+)\.supabase\.co/);
const pwd = m?.[1];
const ref = m?.[2];

const candidates = [
  base,
  `postgresql://postgres.${ref}:${pwd}@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`,
  `postgresql://postgres.${ref}:${pwd}@aws-1-sa-east-1.pooler.supabase.com:5432/postgres`,
  `postgresql://postgres.${ref}:${pwd}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`,
];

for (const url of candidates) {
  const safe = url.replace(pwd, "***");
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 9000 });
  try {
    await client.connect();
    const r = await client.query("select id, name from public.tenants where name = 'Serfuplagas Ltda.'");
    const c = await client.query("select count(*)::int n from public.clients");
    console.log(`OK   ${safe}`);
    console.log(`     tenant: ${JSON.stringify(r.rows)} · clients actuales: ${c.rows[0].n}`);
    await client.end();
    console.log(`USAR=${url.replace(/:[^:@]+@/, ":***@")}`);
    process.exit(0);
  } catch (e) {
    console.log(`FALLA ${safe}  → ${e.message}`);
    try { await client.end(); } catch {}
  }
}
console.log("Ningún candidato conectó. Habrá que pedir la cadena exacta del panel de Supabase.");
process.exit(1);
