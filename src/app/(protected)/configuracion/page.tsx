import Link from "next/link";
import { Building2, HardHat, Settings, Tags, Users } from "lucide-react";

import { requireEnabledProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TenantForm, ServiceTypeForm } from "./config-forms";
import { toggleServiceType } from "./actions";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  owner: "Dueño",
  admin: "Administrador",
  tecnico: "Técnico",
  cliente_portal: "Portal cliente",
};

export default async function ConfiguracionPage() {
  const { role, tenantId } = await requireEnabledProfile();
  const canEdit = role === "owner" || role === "admin";
  const supabase = await createClient();

  const [{ data: tenant }, { data: types }, { data: team }] = await Promise.all([
    supabase.from("tenants").select("name, rut").eq("id", tenantId).maybeSingle(),
    supabase.from("service_types").select("id, name, active").order("name").limit(200),
    supabase.from("profiles").select("id, full_name, role").order("full_name").limit(200),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="modulo-sticky-top">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Settings className="text-primary size-6" aria-hidden />
          Configuración
        </h1>
        <p className="text-muted-foreground text-sm">
          Datos de la empresa, catálogos y equipo.
        </p>
      </div>

      {/* Empresa */}
      <section className="bg-card rounded-xl border p-4">
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <Building2 className="text-primary size-4" aria-hidden />
          Empresa
        </h2>
        <TenantForm name={tenant?.name ?? ""} rut={tenant?.rut ?? ""} canEdit={canEdit} />
      </section>

      {/* Tipos de servicio */}
      <section className="bg-card rounded-xl border p-4">
        <h2 className="mb-1 flex items-center gap-2 font-semibold">
          <Tags className="text-primary size-4" aria-hidden />
          Tipos de servicio
        </h2>
        <p className="text-muted-foreground mb-3 text-xs">
          Los tipos inactivos dejan de aparecer al crear órdenes, pero la historia se conserva.
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          {(types ?? []).map((t) => (
            <form key={t.id} action={toggleServiceType}>
              <input type="hidden" name="id" value={t.id} />
              <input type="hidden" name="active" value={t.active ? "false" : "true"} />
              <button
                type="submit"
                className={
                  "rounded-full border px-3 py-1 text-sm transition-colors " +
                  (t.active
                    ? "bg-secondary text-secondary-foreground hover:border-destructive/40"
                    : "text-muted-foreground/60 line-through hover:text-foreground")
                }
                title={t.active ? "Clic para desactivar" : "Clic para reactivar"}
              >
                {t.name}
              </button>
            </form>
          ))}
        </div>
        <ServiceTypeForm />
      </section>

      {/* Equipo */}
      <section className="bg-card rounded-xl border p-4">
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <Users className="text-primary size-4" aria-hidden />
          Equipo con acceso a la app
        </h2>
        <ul className="divide-y">
          {(team ?? []).map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="font-medium">{p.full_name ?? "(sin nombre)"}</span>
              <Badge variant="muted">{p.role ? (ROLE_LABEL[p.role] ?? p.role) : "Sin rol"}</Badge>
            </li>
          ))}
        </ul>
        <div className="mt-3 border-t pt-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/tecnicos">
              <HardHat className="size-4" />
              Administrar técnicos de terreno
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
