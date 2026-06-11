"use server";

import { revalidatePath } from "next/cache";
import QRCode from "qrcode";

import { requireEnabledProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fechaLarga, getCertificateView, type CertificateView } from "@/lib/certificates";
import { renderCertificatePdf } from "@/lib/pdf/certificate-pdf";
import { emailConfigured, sendEmail } from "@/lib/email";
import { getSiteUrl } from "@/lib/site-url";
import type { CertActionState } from "./state";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function verifyUrlFor(view: CertificateView): string {
  return `${getSiteUrl()}/verificar/${view.verifyCode}`;
}

/**
 * Genera el PDF del certificado y lo deja en el bucket privado `certificados`
 * (ruta {tenant}/{certificado}.pdf, sobrescribiendo la versión anterior).
 * Devuelve también el buffer para poder adjuntarlo a un correo sin re-generar.
 */
async function buildAndStorePdf(
  certId: string,
  tenantId: string,
): Promise<{ view: CertificateView; pdf: Buffer; verifyUrl: string } | { error: string }> {
  const view = await getCertificateView(certId, tenantId);
  if (!view) return { error: "No se encontró el certificado." };

  const verifyUrl = verifyUrlFor(view);
  let qrDataUrl: string | null = null;
  try {
    qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 256 });
  } catch {
    qrDataUrl = null; // sin QR el certificado sigue siendo válido
  }

  let pdf: Buffer;
  try {
    pdf = await renderCertificatePdf({ view, qrDataUrl, verifyUrl });
  } catch {
    return { error: "No se pudo generar el PDF. Inténtalo de nuevo." };
  }

  const supabase = await createClient();
  const path = `${tenantId}/${view.id}.pdf`;
  const { error: upErr } = await supabase.storage
    .from("certificados")
    .upload(path, pdf, { contentType: "application/pdf", upsert: true });
  if (upErr) return { error: "El PDF se generó pero no se pudo guardar en el archivo de la empresa." };

  if (view.pdfPath !== path) {
    await supabase.from("certificates").update({ pdf_path: path }).eq("id", view.id);
  }
  return { view, pdf, verifyUrl };
}

/** Botón "Generar/actualizar PDF" de la vista del certificado. */
export async function generarPdfCertificado(
  _prev: CertActionState,
  fd: FormData,
): Promise<CertActionState> {
  const { tenantId } = await requireEnabledProfile();
  const certId = String(fd.get("id") ?? "").trim();
  if (!certId) return { error: "Certificado inválido.", ok: null };

  const result = await buildAndStorePdf(certId, tenantId);
  if ("error" in result) return { error: result.error, ok: null };

  revalidatePath(`/terreno/${certId}`);
  return { error: null, ok: "PDF generado y guardado. Ya puedes descargarlo." };
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Cuerpo interior del correo (la plantilla corporativa la agrega email.ts, como la v1). */
function emailHtml(view: CertificateView, verifyUrl: string): string {
  const e = view.empresa;
  const lugar = [view.sucursalNombre, view.direccion].filter(Boolean).join(" — ");
  const vigencia = view.fechaVigencia
    ? `<p>El certificado tiene vigencia hasta el <strong>${escapeHtml(fechaLarga(view.fechaVigencia))}</strong>.</p>`
    : "";
  return `
<p>Estimado(a) cliente:</p>
<p>
  Adjuntamos el <strong>Certificado de Control de Plagas N° ${view.folio}</strong>
  correspondiente al servicio realizado el <strong>${escapeHtml(fechaLarga(view.serviceDate))}</strong>${
    lugar ? ` en ${escapeHtml(lugar)}` : ""
  }.
</p>
${vigencia}
<p style="font-size:13px;color:#666">
  Puede verificar la autenticidad de este certificado escaneando el código QR del documento
  o ingresando a:<br>
  <a href="${verifyUrl}">${verifyUrl}</a>
</p>
<p>
  Atentamente,<br>
  <strong>${escapeHtml(e.nombreLegal)}</strong><br>
  <span style="font-size:13px;color:#666">${escapeHtml(e.direccion)} · ${escapeHtml(e.correo)}</span>
</p>`;
}

/** Botón "Enviar por correo": genera el PDF al momento y lo adjunta. */
export async function enviarCertificado(
  _prev: CertActionState,
  fd: FormData,
): Promise<CertActionState> {
  const { tenantId } = await requireEnabledProfile();
  const certId = String(fd.get("id") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!certId) return { error: "Certificado inválido.", ok: null };
  if (!EMAIL_RE.test(email)) return { error: "Escribe un correo válido (ej: nombre@empresa.cl).", ok: null };
  if (!emailConfigured()) {
    return {
      error: "El envío de correos no está configurado todavía (faltan RESEND_API_KEY y EMAIL_FROM).",
      ok: null,
    };
  }

  const result = await buildAndStorePdf(certId, tenantId);
  if ("error" in result) return { error: result.error, ok: null };
  const { view, pdf, verifyUrl } = result;

  const { error: mailErr } = await sendEmail({
    to: [email],
    subject: `Certificado de Control de Plagas N° ${view.folio} — ${view.empresa.nombreLegal}`,
    html: emailHtml(view, verifyUrl),
    replyTo: view.empresa.correo || undefined,
    attachments: [
      { filename: `certificado-${view.folio}.pdf`, contentBase64: pdf.toString("base64") },
    ],
  });
  if (mailErr) return { error: mailErr, ok: null };

  const supabase = await createClient();
  await supabase
    .from("certificates")
    .update({ sent_at: new Date().toISOString(), sent_to: email })
    .eq("id", certId);

  revalidatePath(`/terreno/${certId}`);
  return { error: null, ok: `Certificado enviado a ${email}.` };
}
