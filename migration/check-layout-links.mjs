// ¿Los cliente_id de layouts calzan con branches.legacy_id? (solo lectura)
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1"));
const layouts = JSON.parse(readFileSync(path.join(HERE, "exports", "2026-06-11", "raw", "layouts.json"), "utf8"));
const certificados = JSON.parse(readFileSync(path.join(HERE, "exports", "2026-06-11", "raw", "certificados.json"), "utf8"));
const cobros = JSON.parse(readFileSync(path.join(HERE, "exports", "2026-06-11", "raw", "cobros.json"), "utf8"));

const cs = readFileSync("C:\\Users\\carlo\\serfuplagapp-v2\\Secretos\\db.txt", "utf8").trim();
const db = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
await db.connect();
const { rows: br } = await db.query("select id, legacy_id, client_id, name from public.branches where legacy_id is not null");
const brByLegacy = new Map(br.map((b) => [b.legacy_id, b]));
const { rows: cl } = await db.query("select id, legacy_id, rut, name from public.clients");
const clByLegacy = new Map(cl.filter((c) => c.legacy_id).map((c) => [c.legacy_id, c]));
const rutNorm = (r) => (r ?? "").replace(/[.\s]/g, "").toLowerCase();
const clByRut = new Map(cl.filter((c) => c.rut).map((c) => [rutNorm(c.rut), c]));

console.log("— LAYOUTS: ¿cliente_id es una sucursal v2? —");
let ok = 0;
for (const l of layouts) {
  const b = brByLegacy.get(l.cliente_id);
  if (b) ok++;
  console.log(`  ${(l.nombre ?? "?").slice(0, 38).padEnd(38)} → ${b ? `SUCURSAL "${b.name.slice(0, 40)}"` : `NO (${l.cliente_id?.slice(0, 12)})`}`);
}
console.log(`Enlazables como sucursal: ${ok}/${layouts.length}`);

console.log("\n— CERTIFICADOS: enlace del cliente —");
let cOk = 0, cRut = 0, cNo = 0;
for (const c of certificados) {
  if (clByLegacy.has(c.cliente_id)) cOk++;
  else if (brByLegacy.has(c.cliente_id)) cOk++; // era sucursal
  else if (clByRut.has(rutNorm(c.cliente_rut))) cRut++;
  else cNo++;
}
console.log(`por legacy (cliente o sucursal): ${cOk} · por RUT: ${cRut} · sin enlace: ${cNo}`);

console.log("\n— COBROS: enlace del cliente —");
let kOk = 0, kBr = 0, kRut = 0, kNo = 0;
for (const c of cobros) {
  if (clByLegacy.has(c.cliente_id)) kOk++;
  else if (brByLegacy.has(c.cliente_id)) kBr++;
  else if (clByRut.has(rutNorm(c.cliente_rut))) kRut++;
  else kNo++;
}
console.log(`cliente legacy: ${kOk} · era sucursal: ${kBr} · por RUT: ${kRut} · sin enlace: ${kNo}`);

await db.end();
process.exit(0);
