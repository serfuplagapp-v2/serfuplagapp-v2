import type { Json } from "@/lib/supabase/types";

/**
 * Tipos y helpers PUROS de la vista de certificado (sin dependencias de
 * Next/Supabase en runtime). Separados de certificates.ts para que el
 * generador de PDF se pueda probar fuera de la app (migration/test-pdf.mts).
 */

export const GRADO_LABEL: Record<string, string> = {
  sin_evidencia: "Sin evidencia",
  bajo: "Bajo",
  medio: "Medio",
  alto: "Alto",
};

/** Fecha larga en español de Chile (ej: "11 de junio de 2026"); tolera basura. */
export function fechaLarga(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso; // dato heredado con formato desconocido: mostrar tal cual
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(ms));
}

/** ¿La vigencia ya expiró? Tolera fechas heredadas ilegibles (las ignora). */
export function vigenciaExpirada(validUntil: string | null): boolean {
  const ms = validUntil ? Date.parse(validUntil) : Number.NaN;
  return Number.isFinite(ms) && ms < Date.now();
}

export interface CertificateProduct {
  nombre: string;
  isp: string;
  formulacion: string;
  ingrediente: string;
  concentracion: string;
  dosis: string;
  cantidad: string;
}

export interface CertificateCompany {
  nombreLegal: string;
  rut: string;
  direccion: string;
  correo: string;
  resSan: string;
  repLegal: string;
  repTecNombre: string;
  repTecRut: string;
  /** Firma del representante técnico (base64 o URL, heredada de la v1). */
  firma: string;
}

export interface CertificateView {
  id: string;
  folio: number;
  serviceId: string | null;
  clientId: string | null;
  branchId: string | null;
  issuedAt: string | null;
  serviceDate: string | null;
  verifyCode: string;
  pdfPath: string | null;
  sentAt: string | null;
  sentTo: string | null;
  clienteNombre: string;
  clienteRut: string;
  sucursalNombre: string;
  direccion: string;
  titular: string;
  rutFirmante: string;
  correoFirmante: string;
  plagas: string[];
  grado: string;
  servicios: string[];
  metodologia: string;
  insumos: string;
  areas: string[];
  productos: CertificateProduct[];
  trabajoRealizado: string;
  observaciones: string;
  recomendaciones: string;
  fechaVigencia: string;
  empresa: CertificateCompany;
}

// ---------------------------------------------------------------------------
// Armado de la vista (funciones puras: también las usa migration/test-pdf.mts)
// ---------------------------------------------------------------------------

const asStr = (v: Json | undefined, fb = ""): string => (typeof v === "string" ? v : fb);
const asArr = (v: Json | undefined): Json[] => (Array.isArray(v) ? v : []);

export interface CertRow {
  id: string;
  folio: number;
  service_id: string | null;
  client_id: string | null;
  branch_id: string | null;
  issued_at: string | null;
  service_date: string | null;
  data: Json;
  pdf_path: string | null;
  verify_code: string;
  sent_at: string | null;
  sent_to: string | null;
}

export interface CatalogProductRow {
  name: string;
  isp: string | null;
  formulacion: string | null;
  ingrediente_activo: string | null;
  concentracion: string | null;
  dosis: string | null;
}

/** Nombres de producto mencionados en el jsonb del certificado (para el catálogo). */
export function productNamesFrom(data: Json): string[] {
  const d = (data ?? {}) as Record<string, Json>;
  const productosRaw = asArr(d.productos_usados).length ? asArr(d.productos_usados) : asArr(d.productos);
  return productosRaw
    .map((p) => (typeof p === "string" ? p : p && typeof p === "object" && !Array.isArray(p) ? asStr((p as Record<string, Json>).nombre) : ""))
    .filter(Boolean);
}

/**
 * Resuelve la fila del certificado + config de empresa + catálogo en la vista
 * final que consumen la hoja imprimible y el PDF.
 */
