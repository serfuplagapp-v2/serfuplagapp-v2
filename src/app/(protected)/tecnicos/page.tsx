import { HardHat, Smartphone } from "lucide-react";

import { requireEnabledProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { TechForm } from "./tech-form";
import { linkTechnicianProfile, toggleTechnician } from "./actions";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<UserRole, string> = {
  owner: "Dueño",
  admin: "Administrador",
  tecnico: "Técnico",
  cliente_portal: "Portal cliente",
};

export default async function TecnicosPage() {
  await requireEnabledProfile();
  const supabase = await createClient();

  const [{ data: technicians }, { data: profiles }] = await Promise.all([
    supabase
      .from("technicians")
      .select("id, full_name, license_info, active, profile_id")
      .order("active", { ascending: false })
      .order("full_name"),
    supabase.from("profiles").select("id, full_name, role").order("full_name").limit(200),
  ]);
  const list = technicians ?? [];
  const cuentas = (profiles ?? []).filter((p) => p.role !== null);

  return (
    <div className="flex flex-col gap-6">
      <div className="modulo-sticky-top">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <HardHat className="text-primary size-6" aria-hidden />
          Técnicos
        </h1>
        <p className="text-muted-foreground text-sm">
          Tu equipo de terreno. A ellos asignas las visitas y armas las rutas del día. Si
          enlazas su cuenta de la app, el técnico verá solo sus visitas en Terreno →
          Visitas de hoy (desde su teléfono).
        </p>
      </div>

      <TechForm />

      {list.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aún no hay técnicos. Agrega el primero arriba.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((t) => (
            <div
              key={t.id}
              className="bg-card flex flex-col gap-3 rounded-lg border p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">
                    {t.full_name}
                    {!t.active && <Badge variant="muted">Inactivo</Badge>}
                  </p>
                  {t.license_info && (
                    <p className="text-muted-foreground text-xs">{t.license_info}</p>
                  )}
                </div>
                <form action={toggleTechnician}>
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="active" value={t.active ? "false" : "true"} />
                  <Button type="submit" size="sm" variant="outline">
                    {t.active ? "Desactivar" : "Activar"}
                  </Button>
                </form>
              </div>

              <form
                action={linkTechnicianProfile}
                className="flex flex-wrap items-center gap-2 border-t pt-3"
              >
                <input type="hidden" name="id" value={t.id} />
                <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <Smartphone className="size-3.5" aria-hidden />
                  Cuenta de la app:
                </span>
                <div className="w-full max-w-64">
                  <Select name="profile_id" defaultValue={t.profile_id ?? ""} className="h-9 md:text-xs">
                    <option value="">Sin cuenta enlazada</option>
                    {cuentas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name ?? "(sin nombre)"} · {p.role ? ROLE_LABEL[p.role] : ""}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button type="submit" size="sm" variant="outline">
                  Guardar
                </Button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
