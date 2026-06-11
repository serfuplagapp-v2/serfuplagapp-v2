import Link from "next/link";
import { CalendarDays, ChevronRight, MapPin, SprayCan } from "lucide-react";

import { getSessionProfile, requireEnabledProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { santiagoDate, santiagoTime, todaySantiago } from "@/lib/datetime";
import type { ServiceFieldStatus } from "@/lib/supabase/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type BadgeVariant = React.ComponentProps<typeof Badge>["variant"];
const FIELD_BADGE: Record<ServiceFieldStatus, { label: string; variant: BadgeVariant }> = {
  planificada: { label: "Pendiente", variant: "muted" },
  asignada: { label: "Pendiente", variant: "secondary" },
  en_proceso: { label: "En curso", variant: "warning" },
  por_validar: { label: "Terminada ✓", variant: "success" },
  terminada: { label: "Validada ✓", variant: "success" },
};

export default async function VisitasHoyPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const { role, user } = await requireEnabledProfile();
  const sp = await searchParams;
  await getSessionProfile();
  const supabase = await createClient();

  const hoy = todaySantiago();
  // Ventana UTC que cubre el día de Santiago.
  const start = new Date(`${hoy}T00:00:00Z`);
  start.setUTCHours(start.getUTCHours() - 12);
  const end = new Date(`${hoy}T00:00:00Z`);
  end.setUTCHours(end.getUTCHours() + 36);

  const { data: servicesRaw } = await supabase
    .from("services")
    .select("id, client_id, branch_id, service_type_id, scheduled_at, field_status")
    .not("scheduled_at", "is", null)
    .gte("scheduled_at", start.toISOString())
    .lt("scheduled_at", end.toISOString())
    .neq("agenda_status", "cancelado")
    .neq("agenda_status", "propuesto")
    .order("scheduled_at");
  let services = (servicesRaw ?? []).filter(
    (s) => s.scheduled_at && santiagoDate(s.scheduled_at) === hoy,
  );

  // Si el usuario es técnico con ficha enlazada, mostrar SOLO sus visitas.
  let miFiltro = false;
  if (role === "tecnico") {
    const { data: tec } = await supabase
      .from("technicians")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();
    if (tec) {
      const ids = services.map((s) => s.id);
      if (ids.length) {
        const { data: pairs } = await supabase
          .from("service_technicians")
          .select("service_id")
          .eq("technician_id", tec.id)
          .in("service_id", ids);
        const mias = new Set((pairs ?? []).map((p) => p.service_id));
        services = services.filter((s) => mias.has(s.id));
        miFiltro = true;
      }
    }
  }

  // Nombres (solo de lo visible).
  const clientName = new Map<string, string>();
  const branchInfo = new Map<string, { name: string; address: string | null }>();
  const typeName = new Map<string, string>();
  const clientIds = [...new Set(services.map((s) => s.client_id))];
  const branchIds = [...new Set(services.map((s) => s.branch_id).filter((x): x is string => !!x))];
  const typeIds = [...new Set(services.map((s) => s.service_type_id))];
  await Promise.all([
    clientIds.length
      ? supabase.from("clients").select("id, name").in("id", clientIds).then(({ data }) => {
          for (const c of data ?? []) clientName.set(c.id, c.name);
        })
      : Promise.resolve(),
    branchIds.length
      ? supabase.from("branches").select("id, name, address").in("id", branchIds).then(({ data }) => {
          for (const b of data ?? []) branchInfo.set(b.id, { name: b.name, address: b.address });
        })
      : Promise.resolve(),
    typeIds.length
      ? supabase.from("service_types").select("id, name").in("id", typeIds).then(({ data }) => {
          for (const t of data ?? []) typeName.set(t.id, t.name);
        })
      : Promise.resolve(),
  ]);

  const pendientes = services.filter((s) => !["por_validar", "terminada"].includes(s.field_status)).length;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <div className="modulo-sticky-top">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <SprayCan className="text-primary size-6" aria-hidden />
          Visitas de hoy
        </h1>
        <p className="text-muted-foreground text-sm">
          {santiagoDate(new Date())} · {services.length}{" "}
          {services.length === 1 ? "visita" : "visitas"}
          {miFiltro ? " asignadas a ti" : ""} · {pendientes} por hacer.
        </p>
      </div>

      {sp.ok === "1" && (
        <Alert variant="success">
          <AlertDescription>Visita terminada. ¡Buen trabajo! Quedó por validar en la oficina.</AlertDescription>
        </Alert>
      )}

      {services.length === 0 ? (
        <Alert>
          <AlertTitle>Sin visitas hoy</AlertTitle>
          <AlertDescription>
            {miFiltro
              ? "No tienes visitas asignadas para hoy."
              : "No hay visitas agendadas para hoy."}{" "}
            <Link href="/agenda" className="text-primary inline-flex items-center gap-1 underline">
              <CalendarDays className="size-3.5" /> Ver la agenda
            </Link>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="flex flex-col gap-2 pb-6">
          {services.map((s) => {
            const b = s.branch_id ? branchInfo.get(s.branch_id) : null;
            const badge = FIELD_BADGE[s.field_status];
            return (
              <Link
                key={s.id}
                href={`/terreno/hoy/${s.id}`}
                className="bg-card hover:border-primary flex items-center gap-3 rounded-xl border p-3 transition-colors"
              >
                <div className="bg-secondary text-secondary-foreground flex size-12 shrink-0 flex-col items-center justify-center rounded-lg text-center">
                  <span className="text-sm leading-none font-bold">
                    {s.scheduled_at ? santiagoTime(s.scheduled_at) : "—"}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{clientName.get(s.client_id) ?? "Cliente"}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {typeName.get(s.service_type_id) ?? ""}
                    {b ? ` · ${b.name}` : ""}
                  </p>
                  {b?.address && (
                    <p className="text-muted-foreground flex items-center gap-1 truncate text-xs">
                      <MapPin className="size-3 shrink-0" />
                      {b.address}
                    </p>
                  )}
                </div>
                <Badge variant={badge.variant}>{badge.label}</Badge>
                <ChevronRight className="text-muted-foreground size-4 shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