export function buildCertificateView(
  cert: CertRow,
  settingsData: Json,
  catalogRows: CatalogProductRow[],
): CertificateView {
  const cfg = (settingsData ?? {}) as Record<string, Json>;
  const d = (cert.data ?? {}) as Record<string, Json>;

  const servicios = asArr(d.servicios).filter((x): x is string => typeof x === "string");
  const plagas = asArr(d.plagas_detectadas).filter((x): x is string => typeof x === "string");
  const areas = asStr(d.areas_tratadas)
    .split(/[,;\n]/)
    .map((a) => a.trim())
    .filter(Boolean);

  // Productos: enriquecer con el catálogo (ISP, formulación, ingrediente, dosis).
  const productosRaw = asArr(d.productos_usados).length ? asArr(d.productos_usados) : asArr(d.productos);
  const catalogo = new Map<string, CatalogProductRow>();
  for (const p of catalogRows) catalogo.set(p.name, p);
  const productos: CertificateProduct[] = productosRaw
    .map((p) => {
      const o = typeof p === "string" ? { nombre: p, cantidad: "", unidad: "" } : ((p ?? {}) as Record<string, Json>);
      const nombre = asStr(o.nombre, typeof p === "string" ? p : "");
      const cat = catalogo.get(nombre);
      return {
        nombre,
        isp: cat?.isp ?? "—",
        formulacion: cat?.formulacion ?? "—",
        ingrediente: cat?.ingrediente_activo ?? "—",
        concentracion: cat?.concentracion ?? "—",
        dosis: cat?.dosis ?? "—",
        cantidad:
          [asStr(o.cantidad, typeof o.cantidad === "number" ? String(o.cantidad) : ""), asStr(o.unidad)]
            .filter(Boolean)
            .join(" ") || "—",
      };
    })
    .filter((p) => p.nombre);

  const repTec = asStr(cfg.rep_tec, "Representante Técnico");
  const [repTecNombre, repTecRut] = repTec.split("·").map((s) => s.trim());

  return {
    id: cert.id,
    folio: cert.folio,
    serviceId: cert.service_id,
    clientId: cert.client_id,
    branchId: cert.branch_id,
    issuedAt: cert.issued_at,
    serviceDate: cert.service_date,
    verifyCode: cert.verify_code,
    pdfPath: cert.pdf_path,
    sentAt: cert.sent_at,
    sentTo: cert.sent_to,
    clienteNombre: asStr(d.cliente_nombre),
    clienteRut: asStr(d.cliente_rut),
    sucursalNombre: asStr(d.sucursal_nombre),
    direccion: asStr(d.direccion),
    titular: asStr(d.titular) || asStr(d.nombre_firmante),
    rutFirmante: asStr(d.rut_firmante),
    correoFirmante: asStr(d.correo_firmante),
    plagas,
    grado: GRADO_LABEL[asStr(d.grado_infestacion)] ?? "",
    servicios,
    metodologia: asStr(d.metodologia) || "M.I.P (Manejo Integrado de Plagas)",
    insumos: asStr(d.insumos),
    areas,
    productos,
    trabajoRealizado: asStr(d.trabajo_realizado),
    observaciones: asStr(d.observaciones),
    recomendaciones: asStr(d.recomendaciones),
    fechaVigencia: asStr(d.fecha_vigencia),
    empresa: {
      nombreLegal: asStr(cfg.nombre_legal, "Servicios de Fumigación y Control de Plagas Ltda."),
      rut: asStr(cfg.rut, "76.818.360-0"),
      direccion: asStr(cfg.direccion, "Francisco de Rioja 1260, San Bernardo"),
      correo: asStr(cfg.correo, "contacto@serfuplagas.cl"),
      resSan: asStr(cfg.res_san, "Nº 44716 · 25/10/2006"),
      repLegal: asStr(cfg.rep_legal),
      repTecNombre: repTecNombre || "Representante Técnico",
      repTecRut: repTecRut ?? "",
      firma: asStr(cfg.firma_tec_base64) || asStr(cfg.firma_tec_url),
    },
  };
}
