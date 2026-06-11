import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import QRCode from "qrcode";

import { requireEnabledProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { santiagoDate } from "@/lib/datetime";
import { fechaLarga, getCertificateView } from "@/lib/certificates";
import { emailConfigured } from "@/lib/email";
import { getSiteUrl } from "@/lib/site-url";
import { Button } from "@/components/ui/button";
import { PrintButton } from "./print-button";
import { SendCertificate } from "./send-certificate";

export const dynamic = "force-dynamic";

export default async function CertificadoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tenantId } = await requireEnabledProfile();
  const { id } = await params;

  const view = await getCertificateView(id, tenantId);
  if (!view) notFound();
  const e = view.empresa;

  // Observaciones por defecto de Configuración (en el certificado van primero, v1).
  const obsCfg = [e.obsDefault, e.recsDefault].filter(Boolean).join(" ").trim();

  // Sub-etiqueta v1 de la tabla de productos según el primer tratamiento.
  const SUB_LABEL: Record<string, string> = {
    desratización: "Desratización — Rodenticidas / Cebos",
    desinsectación: "Desinsectación — Productos químicos",
    sanitización: "Sanitización — Productos",
    aromatización: "Aromatización — Productos",
  };
  const primerServicio = (view.servicios[0] ?? "").toLowerCase().trim();
  const subLabelProductos = view.servicios.length
    ? (SUB_LABEL[primerServicio] ?? `${view.servicios[0]} — Productos`)
    : "Productos utilizados";

  // QR de verificación pública (va impreso en la hoja y dentro del PDF).
  const verifyUrl = `${getSiteUrl()}/verificar/${view.verifyCode}`;
  let qrDataUrl: string | null = null;
  try {
    qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 192 });
  } catch {
    qrDataUrl = null;
  }

  const supabase = await createClient();

  // Enlace de descarga del PDF guardado (URL firmada, 1 hora).
  let pdfUrl: string | null = null;
  if (view.pdfPath) {
    const { data: signed } = await supabase.storage
      .from("certificados")
      .createSignedUrl(view.pdfPath, 3600, { download: `certificado-${view.folio}.pdf` });
    pdfUrl = signed?.signedUrl ?? null;
  }

  // Correo sugerido: el firmante del servicio o, si no hay, el contacto
  // destinatario del cliente (priorizando el de la misma sucursal).
  let prefillEmail = view.correoFirmante;
  if (!prefillEmail && view.clientId) {
    const { data: contactos } = await supabase
      .from("contacts")
      .select("email, branch_id, es_destinatario, orden")
      .eq("client_id", view.clientId)
      .not("email", "is", null)
      .order("orden")
      .limit(50);
    const lista = (contactos ?? []).filter((c) => (c.email ?? "").includes("@"));
    const pick =
      lista.find((c) => c.es_destinatario && c.branch_id !== null && c.branch_id === view.branchId) ??
      lista.find((c) => c.es_destinatario) ??
      lista[0];
    prefillEmail = pick?.email ?? "";
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Controles (no se imprimen) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
          <Link href={view.serviceId ? `/ordenes/${view.serviceId}` : "/terreno"}>
            <ChevronLeft className="size-4" />
            Volver
          </Link>
        </Button>
        <PrintButton />
      </div>

      <SendCertificate
        certId={view.id}
        pdfUrl={pdfUrl}
        sentAtLabel={view.sentAt ? fechaLarga(view.sentAt) : null}
        sentTo={view.sentTo}
        defaultEmail={prefillEmail}
        emailReady={emailConfigured()}
      />

      {/* Hoja del certificado (réplica de la plantilla v1) */}
      <div className="cert-sheet mx-auto w-full max-w-[210mm] bg-white text-[#1A1F2C] shadow-md print:shadow-none">
        {/* Encabezado (v1: empresa | CERTIFICADO | logo) */}
        <header className="flex items-start justify-between gap-4 border-b-4 border-[#1B3A6B] p-6 pb-4">
          <div className="w-60 text-[11px] leading-snug">
            <p className="text-[13px] font-bold">{e.nombreLegal}</p>
            <p>RUT: {e.rut}</p>
            {e.tel && <p>Tel: {e.tel}</p>}
            <p>{e.direccion}</p>
            <p className="mt-1 font-medium">Res. Sanitaria {e.resSan} · SEREMI de Salud R.M.</p>
            {e.repLegal && <p>Representante: {e.repLegal}</p>}
          </div>
          <div className="flex-1 pt-2 text-center">
            <p className="text-2xl font-bold tracking-wide text-[#1B3A6B]">CERTIFICADO</p>
            <p className="text-[11px] text-[#4A5061]">Control de Plagas e Higiene Ambiental</p>
          </div>
          <div className="w-36 text-right">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo heredado v1 */}
            <img src="/logo-serfuplagas.png" alt="Serfuplagas" className="ml-auto w-32" />
          </div>
        </header>

        <div className="flex flex-col gap-4 p-6">
          {/* Identificación del inmueble (con celda de folio, v1) */}
          <section>
            <h2 className="cert-hdr">Identificación del inmueble</h2>
            <div className="flex gap-4 text-[12px]">
              <div className="flex-1">
                <p className="cert-lbl">Cliente / Sucursal</p>
                <p className="font-semibold">{view.clienteNombre || "—"}</p>
                {view.sucursalNombre && <p>{view.sucursalNombre}</p>}
                <p className="text-[#4A5061]">{view.direccion}</p>
              </div>
              <div className="flex-1">
                <p className="cert-lbl">Diagnóstico previo</p>
                <p className="font-semibold">{view.plagas.length ? view.plagas.join(", ") : "Sin evidencia"}</p>
                {view.grado && <p className="text-[#4A5061]">Grado de infestación: {view.grado}</p>}
              </div>
              <div className="flex w-28 flex-col items-center justify-center rounded-lg border-2 border-[#1B3A6B] px-3 py-1 text-center">
                <p className="cert-lbl">Folio N°</p>
                <p className="text-xl font-bold text-[#1B3A6B] tabular-nums">{view.folio}</p>
              </div>
            </div>
          </section>

          {/* Datos del servicio */}
          <section>
            <h2 className="cert-hdr">Datos del servicio</h2>
            <div className="grid grid-cols-2 gap-4 text-[12px]">
              <div>
                <p className="cert-lbl">Persona que solicitó el trabajo</p>
                <p className="font-semibold">{view.titular || "—"}</p>
                {view.rutFirmante && <p className="text-[#4A5061]">RUT: {view.rutFirmante}</p>}
                {view.correoFirmante && <p className="text-[#4A5061]">{view.correoFirmante}</p>}
              </div>
              <div>
                <p className="cert-lbl">Identificación del propietario / empresa</p>
                <p className="font-semibold">{view.clienteNombre || "—"}</p>
                {view.clienteRut && <p className="text-[#4A5061]">RUT: {view.clienteRut}</p>}
                {view.direccion && <p className="text-[#4A5061]">Dirección: {view.direccion}</p>}
              </div>
            </div>
          </section>

          {/* Fechas (v1: servicio / inicio del tratamiento / vigencia) */}
          <section className="grid grid-cols-3 gap-2 text-center text-[12px]">
            <div className="rounded-lg border p-2">
              <p className="cert-lbl">Fecha del servicio</p>
              <p className="font-semibold">{fechaLarga(view.serviceDate)}</p>
            </div>
            <div className="rounded-lg border p-2">
              <p className="cert-lbl">Inicio del tratamiento</p>
              <p className="font-semibold">{fechaLarga(view.serviceDate)}</p>
            </div>
            <div className="rounded-lg border-2 border-[#1B3A6B] bg-[#1B3A6B]/5 p-2">
              <p className="cert-lbl">Vigencia del certificado</p>
              <p className="font-semibold">{fechaLarga(view.fechaVigencia || null)}</p>
            </div>
          </section>

          {/* Tratamientos */}
          <section>
            <h2 className="cert-hdr">Tratamientos realizados</h2>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="cert-lbl !mb-0">Tipo:</span>
              {(view.servicios.length ? view.servicios : ["Control de Plagas"]).map((t) => (
                <span key={t} className="rounded-full bg-[#1B3A6B] px-3 py-0.5 text-[11px] font-medium text-white">
                  {t}
                </span>
              ))}
            </div>
          </section>

          {/* Metodología y lugares */}
          <section className="grid grid-cols-2 gap-4 text-[12px]">
            <div>
              <p className="cert-lbl">Metodología aplicada</p>
              <p className="font-semibold">{view.metodologia}</p>
              {view.insumos && <p className="text-[#4A5061]">Insumos: {view.insumos}</p>}
            </div>
            <div>
              <p className="cert-lbl">Lugares tratados</p>
              {view.areas.length ? (
                <div className="flex flex-wrap gap-1">
                  {view.areas.map((a) => (
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

          {/* Productos (v1: con Concentración y sub-etiqueta por tratamiento) */}
          {view.productos.length > 0 && (
            <section>
              <h2 className="cert-hdr">Productos utilizados</h2>
              <p className="cert-lbl">{subLabelProductos}</p>
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr className="bg-[#1B3A6B] text-left text-white">
                    <th className="px-2 py-1">Nombre comercial</th>
                    <th className="px-2 py-1">Reg. ISP</th>
                    <th className="px-2 py-1">Formulación</th>
                    <th className="px-2 py-1">Ingrediente activo</th>
                    <th className="px-2 py-1">Concentración</th>
                    <th className="px-2 py-1">Dosis</th>
                    <th className="px-2 py-1">Cant.</th>
                  </tr>
                </thead>
                <tbody>
                  {view.productos.map((p, i) => (
                    <tr key={i} className={i % 2 ? "bg-[#F7F5EF]" : ""}>
                      <td className="border-b px-2 py-1 font-medium">{p.nombre}</td>
                      <td className="border-b px-2 py-1">{p.isp}</td>
                      <td className="border-b px-2 py-1">{p.formulacion}</td>
                      <td className="border-b px-2 py-1">{p.ingrediente}</td>
                      <td className="border-b px-2 py-1">{p.concentracion}</td>
                      <td className="border-b px-2 py-1">{p.dosis}</td>
                      <td className="border-b px-2 py-1">{p.cantidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* Observaciones y recomendaciones (v1: defaults de Configuración SIEMPRE primero) */}
          {(obsCfg || view.observaciones || view.recomendaciones) && (
            <section>
              <h2 className="cert-hdr">Observaciones y recomendaciones</h2>
              <div className="flex flex-col gap-1.5 rounded-lg border bg-[#F7F5EF] p-3 text-[11.5px] leading-relaxed">
                {obsCfg && <p>{obsCfg}</p>}
                {view.observaciones && <p>{view.observaciones}</p>}
                {view.recomendaciones && <p>{view.recomendaciones}</p>}
              </div>
            </section>
          )}

          {/* Firma */}
          <section className="mt-4 flex justify-center">
            <div className="w-64 text-center">
              <div className="flex h-20 items-end justify-center border-b border-[#1A1F2C]">
                {e.firma ? (
                  // eslint-disable-next-line @next/next/no-img-element -- firma heredada (base64/URL)
                  <img src={e.firma} alt="Firma representante técnico" className="max-h-20" />
                ) : null}
              </div>
              <p className="mt-1 text-[12px] font-semibold">{e.repTecNombre}</p>
              {e.repTecRut && <p className="text-[11px] text-[#4A5061]">{e.repTecRut}</p>}
              <p className="text-[11px] text-[#4A5061]">Representante Técnico</p>
            </div>
          </section>
        </div>

        {/* Pie (v1: contacto + leyenda legal + QR "Verificar documento") */}
        <footer className="border-t-2 border-[#1B3A6B] p-4 text-[9.5px] leading-snug text-[#4A5061]">
          <div className="flex items-center gap-3">
            <div className="flex-1 text-center">
              <p className="font-semibold text-[#1A1F2C]">{e.nombreLegal}</p>
              <p className="mt-0.5">
                {[e.direccion, e.tel ? `Tel: ${e.tel}` : "", e.correo].filter(Boolean).join(" · ")}
              </p>
              <p className="mt-1">{e.textoLegal}</p>
              <p className="mt-1">
                Certificado folio {view.folio} · emitido el {view.issuedAt ? santiagoDate(view.issuedAt) : "—"}.
              </p>
            </div>
            {qrDataUrl && (
              <div className="shrink-0 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element -- QR generado en el servidor (data URL) */}
                <img src={qrDataUrl} alt="Código QR de verificación" className="h-16 w-16" />
                <p className="mt-0.5 text-[6.5px]">
                  Verificar
                  <br />
                  documento
                </p>
              </div>
            )}
          </div>
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
