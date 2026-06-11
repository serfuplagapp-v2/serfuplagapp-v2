import Link from "next/link";
import { LayoutTemplate } from "lucide-react";

import { requireEnabledProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

export default async function LayoutsPage() {
  await requireEnabledProfile();
  const supabase = await createClient();

  // OJO rendimiento: NUNCA traer bg_image acá (puede pesar cientos de KB);
  // solo metadatos + miniatura.
  const { data: layoutsRaw } = await supabase
    .from("layouts")
    .select("id, name, client_id, branch_id, thumbnail, snapshot_url, elements")
    .order("name")
    .limit(200);
  const layouts = layoutsRaw ?? [];

  const clientName = new Map<string, string>();
  const branchName = new Map<string, string>();
  const clientIds = [...new Set(layouts.map((l) => l.client_id).filter((x): x is string => !!x))];
  const branchIds = [...new Set(layouts.map((l) => l.branch_id).filter((x): x is string => !!x))];
  if (clientIds.length) {
    const { data } = await supabase.from("clients").select("id, name").in("id", clientIds);
    for (const c of data ?? []) clientName.set(c.id, c.name);
  }
  if (branchIds.length) {
    const { data } = await supabase.from("branches").select("id, name").in("id", branchIds);
    for (const b of data ?? []) branchName.set(b.id, b.name);
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <LayoutTemplate className="text-primary size-6" aria-hidden />
          Layouts
        </h1>
        <p className="text-muted-foreground text-sm">
          {layouts.length} planos con sus estaciones, traídos de la v1. El editor visual llega
          en la Fase 3.
        </p>
      </div>

      {layouts.length === 0 ? (
        <Alert>
          <AlertTitle>Sin layouts</AlertTitle>
          <AlertDescription>Aún no hay planos cargados.</AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {layouts.map((l) => {
            const elementos = Array.isArray(l.elements) ? l.elements.length : 0;
            const img =
              l.thumbnail && l.thumbnail.startsWith("data:")
                ? l.thumbnail
                : (l.snapshot_url ?? null);
            return (
              <div key={l.id} className="bg-card overflow-hidden rounded-xl border">
                <div className="bg-muted flex h-36 items-center justify-center overflow-hidden">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element -- miniaturas base64/URL heredadas de la v1; next/image no aplica
                    <img src={img} alt={l.name} className="h-full w-full object-cover" />
                  ) : (
                    <LayoutTemplate className="text-muted-foreground/40 size-10" aria-hidden />
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate font-medium">{l.name}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {l.branch_id
                      ? (branchName.get(l.branch_id) ?? "")
                      : l.client_id
                        ? (clientName.get(l.client_id) ?? "")
                        : "Sin sucursal asignada"}
                  </p>
                  <div className="text-muted-foreground mt-1 flex items-center justify-between text-xs">
                    <span>
                      {elementos} {elementos === 1 ? "estación/figura" : "estaciones/figuras"}
                    </span>
                    {l.client_id && (
                      <Link href={`/clientes/${l.client_id}`} className="text-primary hover:underline">
                        Ver cliente →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
