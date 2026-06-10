import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/supabase/types";

export interface SessionProfile {
  user: User | null;
  profile: {
    full_name: string | null;
    role: UserRole | null;
    tenant_id: string | null;
  } | null;
  tenantName: string | null;
}

export interface EnabledProfile {
  user: User;
  fullName: string;
  role: UserRole;
  tenantId: string;
  tenantName: string;
}

/**
 * Lee la sesión y el perfil del usuario UNA sola vez por request (React cache),
 * para que el layout y las páginas no repitan la consulta. Fuente única de verdad
 * sobre quién está conectado y a qué empresa pertenece.
 */
export const getSessionProfile = cache(async (): Promise<SessionProfile> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null, tenantName: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, tenant_id")
    .eq("id", user.id)
    .maybeSingle();

  let tenantName: string | null = null;
  if (profile?.tenant_id) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", profile.tenant_id)
      .maybeSingle();
    tenantName = tenant?.name ?? null;
  }

  return { user, profile: profile ?? null, tenantName };
});

/**
 * Para usar en CADA página o Server Action que toque datos sensibles:
 * exige sesión + perfil habilitado (empresa y rol). Si no, corta el acceso.
 *
 * Recordatorio de seguridad (revisión de Fase 0): el layout protegido solo
 * controla lo que se MUESTRA; la barrera REAL de datos es la RLS de la base. Por
 * eso toda lógica que lea o escriba datos del tenant debe pasar por aquí (o
 * confiar en la RLS), nunca asumir "si estoy bajo el layout, estoy autorizado".
 *
 * No llamar desde /panel (provocaría un redirect en bucle); el layout ya cubre
 * ese caso mostrando la pantalla "cuenta no habilitada".
 */
export async function requireEnabledProfile(): Promise<EnabledProfile> {
  const { user, profile, tenantName } = await getSessionProfile();

  if (!user) {
    redirect("/login");
  }
  if (!profile || !profile.tenant_id || !profile.role) {
    redirect("/panel");
  }

  return {
    user,
    fullName: profile.full_name ?? user.email ?? "Usuario",
    role: profile.role,
    tenantId: profile.tenant_id,
    tenantName: tenantName ?? "Mi empresa",
  };
}
