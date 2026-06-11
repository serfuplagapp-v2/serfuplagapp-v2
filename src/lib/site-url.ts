/**
 * URL pública del sitio, para construir enlaces absolutos (QR de verificación,
 * enlaces en correos). Prioridad:
 *   1. NEXT_PUBLIC_SITE_URL (si Carlos la define en Vercel / .env.local)
 *   2. La URL de producción que Vercel inyecta automáticamente
 *   3. localhost (desarrollo)
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}
