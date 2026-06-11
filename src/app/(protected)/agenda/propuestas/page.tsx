import Link from "next/link";
import { ChevronLeft, ClipboardList, Check, X } from "lucide-react";

import { requireEnabledProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { santiagoDate } from "@/lib/datetime";
import { approveProposals, discardProposals } from "../actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/confirm-submit";

export const dynamic = "force-dynamic";

function shortDate(d: string): string {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
  }).format(new Date(`${d}T12:00:00Z`));
}

export default async function PropuestasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; total?: string }>;
}) {
  await requireEnabledProfile();
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: proposed } = await supabase
    .from("services")
    .select("id, client_id, branch_id, service_type_id, scheduled_at")
    .eq("agenda_status", "propuesto")
    .order("scheduled_at");
  const items = proposed ?? [];

  // Nombres.
  const clientIds = [...new Set(items.map((s) => s.client_id))];
  const clientName = new Map<string, string>();
  if (clientIds.length) {
    const { data } = await supabase.from("clients").select("id, name").in("id", clientIds);
    for (const c of data ?? []) clientName.set(c.id, c.name);
  }

  // Agrupar por cliente.
  const byClient = new Map<string, { name: string; ids: string[]; dates: string[] }>();
  for (const s of items) {
    const g = byClient.get(s.client_id) ?? {
      name: clientName.get(s.client_id) ?? "Cliente",
      ids: [],
      dates: [],
    };
    g.ids.push(s.id);
    if (s.scheduled_at) g.dates.push(santiagoDate(s.scheduled_at));
    byClient.set(s.client_id, g);
  }
  const groups = [...byClient.values()].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
          <Link href="/agenda">
            <ChevronLeft className="size-4" />
            Volver a la agenda
          </Link>
        </Button>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ClipboardList className="text-primary size-6" aria-hidden />
          Propuestas pendientes
        </h1>
        <p className="text-muted-foreground text-sm">
          Visitas generadas automáticamente desde los contratos. Apruébalas para que pasen
          a la agenda (estado “programado”), o descártalas.
        </p>
      </div>

      {sp.error === "guardar" && (
        <Alert variant="destructive">
          <AlertTitle>La generación se interrumpió a medias</AlertTitle>
          <AlertDescription>
            Se alcanzaron a guardar {sp.ok ?? "algunas"} de {sp.total ?? "las"} propuestas y luego
            hubo un error de conexión. Las que están abajo son válidas: puedes aprobarlas o
            descartarlas, y volver a “Generar visitas” para crear las que faltaron (no se duplican).
          </AlertDescription>
        </Alert>
      )}
      {sp.error === "accion" && (
        <Alert variant="destructive">
          <AlertDescription>
            La última acción no se pudo completar. Inténtalo de nuevo.
          </AlertDescription>
        </Alert>
      )}

      {items.length === 0 ? (
        <Alert>
          <AlertTitle>No hay propuestas pendientes</AlertTitle>
          <AlertDescription>
            Genera visitas desde{" "}
            <Link href="/agenda/generar" className="text-primary font-medium underline">
              Generar visitas
            </Link>
            .
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {/* Acciones globales */}
          <div className="bg-card flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
            <div>
              <p className="text-2xl font-semibold">{items.length}</p>
              <p className="text-muted-foreground text-sm">
                visitas propuestas en {groups.length}{" "}
                {groups.length === 1 ? "cliente" : "clientes"}.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <form action={approveProposals}>
                <input type="hidden" name="ids" value="" />
                <Button type="submit">
                  <Check className="size-4" />
                  Aprobar todas
                </Button>
              </form>
              <form action={discardProposals}>
                <input type="hidden" name="ids" value="" />
                <ConfirmSubmit
                  variant="outline"
                  message={`¿Descartar las ${items.length} propuestas? Esta acción no se puede deshacer.`}
                >
                  <X className="size-4" />
                  Descartar todas
                </ConfirmSubmit>
              </form>
            </div>
          </div>

          {/* Por cliente */}
          <div className="flex flex-col gap-2">
            {groups.map((g) => {
              const sorted = [...g.dates].sort();
              const rango =
                sorted.length > 0
                  ? `${shortDate(sorted[0]!)} – ${shortDate(sorted.at(-1)!)}`
                  : "";
              return (
                <div
                  key={g.name}
                  className="bg-card flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{g.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {g.ids.length} {g.ids.length === 1 ? "visita" : "visitas"} · {rango}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <form action={approveProposals}>
                      <input type="hidden" name="ids" value={g.ids.join(",")} />
                      <Button type="submit" size="sm" variant="outline">
                        <Check className="size-4" />
                        Aprobar
                      </Button>
                    </form>
                    <form action={discardProposals}>
                      <input type="hidden" name="ids" value={g.ids.join(",")} />
                      <ConfirmSubmit
                        size="sm"
                        variant="ghost"
                        message={`¿Descartar las ${g.ids.length} visitas propuestas de ${g.name}?`}
                      >
                        <X className="size-4" />
                      </ConfirmSubmit>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
