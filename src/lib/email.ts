/**
 * Envío de correos vía Resend (https://resend.com) usando su API HTTP directa
 * (sin SDK: una dependencia menos). Variables de entorno:
 *
 *   RESEND_API_KEY  — llave secreta de Resend (Vercel + .env.local, NUNCA al repo).
 *   EMAIL_FROM      — remitente verificado, ej: "Serfuplagas <certificados@serfuplagas.cl>".
 *
 * Si faltan, la app sigue funcionando: los botones de envío muestran un aviso
 * claro de configuración pendiente en vez de fallar.
 */

export interface EmailAttachment {
  filename: string;
  /** Contenido del archivo en base64. */
  contentBase64: string;
}

export interface SendEmailInput {
  to: string[];
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

/** ¿Está configurado el proveedor de correo? (la UI lo usa para avisar). */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/** Envía un correo. Devuelve { error: null } si salió bien. */
export async function sendEmail(input: SendEmailInput): Promise<{ error: string | null }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    return {
      error:
        "El envío de correos no está configurado todavía (faltan RESEND_API_KEY y EMAIL_FROM).",
    };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
        ...(input.attachments?.length
          ? {
              attachments: input.attachments.map((a) => ({
                filename: a.filename,
                content: a.contentBase64,
              })),
            }
          : {}),
      }),
    });

    if (!res.ok) {
      let detail = "";
      try {
        const body = (await res.json()) as { message?: string };
        detail = body?.message ?? "";
      } catch {
        // sin detalle
      }
      return { error: `El proveedor de correo rechazó el envío${detail ? `: ${detail}` : "."}` };
    }
    return { error: null };
  } catch {
    return { error: "No se pudo contactar al proveedor de correo. Inténtalo de nuevo." };
  }
}
