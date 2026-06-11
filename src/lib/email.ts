/**
 * Envío de correos vía Microsoft Graph API — el MISMO mecanismo de la v1
 * (functions/correo.js): la empresa ya tiene una app registrada en Azure con
 * permiso Mail.Send y envía desde sus casillas reales de Microsoft 365.
 *
 * Variables de entorno (los mismos secretos GRAPH_* de la v1, copiados a
 * Vercel y .env.local — NUNCA al repo):
 *
 *   GRAPH_TENANT_ID     — id del directorio (tenant) de Azure AD
 *   GRAPH_CLIENT_ID     — id de la aplicación
 *   GRAPH_CLIENT_SECRET — secreto de la aplicación
 *   GRAPH_SENDER_EMAIL  — casilla remitente (ej: operaciones@serfuplagas.cl)
 *
 * Si faltan, la app sigue funcionando: los botones de envío muestran un aviso
 * claro de configuración pendiente en vez de fallar.
 */

export interface EmailAttachment {
  filename: string;
  /** Contenido del archivo en base64. */
  contentBase64: string;
  mimeType?: string;
}

export interface SendEmailInput {
  to: string[];
  subject: string;
  /** Cuerpo interior: se envuelve en la plantilla corporativa (header/footer v1). */
  html: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

/** ¿Está configurado el envío por Microsoft Graph? (la UI lo usa para avisar). */
export function emailConfigured(): boolean {
  return Boolean(
    process.env.GRAPH_TENANT_ID &&
      process.env.GRAPH_CLIENT_ID &&
      process.env.GRAPH_CLIENT_SECRET &&
      process.env.GRAPH_SENDER_EMAIL,
  );
}

// Token de aplicación (client credentials), con caché en memoria del proceso
// — igual que lib/graph de la v1.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function graphToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.value;
  const tenant = process.env.GRAPH_TENANT_ID!;
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GRAPH_CLIENT_ID!,
      client_secret: process.env.GRAPH_CLIENT_SECRET!,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) throw new Error(`token ${res.status}`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return body.access_token;
}

/** Plantilla base corporativa (réplica del wrapper de functions/correo.js v1). */
function wrapHtml(inner: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body { margin:0; padding:0; background:#f4f4f4; font-family:Arial,sans-serif; }
    .wrapper { max-width:620px; margin:24px auto; background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,.12); }
    .header  { background:#1e3a5f; padding:20px 32px; }
    .body    { padding:32px; color:#222; font-size:15px; line-height:1.6; }
    .footer  { background:#f0f0f0; padding:16px 32px; font-size:12px; color:#888; border-top:1px solid #ddd; }
    a { color:#1e6fbf; }
    b, strong { color:#1e3a5f; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <span style="color:#fff;font-size:20px;font-weight:bold;letter-spacing:1px;">SERFUPLAGAS</span>
    </div>
    <div class="body">
      ${inner}
    </div>
    <div class="footer" style="text-align:center">
      <img src="https://serfuplagapp-e436d.web.app/assets/img/logo-serfuplagas.png"
        alt="Serfuplagas" style="height:56px;margin-bottom:10px;display:block;margin-left:auto;margin-right:auto">
      Serfuplagas Ltda &nbsp;|&nbsp; Servicio de Fumigación y Control de Plagas &nbsp;|&nbsp;
      <a href="https://www.serfuplagas.cl">www.serfuplagas.cl</a>
    </div>
  </div>
</body>
</html>`;
}

/** Envía un correo desde la casilla de la empresa. Devuelve { error: null } si salió bien. */
export async function sendEmail(input: SendEmailInput): Promise<{ error: string | null }> {
  if (!emailConfigured()) {
    return {
      error:
        "El envío de correos no está configurado todavía (faltan los secretos GRAPH_* de Microsoft en Vercel).",
    };
  }

  let token: string;
  try {
    token = await graphToken();
  } catch {
    return { error: "No se pudo autenticar con Microsoft (revisa los secretos GRAPH_*)." };
  }

  const sender = process.env.GRAPH_SENDER_EMAIL!;
  const message = {
    subject: input.subject,
    body: { contentType: "HTML", content: wrapHtml(input.html) },
    toRecipients: input.to.map((a) => ({ emailAddress: { address: a } })),
    ...(input.replyTo ? { replyTo: [{ emailAddress: { address: input.replyTo } }] } : {}),
    ...(input.attachments?.length
      ? {
          attachments: input.attachments.map((a) => ({
            "@odata.type": "#microsoft.graph.fileAttachment",
            name: a.filename,
            contentType: a.mimeType ?? "application/pdf",
            contentBytes: a.contentBase64,
          })),
        }
      : {}),
  };

  try {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message, saveToSentItems: true }),
      },
    );
    if (!res.ok) {
      let detail = "";
      try {
        const body = (await res.json()) as { error?: { message?: string } };
        detail = body?.error?.message ?? "";
      } catch {
        // sin detalle
      }
      return { error: `Microsoft rechazó el envío${detail ? `: ${detail}` : "."}` };
    }
    return { error: null };
  } catch {
    return { error: "No se pudo contactar a Microsoft. Inténtalo de nuevo." };
  }
}
