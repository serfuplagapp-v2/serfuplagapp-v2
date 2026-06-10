import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, User } from "lucide-react";

import { requireEnabledProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  addDays,
  dayLabel,
  mondayOf,
  santiagoDate,
  santiagoTime,
  todaySantiago,
} from "@/lib/datetime";
import type {
  ServiceAgendaStatus,
  ServiceFieldStatus,
} from "@/lib/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

type BadgeVariant = React.ComponentProps<typeof Badge>["variant"];

const AGENDA_BADGE: Record<ServiceAgendaStatus, { label: string; variant: BadgeVariant }> = {
  propuesto: { label: "Propuesto", variant: "muted" },
  programado: { label: "Programado", variant: "secondary" },
  enviado: { label: "Enviado", variant: "secondary" },
  confirmado: { label: "Confirmado", variant: "success" },
  reprogramado: { label: "Reprogramado", variant: "warning" },
  cancelado: { label: "Cancelado", variant: "destructive" },
};

const FIELD_BADGE: Record<ServiceFieldStatus, { label: string; variant: BadgeVariant }> = {
  planificada: { label: "Planificada", variant: "muted" },
  asignada: { label: "Asignada", variant: "secondary" },
  en_proceso: { label: "En proceso", variant: "warning" },
  por_validar: { label: "Por validar", variant: "warning" },
  terminada: { label: "Terminada", variant: "success" },
};

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; tech?: string }>;
}) {
  await requireEnabledProfile();
  const sp = await searchParams;
  const tech = (sp.tech ?? "").trim();
  const base = /^\d{4}-\d{2}-\d{2}$/.test(sp.week ?? "")
    ? (sp.week as string)
    : todaySantiago();
  const monday = mondayOf(base);
  const sunday = addDays(monday, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const daySet = new Set(days);
  const today = todaySantiago();

  // Ventana de consulta (superset en UTC con margen ±; el agrupado exacto se
  // hace por fecha de Santiago).
  const startBound = new Date(`${monday}T00:00:00Z`);
  startBound.setUTCHours(startBound.getUTCHours() - 12);
  const endBound = new Date(`${sunday}T00:00:00Z`);
  endBound.setUTCHours(endBound.getUTCHours() + 36);

  const supabase = await createClient();

  const { data: technicians } = await supabase
    .from("technicians")
    .select("id, full_name")
    .order("full_name");
  const techList = technicians ?? [];
  const techNameById = new Map(techList.map((t) => [t.id, t.full_name]));

  const { data: servicesRaw } = await supabase
    .from("services")
    .select("id, client_id, branch_id, service_type_id, scheduled_at, agenda_status, field_status")
    .not("scheduled_at", "is", null)
    .gte("scheduled_at", startBound.toISOString())
    .lt("scheduled_at", endBound.toISOString())
    .order("scheduled_at");
  let services = servicesRaw ?? [];

  // Técnicos asignados (tabla puente) para los servicios visibles.
  const serviceIds = services.map((s) => s.id);
  const techsByService = new Map<string, string[]>();
  if (serviceIds.length > 0) {
    const { data: pairs } = await supabase
      .from("service_technicians")
      .select("service_id, technician_id")
      .in("service_id", serviceIds);
    for (const p of pairs ?? []) {
      const name = techNameById.get(p.technician_id);
      if (!name) continue;
      const arr = techsByService.get(p.service_id) ?? [];
      arr.push(name);
      techsByService.set(p.service_id, arr);
    }
    if (tech) {
      const assigned = new Set(
        (pairs ?? [])
          .filter((p) => p.technician_id === tech)
          .map((p) => p.service_id),
      );
      services = services.filter((s) => assigned.has(s.id));
    }
  } else if (tech) {
    services = [];
  }

  // Nombres de cliente / sucursal / tipo de servicio.
  const clientName = new Map<string, string>();
  const branchName = new Map<string, string>();
  const typeName = new Map<string, string>();
  const clientIds = [...new Set(services.map((s) => s.client_id))];
  const branchIds = [...new Set(services.map((s) => s.branch_id).filter((x): x is string => !!x))];
  const typeIds = [...new Set(services.map((s) => s.service_type_id))];
  if (clientIds.length) {
    const { data } = await supabase.from("clients").select("id, name").in("id", clientIds);
    for (const c of data ?? []) clientName.set(c.id, c.name);
  }
  if (branchIds.length) {
    const { data } = await supabase.from("branches").select("id, name").in("id", branchIds);
    for (const b of data ?? []) branchName.set(b.id, b.name);
  }
  if (typeIds.length) {
    const { data } = await supabase.from("service_types").select("id, name").in("id", typeIds);
    for (const t of data ?? []) typeName.set(t.id, t.name);
  }

  // Agrupar por día de Santiago.
  const byDay = new Map<string, typeof services>();
  for (const s of services) {
    if (!s.scheduled_at) continue;
    const d = santiagoDate(s.scheduled_at);
    if (!daySet.has(d)) continue;
    const arr = byDay.get(d) ?? [];
    arr.push(s);
    byDay.set(d, arr);
  }

  const navHref = (week: string) => {
    const p = new URLSearchParams();
    p.set("week", week);
    if (tech) p.set("tech", tech);
    return `/agenda?${p.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <CalendarDays className="text-primary size-6" aria-hidden />
            Agenda
          </h1>
          <p className="text-muted-foreground text-sm">
            Semana del {dayLabel(monday)} al {dayLabel(sunday)}.
          </p>
        </div>
        <Button asChild>
          <Link href="/agenda/nuevo">
            <Plus className="size-4" />
            Nuevo servicio
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={navHref(addDays(monday, -7))}>
              <ChevronLeft className="size-4" />
              Anterior
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={navHref(mondayOf(today))}>Hoy</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={navHref(addDays(monday, 7))}>
              Siguiente
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        </div>

        <form method="get" className="flex items-center gap-2">
          <input type="hidden" name="week" value={monday} />
          <Select name="tech" defaultValue={tech} className="w-auto min-w-48">
            <option value="">Todos los técnicos</option>
            {techList.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="outline" size="sm">
            Filtrar
          </Button>
        </form>
      </div>

      <div className="grid gap-3 md:grid-cols-7">
        {days.map((day) => {
          const items = byDay.get(day) ?? [];
          const isToday = day === today;
          return (
            <div
              key={day}
              className={
                "bg-card flex min-h-32 flex-col rounded-lg border " +
                (isToday ? "border-primary ring-primary/30 ring-1" : "")
              }
            >
              <div
                className={
                  "rounded-t-lg border-b px-2 py-1.5 text-center text-xs font-semibold capitalize " +
                  (isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground")
                }
              >
                {dayLabel(day)}
              </div>
              <div className="flex flex-col gap-2 p-2">
                {items.length === 0 ? (
                  <p className="text-muted-foreground/60 py-2 text-center text-xs">—</p>
                ) : (
                  items.map((s) => (
                    <div
                      key={s.id}
                      className="bg-secondary/60 flex flex-col gap-1 rounded-md border-l-4 border-l-primary p-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold">
                          {s.scheduled_at ? santiagoTime(s.scheduled_at) : ""}
                        </span>
                      </div>
                      <p className="font-medium leading-tight">
                        {clientName.get(s.client_id) ?? "Cliente"}
                      </p>
                      <p className="text-muted-foreground leading-tight">
                        {typeName.get(s.service_type_id) ?? ""}
                        {s.branch_id && branchName.get(s.branch_id)
                          ? ` · ${branchName.get(s.branch_id)}`
                          : ""}
                      </p>
                      {(techsByService.get(s.id) ?? []).length > 0 && (
                        <p className="text-muted-foreground flex items-center gap-1 leading-tight">
                          <User className="size-3" />
                          {(techsByService.get(s.id) ?? []).join(", ")}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        <Badge variant={AGENDA_BADGE[s.agenda_status].variant}>
                          {AGENDA_BADGE[s.agenda_status].label}
                        </Badge>
                        <Badge variant={FIELD_BADGE[s.field_status].variant}>
                          {FIELD_BADGE[s.field_status].label}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
