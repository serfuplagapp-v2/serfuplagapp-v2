import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { requireEnabledProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { santiagoDate } from "@/lib/datetime";
import type { Json } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

const asStr = (v: Json | undefined, fb = ""): string => (typeof v === "string" ? v : fb);
const asArr = (v: Json | undefined): Json[] => (Array.isArray(v) ? v : []);

const GRADO_LABEL: Record<string, string> = {
  sin_evidencia: "Sin evidencia",
  bajo: "Bajo",
  medio: "Medio",
  alto: "Alto",
};

function fechaLarga(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export default async function CertificadoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tenantId } = await requireEnabledProfile();
  const { id } = await params;
  const supabase = await createClient();

  const { data: cert } = await supabase
    .from("certificates")
    .select("id, folio, service_id, client_id, issued_at, service_date, data")
    .eq("id", id)
    .maybeSingle();
  if (!cert) notFound();

  const { data: settings } = await supabase
    .from("tenant_settings")
    .select("data")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const cfg = (settings?.data ?? {}) as Record<string, Json>;

  const d = (cert.data ?? {}) as Record<string, Json>;
  const servicios = asArr(d.servicios).filter((x): x is string => typeof x === "string");
  const plagas = asArr(d.plagas_detectadas).filter((x): x is string => typeof x === "string");
  const areas = asStr(d.areas_tratadas)
    .split(/[,;\n]/)
    .map((a) => a.trim())
    .filter(Boolean);

  // Productos: enriquecer con el catálogo (ISP, formulación, ingrediente, dosis).
  const productosRaw = asArr(d.productos_usados).length ? asArr(d.productos_usados) : asArr(d.productos);
  const nombresProductos = productosRaw
    .map((p) => (typeof p === "string" ? p : p && typeof p === "object" && !Array.isArray(p) ? asStr((p as Record<string, Json>).nombre) : ""))
    .filter(Boolean);
  const catalogo = new Map<string, { isp: string | null; formulacion: string | null; ingrediente_activo: string | null; concentracion: string | null; dosis: string | null }>();
  if (nombresProductos.length) {
    const { data: prods } = await supabase
      .from("products")
      .select("name, isp, formulacion, ingrediente_activo, concentracion, dosis")
      .in("name", nombresProductos);
    for (const p of prods ?? []) catalogo.set(p.name, p);
  }
  const productos = productosRaw
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
        cantidad: [asStr(o.cantidad, typeof o.cantidad === "number" ? String(o.cantidad) : ""), asStr(o.unidad)].filter(Boolean).join(" ") || "—",
      };
    })
    .filter((p) => p.nombre);

  const firma = asStr(cfg.firma_tec_base64) || asStr(cfg.firma_tec_url);
  const repTec = asStr(cfg.rep_tec, "Representante Técnico");
  const [repTecNombre, repTecRut] = repTec.split("·").map((s) => s.trim());

  const titular = asStr(d.titular) || asStr(d.nombre_firmante);
  const grado = GRADO_LABEL[asStr(d.grado_infestacion)] ?? "";

  return (
    <div className="flex flex-col gap-4">
      {/* Controles (no se imprimen) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
          <Link href={cert.service_id ? `/ordenes/${cert.service_id}` : "/terreno"}>
            <ChevronLeft className="size-4" />
            Volver
          </Link>
        </Button>
        <PrintButton />
      </div>

      {/* Hoja del certificado (réplica de la plantilla v1) */}
      <div className="cert-sheet mx-auto w-full max-w-[210mm] bg-white text-[#1A1F2C] shadow-md print:shadow-none">
        {/* Encabezado */}
        <header className="flex items-start justify-between gap-4 border-b-4 border-[#1B3A6B] p-6 pb-4">
          <div className="text-[11px] leading-snug">
            <p className="text-[13px] font-bold">{asStr(cfg.nombre_legal, "Servicios de Fumigación y Control de Plagas Ltda.")}</p>
            <p>RUT: {asStr(cfg.rut, "76.818.360-0")}</p>
            <p>{asStr(cfg.direccion, "Francisco de Rioja 1260, San Bernardo")}</p>
            <p>{asStr(cfg.correo, "contacto@serfuplagas.cl")}</p>
            <p className="mt-1 font-medium">Res. Sanitaria {asStr(cfg.res_san, "Nº 44716 · 25/10/2006")} · SEREMI de Salud R.M.</p>
            {asStr(cfg.rep_legal) && <p>Representante: {asStr(cfg.rep_legal)}</p>}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tracking-wide text-[#1B3A6B]">CERTIFICADO</p>
            <p className="text-[11px] text-[#4A5061]">Control de Plagas e Higiene Ambiental</p>
            <div className="mt-2 rounded-lg border-2 border-[#1B3A6B] px-3 py-1 text-center">
              <p className="text-[10px] tracking-wide text-[#4A5061] uppercase">Folio N°</p>
              <p className="text-xl font-bold text-[#1B3A6B] tabular-nums">{cert.folio}</p>
            </div>
          </div>
        </header>

        <div className="flex flex-col gap-4 p-6">
          {/* Identificación del inmueble */}
          <section>
            <h2 className="cert-hdr">Identificación del inmueble</h2>
            <div className="grid grid-cols-2 gap-4 text-[12px]">
              <div>
                <p className="cert-lbl">Cliente / Sucursal</p>
                <p className="font-semibold">{asStr(d.cliente_nombre, "—")}</p>
                {asStr(d.sucursal_nombre) && <p>{asStr(d.sucursal_nombre)}</p>}
                <p className="text-[#4A5061]">{asStr(d.direccion, "")}</p>
              </div>
              <div>
                <p className="cert-lbl">Diagnóstico previo</p>
                <p className="font-semibold">{plagas.length ? plagas.join(", ") : "Sin evidencia"}</p>
                {grado && <p className="text-[#4A5061]">Grado de infestación: {grado}</p>}
              </div>
            </div>
          </section>

          {/* Datos del servicio */}
          <section>
            <h2 className="cert-hdr">Datos del servicio</h2>
            <div className="grid grid-cols-2 gap-4 text-[12px]">
              <div>
                <p className="cert-lbl">Persona que recibe el servicio</p>
                <p className="font-semibold">{titular || "—"}</p>
                {asStr(d.rut_firmante) && <p className="text-[#4A5061]">RUT: {asStr(d.rut_firmante)}</p>}
                {asStr(d.correo_firmante) && <p className="text-[#4A5061]">{asStr(d.correo_firmante)}</p>}
              </div>
              <div>
                <p className="cert-lbl">Identificación del propietario / empresa</p>
                <p className="font-semibold">{asStr(d.cliente_nombre, "—")}</p>
                {asStr(d.cliente_rut) && <p className="text-[#4A5061]">RUT: {asStr(d.cliente_rut)}</p>}
              </div>
            </div>
          </section>

          {/* Fechas */}
          <section className="grid grid-cols-3 gap-2 text-center text-[12px]">
            <div className="rounded-lg border p-2">
              <p className="cert-lbl">Fecha del servicio</p>
              <p className="font-semibold">{fechaLarga(cert.service_date)}</p>
            </div>
            <div className="rounded-lg border p-2">
              <p className="cert-lbl">Emisión del certificado</p>
              <p className="font-semibold">{fechaLarga(cert.issued_at)}</p>
            </div>
            <div className="rounded-lg border-2 border-[#1B3A6B] bg-[#1B3A6B]/5 p-2">
              <p className="cert-lbl">Vigencia del certificado</p>
              <p className="font-semibold">{fechaLarga(asStr(d.fecha_vigencia) || null)}</p>
            </div>
          </section>

          {/* Tratamientos */}
          <section>
            <h2 className="cert-hdr">Tratamientos realizados</h2>
            <div className="flex flex-wrap gap-1.5">
              {(servicios.length ? servicios : ["Control de Plagas"]).map((s) => (
                <span key={s} className="rounded-full bg-[#1B3A6B] px-3 py-0.5 text-[11px] font-medium text-white">
                  {s}
                </span>
              ))}
            </div>
          </section>

          {/* Metodología y lugares */}
          <section className="grid grid-cols-2 gap-4 text-[12px]">
            <div>
              <p className="cert-lbl">Metodología aplicada</p>
              <p className="font-semibold">{asStr(d.metodologia, "M.I.P (Manejo Integrado de Plagas)")}</p>
              {asStr(d.insumos) && <p className="text-[#4A5061]">Insumos: {asStr(d.insumos)}</p>}
            </div>
            <div>
              <p className="cert-lbl">Lugares tratados</p>
              {areas.length ? (
                <div className="flex flex-wrap gap-1">
                  {areas.map((a) => (
                    <span key={a} className="rounded border bg-[#F7F5EF] px-2 py-0.5 text-[11px]">
                      {a}
                    </span>
                  ))}
                </div>
              ) : (
                <p>—</p>
              )}
            </div>
          </section>

          {/* Productos */}
          {productos.length > 0 && (
            <section>
              <h2 className="cert-hdr">Productos utilizados</h2>
              <table className="w-full border-collapse text-[10.5px]">
                <thead>
                  <tr className="bg-[#1B3A6B] text-left text-white">
                    <th className="px-2 py-1">Nombre comercial</th>
                    <th className="px-2 py-1">Reg. ISP</th>
                    <th className="px-2 py-1">Formulación</th>
                    <th className="px-2 py-1">Ingrediente activo</th>
                    <th className="px-2 py-1">Dosis</th>
                    <th className="px-2 py-1">Cant.</th>
                  </tr>
                </thead>
                <tbody>
                  {productos.map((p, i) => (
                    <tr key={i} className={i % 2 ? "bg-[#F7F5EF]" : ""}>
                      <td className="border-b px-2 py-1 font-medium">{p.nombre}</td>
                      <td className="border-b px-2 py-1">{p.isp}</td>
                      <td className="border-b px-2 py-1">{p.formulacion}</td>
                      <td className="border-b px-2 py-1">{p.ingrediente}</td>
                      <td className="border-b px-2 py-1">{p.dosis}</td>
                      <td className="border-b px-2 py-1">{p.cantidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* Trabajo / Observaciones / Recomendaciones */}
          {(asStr(d.trabajo_realizado) || asStr(d.observaciones) || asStr(d.recomendaciones)) && (
            <section>
              <h2 className="cert-hdr">Observaciones y recomendaciones</h2>
              <div className="flex flex-col gap-1.5 rounded-lg border bg-[#F7F5EF] p-3 text-[11.5px] leading-relaxed">
                {asStr(d.trabajo_realizado) && (
                  <p>
                    <strong>Trabajo realizado:</strong> {asStr(d.trabajo_realizado)}
                  </p>
                )}
                {asStr(d.observaciones) && (
                  <p>
                    <strong>Observaciones:</strong> {asStr(d.observaciones)}
                  </p>
                )}
                {asStr(d.recomendaciones) && (
                  <p>
                    <strong>Recomendaciones:</strong> {asStr(d.recomendaciones)}
                  </p>
                )}
              </div>
            </section>
          )}

          {/* Firma */}
          <section className="mt-4 flex justify-center">
            <div className="w-64 text-center">
              <div className="flex h-20 items-end justify-center border-b border-[#1A1F2C]">
                {firma ? (
                  // eslint-disable-next-line @next/next/no-img-element -- firma heredada (base64/URL)
                  <img src={firma} alt="Firma representante técnico" className="max-h-20" />
                ) : null}
              </div>
              <p className="mt-1 text-[12px] font-semibold">{repTecNombre || "Representante Técnico"}</p>
              {repTecRut && <p className="text-[11px] text-[#4A5061]">{repTecRut}</p>}
              <p className="text-[11px] text-[#4A5061]">Representante Técnico</p>
            </div>
          </section>
        </div>

        {/* Pie */}
        <footer className="border-t-2 border-[#1B3A6B] p-4 text-center text-[9.5px] leading-snug text-[#4A5061]">
          <p className="font-semibold text-[#1A1F2C]">
            {asStr(cfg.nombre_legal, "Servicios de Fumigación y Control de Plagas Ltda.")} ·{" "}
            {asStr(cfg.direccion, "Francisco de Rioja 1260, San Bernardo")} · {asStr(cfg.correo, "contacto@serfuplagas.cl")}
          </p>
          <p className="mt-1">
            La adulteración o falsificación de este certificado y el uso de un certificado falso es un
            delito penado por la ley, descrito en los artículos 193, 197 y 198 del Código Penal chileno.
          </p>
          <p className="mt-1">
            Certificado folio {cert.folio} · emitido el {cert.issued_at ? santiagoDate(cert.issued_at) : "—"}.
          </p>
        </footer>
      </div>

      {/* Estilos de impresión: ocultar el marco de la app, dejar SOLO la hoja. */}
      <style>{`
        @media print {
          @page { size: A4; margin: 8mm; }
          body * { visibility: hidden; }
          .cert-sheet, .cert-sheet * { visibility: visible; }
          .cert-sheet { position: absolute; inset: 0; max-width: none; margin: 0; }
          .no-print { display: none !important; }
        }
        .cert-hdr {
          background: #1B3A6B; color: #fff; font-size: 11px; font-weight: 700;
          text-transform: uppercase; letter-spacing: .5px;
          padding: 3px 10px; border-radius: 4px; margin-bottom: 8px;
        }
        .cert-lbl {
          font-size: 9.5px; text-transform: uppercase; letter-spacing: .5px;
          color: #8B8F9B; margin-bottom: 1px;
        }
      `}</style>
    </div>
  );
}
