import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { CuentaNoHabilitada } from "@/components/cuenta-no-habilitada";
import { getSessionProfile } from "@/lib/auth";
import type { UserRole } from "@/lib/supabase/types";

const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Dueño",
  admin: "Administrador",
  tecnico: "Técnico",
  cliente_portal: "Cliente",
};

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, tenantName } = await getSessionProfile();

  // Sin sesión → al login.
  if (!user) {
    redirect("/login");
  }

  // Con sesión pero sin empresa o sin rol → cuenta no habilitada (seguro por defecto).
  if (!profile || !profile.tenant_id || !profile.role) {
    return (
      <CuentaNoHabilitada
        email={user.email ?? ""}
        name={profile?.full_name ?? null}
      />
    );
  }

  return (
    <AppShell
      userName={profile.full_name ?? user.email ?? "Usuario"}
      tenantName={tenantName ?? "Mi empresa"}
      roleLabel={ROLE_LABELS[profile.role]}
    >
      {children}
    </AppShell>
  );
}
