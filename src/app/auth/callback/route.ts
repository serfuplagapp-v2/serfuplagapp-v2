import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

/**
 * Solo permitimos redirigir a rutas INTERNAS de la app. Evita el "open redirect":
 * un enlace de correo manipulado con next=//sitio-malicioso.com no debe sacar al
 * usuario fuera de nuestro dominio.
 */
function safeNext(next: string | null): string {
  if (
    next &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.startsWith("/\\")
  ) {
    return next;
  }
  return "/panel";
}

/**
 * Procesa los enlaces que llegan por correo (confirmar cuenta / recuperar
 * contraseña). Soporta los dos formatos de Supabase:
 *  - PKCE (plantillas por defecto): llega `?code=...` → exchangeCodeForSession.
 *  - token_hash (si se personaliza la plantilla): llega `?token_hash=...&type=...`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = safeNext(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=enlace_invalido`);
}
