import { readFileSync } from "node:fs";
import pg from "pg";
const cs = readFileSync("Secretos/db.txt", "utf8").trim();
const db = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
await db.connect();
const q = await db.query(`
  select c.id, c.name, c.rut,
    (select count(*) from branches b where b.client_id = c.id)::int sucursales,
    (select count(*) from contacts k where k.client_id = c.id)::int contactos,
    (select count(*) from contracts ct where ct.client_id = c.id)::int contratos,
    (select count(*) from services s where s.client_id = c.id)::int servicios,
    (select count(*) from certificates ce where ce.client_id = c.id)::int certs,
    (select count(*) from movements m where m.client_id = c.id)::int movs,
    (select count(*) from layouts l where l.client_id = c.id)::int layouts
  from clients c
  where c.name ilike '%globe%' or c.name ilike '%gran corte%' or c.name ilike '%dasda%'
     or c.name ilike '%educain%' or c.name ilike '%abingraf%'
  order by c.name`);
console.table(q.rows.map(r => ({ ...r, id: r.id.slice(0,8) })));
const full = await db.query(`select id, name from clients where name ilike '%globe%' or name ilike '%gran corte%' or name ilike '%dasda%' order by name`);
for (const r of full.rows) console.log(r.id, r.name);
await db.end();
