// Prueba de SOLO LECTURA del generador de PDF contra certificados reales.
// Genera migration/exports/test-cert-<folio>.pdf para revisión visual.
// Uso: npx tsx migration/test-pdf.mts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import pg from "pg";
import QRCode from "qrcode";

import { buildCertificateView, productNamesFrom } from "../src/lib/cert-view.ts";
import { renderCertificatePdf } from "../src/lib/pdf/certificate-pdf.tsx";

const cs = readFileSync("C:\\Users\\carlo\\serfuplagapp-v2\\Secretos\\db.txt", "utf8").trim();
const db = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
await db.connect();

// Dos casos: el certificado real más reciente y una copia "completa" (con
// productos reales del catálogo, plagas, áreas y textos) para probar TODAS
// las secciones del PDF, porque los 386 importados traen productos vacíos.
const { rows: certs } = await db.query(`
  select * from certificates
  where coalesce(data->>'cliente_nombre','') <> ''
  order by folio desc limit 1
`);
const { rows: settingsRows } = await db.query(`select data from tenant_settings limit 1`);
const settingsData = settingsRows[0]?.data ?? {};

const { rows: catalogSample } = await db.query(
  `select name from products where active order by name limit 3`,
);
const completo = {
  ...certs[0],
  folio: 99999,
  data: {
    ...certs[0].data,
    plagas_detectadas: ["Roedores", "Insectos rastreros"],
    grado_infestacion: "medio",
    areas_tratadas: "Cocina, Bodega; Comedor\nPerímetro exterior",
    servicios: ["Desratización", "Desinsectación"],
    insumos: "Plaguicidas con registro ISP",
    productos_usados: catalogSample.map((p, i) => ({
      nombre: p.name,
      cantidad: String((i + 1) * 50),
      unidad: "g",
    })),
    trabajo_realizado:
      "Inspección completa de las instalaciones, aplicación de rodenticida en cebaderas perimetrales y refuerzo de barreras físicas en accesos.",
    observaciones: "Se detectó actividad reciente en la bodega de insumos secos.",
    recomendaciones: "Mantener cerradas las puertas de acceso y sellar la junta del portón.",
    nombre_firmante: "María Ejemplo Soto",
    rut_firmante: "12.345.678-9",
  },
};
certs.push(completo);

mkdirSync("migration/exports", { recursive: true });

for (const cert of certs) {
  const nombres = productNamesFrom(cert.data);
  let catalogo: { name: string; isp: string | null; formulacion: string | null; ingrediente_activo: string | null; concentracion: string | null; dosis: string | null }[] = [];
  if (nombres.length) {
    const { rows } = await db.query(
      `select name, isp, formulacion, ingrediente_activo, concentracion, dosis
         from products where name = any($1)`,
      [nombres],
    );
    catalogo = rows;
  }

  const view = buildCertificateView(cert, settingsData, catalogo);
  const verifyUrl = `https://serfuplagapp-v2.vercel.app/verificar/${view.verifyCode}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 256 });
  const pdf = await renderCertificatePdf({ view, qrDataUrl, verifyUrl });

  const out = `migration/exports/test-cert-${view.folio}.pdf`;
  writeFileSync(out, pdf);
  console.log(
    `✅ ${out} (${(pdf.length / 1024).toFixed(0)} KB) — productos: ${view.productos.length}, firma: ${view.empresa.firma ? "sí" : "no"}`,
  );
}

await db.end();
