import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

// En Next.js 16, el antiguo "middleware" se llama "proxy" (corre en Node.js).
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Se ejecuta en todas las rutas EXCEPTO archivos estáticos e imágenes,
     * para no gastar recursos donde no hay sesión que refrescar.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
