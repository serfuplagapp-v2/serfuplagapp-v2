import { HardHat } from "lucide-react";

import { requireEnabledProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TechForm } from "./tech-form";
import { toggleTechnician } from "./actions";

export const dynamic = "force-dynamic";

export default async function TecnicosPage() {
  await requireEnabledProfile();
  const supabase = await createClient();

  const { data: technicians } = await supabase
    .from("technicians")
    .select("id, full_name, license_info, active")
    .order("active", { ascending: false })
    .order("full_name");
  const list = technicians ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <HardHat className="text-primary size-6" aria-hidden />
          Técnicos
        </h1>
        <p className="text-muted-foreground text-sm">
          Tu equipo de terreno. A ellos asignas las visitas y armas las rutas del día.
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
              className="bg-card flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
            >
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
          ))}
        </div>
      )}
    </div>
  );
}
