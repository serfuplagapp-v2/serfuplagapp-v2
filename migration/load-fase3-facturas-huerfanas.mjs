// Carga las 2 facturas cuyo cobro fue borrado en la v1: se crea el movimiento
// directamente desde la factura (estado facturado) + su dte_document.
// Idempotente (legacy_id "factura:<id>"). Uso: node migration/load-fase3-facturas-huerfanas.mjs
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1"));
const facturas = JSON.parse(readFileSync(path.join(HERE, "exports", "2026-06-11", "raw", "facturas.json"), "utf8"));
const cobros = JSON.parse(readFileSync(path.join(HERE, "exports", "2026-06-11", "raw", "cobros.json"), "utf8"));
const cobroIds = new Set(cobros.map((c) => c._id));

const cs = readFileSync("C:\\Users\\carlo\\serfuplagapp-v2\\Secretos\\db.txt", "utf8").trim();
const db = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
await db.connect();

const { rows: tRows } = await db.query("select id from public.tenants where name = 'Serfuplagas Ltda.' limit 1");
const TENANT = tRows[0].id;
const { rows: cls } = await db.query("select id, rut from public.clients where rut is not null");
const rutNorm = (r) => (r ?? "").replace(/[.\s]/g, "").toLowerCase();
const clientByRut = new Map(cls.map((c) => [rutNorm(c.rut), c.id]));

const huerfanas = facturas.filter((f) => !cobroIds.has(f.cobro_id));
console.log(`Facturas sin cobro: ${huerfanas.length}`);

await db.query("begin");
try {
  for (const f of huerfanas) {
    const legacy = `factura:${f._id}`;
    const { rows: ya } = await db.query("select id from public.movements where legacy_id = $1", [legacy]);
    if (ya.length) { console.log(`  · ${f.cliente_nombre}: ya cargada — omitida`); continue; }
    const clientId = clientByRut.get(rutNorm(f.cliente_rut)) ?? null;
    const { rows: mov } = await db.query(
      `insert into public.movements (tenant_id, client_id, date, type, amount, status, description, client_name_raw, dte_folio, legacy_id)
       values ($1,$2,$3,'venta',$4,'facturado',$5,$6,$7,$8) returning id`,
      [
        TENANT, clientId, (f.fecha_emision ?? "").slice(0, 10) || "2026-05-10",
        Math.round(Number(f.monto_total) || 0),
        [f.periodo ? `Periodo ${f.periodo}` : null, "Importada desde factura v1 (cobro original borrado)"].filter(Boolean).join(" · "),
        f.cliente_nombre ?? null,
        f.folio_sii != null && typeof f.folio_sii !== "object" ? String(f.folio_sii) : null,
        legacy,
      ],
    );
    await db.query(
      `insert into public.dte_documents (tenant_id, movement_id, sii_type, folio, status, pdf_path, xml_path, legacy_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        TENANT, mov[0].id, Number(f.tipo_dte) || null,
        f.folio_sii != null && typeof f.folio_sii !== "object" ? String(f.folio_sii) : null,
        f.estado_sii ?? null,
        typeof f.pdf_url === "string" ? f.pdf_url : null,
        typeof f.xml_url === "string" ? f.xml_url : null,
        f._id,
      ],
    );
    console.log(`  ✅ ${f.cliente_nombre}: movimiento + DTE cargados (cliente ${clientId ? "enlazado" : "NO enlazado"})`);
  }
  await db.query("commit");
  console.log("✅ Listo (commit).");
} catch (e) {
  await db.query("rollback");
  console.error("❌ ROLLBACK:", e.message);
  process.exitCode = 1;
}
await db.end();
