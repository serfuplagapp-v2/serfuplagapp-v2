// =============================================================================
// Serfuplagapp v2 — Carga a Supabase (Postgres)  ·  clientes/sucursales/contactos
// -----------------------------------------------------------------------------
// Lee la vista previa (exports/<fecha>/preview/*_v2.json) y la inserta en la base,
// TODO dentro de UNA transacción: si algo falla, se revierte completo (no quedan
// datos a medias). Aditivo: respeta lo que ya exista. tenant_id = Serfuplagas.
// Conexión: Secretos/db.txt (ignorada por git).
// =============================================================================
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import pg from "pg";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1"));
const connectionString = readFileSync("C:\\Users\\carlo\\serfuplagapp-v2\\Secretos\\db.txt", "utf8").trim();

// --- localizar la vista previa más reciente ----------------------------------
const exportsDir = path.join(HERE, "exports");
const fecha = readdirSync(exportsDir)
  .filter((f) => existsSync(path.join(exportsDir, f, "preview", "clientes_v2.json")))
  .sort().reverse()[0];
if (!fecha) { console.error("No hay vista previa. Corre antes export.mjs + transform.mjs"); process.exit(1); }
const pv = (n) => JSON.parse(readFileSync(path.join(exportsDir, fecha, "preview", n), "utf8"));
const clients = pv("clientes_v2.json");
const branches = pv("sucursales_v2.json");
const contacts = pv("contactos_v2.json");
console.log(`Vista previa ${fecha}: ${clients.length} clientes · ${branches.length} sucursales · ${contacts.length} contactos\n`);

const nz = (v) => (v === "" || v === undefined ? null : v); // "" → null

// helper de INSERT por lotes parametrizado
function buildInsert(table, columns, rows) {
  const params = [];
  const tuples = rows.map((row) => {
    const ph = columns.map((c) => { params.push(row[c] ?? null); return `$${params.length}`; });
    return `(${ph.join(",")})`;
  });
  return { sql: `insert into public.${table} (${columns.join(",")}) values ${tuples.join(",")}`, params };
}

const db = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
await db.connect();

try {
  const { rows: tr } = await db.query("select id from public.tenants where name = 'Serfuplagas Ltda.' limit 1");
  if (!tr.length) throw new Error("No encontré la empresa 'Serfuplagas Ltda.'");
  const tenant = tr[0].id;

  // Guardia anti doble-carga
  const before = {
    clients: (await db.query("select count(*)::int n from public.clients")).rows[0].n,
    branches: (await db.query("select count(*)::int n from public.branches")).rows[0].n,
    contacts: (await db.query("select count(*)::int n from public.contacts")).rows[0].n,
  };
  console.log(`Antes de cargar → clients:${before.clients} branches:${before.branches} contacts:${before.contacts}`);
  if (before.clients > 50 && !process.argv.includes("--force")) {
    throw new Error(`Ya hay ${before.clients} clientes; parece cargado. Aborto (usa --force para forzar).`);
  }

  await db.query("begin");

  // 0) Asegurar la columna notes en branches (migración 0003, idempotente)
  await db.query("alter table public.branches add column if not exists notes text");

  // 1) CLIENTES (id propio para enlazar las sucursales)
  const clientId = new Map();
  const clientRows = clients.map((c) => {
    const id = randomUUID();
    clientId.set(c._key, id);
    return { id, tenant_id: tenant, name: c.name, rut: nz(c.rut), notes: nz(c.notes) };
  });
  await db.query(...Object.values(buildInsert("clients", ["id", "tenant_id", "name", "rut", "notes"], clientRows)));
  console.log(`✓ ${clientRows.length} clientes`);

  // 2) SUCURSALES
  const branchId = new Map();
  const branchRows = branches.map((b) => {
    const id = randomUUID();
    branchId.set(b._key, id);
    return {
      id, tenant_id: tenant, client_id: clientId.get(b._clientKey),
      name: b.name, address: nz(b.address),
      lat: b.lat, lng: b.lng,
      geocoded_at: b.lat !== null && b.lng !== null ? new Date() : null,
      notes: nz(b.notes),
    };
  });
  await db.query(...Object.values(buildInsert("branches",
    ["id", "tenant_id", "client_id", "name", "address", "lat", "lng", "geocoded_at", "notes"], branchRows)));
  console.log(`✓ ${branchRows.length} sucursales`);

  // 3) CONTACTOS (id por defecto; enlazan a cliente y, si aplica, a sucursal)
  const contactRows = contacts.map((c) => ({
    tenant_id: tenant,
    client_id: clientId.get(c._clientKey),
    branch_id: c._branchKey ? branchId.get(c._branchKey) : null,
    name: c.name, role: nz(c.role), phone: nz(c.phone), email: nz(c.email),
    es_destinatario: c.es_destinatario, es_cc: c.es_cc, recibe_whatsapp: c.recibe_whatsapp, orden: c.orden,
  }));
  await db.query(...Object.values(buildInsert("contacts",
    ["tenant_id", "client_id", "branch_id", "name", "role", "phone", "email", "es_destinatario", "es_cc", "recibe_whatsapp", "orden"], contactRows)));
  console.log(`✓ ${contactRows.length} contactos`);

  // 4) Validación dentro de la transacción
  const after = {
    clients: (await db.query("select count(*)::int n from public.clients")).rows[0].n,
    branches: (await db.query("select count(*)::int n from public.branches")).rows[0].n,
    contacts: (await db.query("select count(*)::int n from public.contacts")).rows[0].n,
  };
  const huerfanas = (await db.query(
    "select count(*)::int n from public.branches b left join public.clients c on c.id=b.client_id where c.id is null"
  )).rows[0].n;
  console.log(`Después de cargar → clients:${after.clients} branches:${after.branches} contacts:${after.contacts}`);
  console.log(`Sucursales huérfanas (debe ser 0): ${huerfanas}`);
  if (huerfanas !== 0) throw new Error("Hay sucursales sin cliente; reviso antes de confirmar.");
  if (after.clients - before.clients !== clientRows.length) throw new Error("El conteo de clientes no cuadra.");

  await db.query("commit");
  console.log("\n✅ Carga CONFIRMADA (commit). Datos en producción.");
} catch (e) {
  await db.query("rollback").catch(() => {});
  console.error(`\n❌ Error — se revirtió todo (rollback). Nada quedó cargado.\n   ${e.message}`);
  process.exitCode = 1;
} finally {
  await db.end();
}
