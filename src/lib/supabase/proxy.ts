import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./types";

/**
 * Refresca la sesión del usuario en cada request. Es OBLIGATORIO para que la
 * autenticación funcione con renderizado en servidor: mantiene las cookies de
 * sesión al día y vuelve a colocarlas en la respuesta.
 *
 * Se usa desde `proxy.ts` (en Next.js 16 el antiguo "middleware" se llama "proxy").
 * No hace redirecciones: el control de acceso (quién puede entrar a qué) se
 * decide en el layout protegido. Aquí solo se mantiene viva la sesión.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // IMPORTANTE: no escribir código entre crear el cliente y getUser().
  // getUser() revalida el token contra Supabase y refresca la sesión.
  await supabase.auth.getUser();

  return supabaseResponse;
}
