import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Plus,
  Route,
  Sparkles,
} from "lucide-react";

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
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { WeekGrid, type Card, type DayCol } from "./week-grid";

export const dynamic = "force-dynamic";

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
  const dayStrings = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const daySet = new Set(dayStrings);
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
    .eq("active", true)
    .order("full_name");
  const techList = technicians ?? [];

  const { data: servicesRaw } = await supabase
    .from("services")
    .select("id, client_id, branch_id, service_type_id, scheduled_at, agenda_status, field_status")
    .not("scheduled_at", "is", null)
    .gte("scheduled_at", startBound.toISOString())
    .lt("scheduled_at", endBound.toISOString())
    .order("scheduled_at");
  let services = servicesRaw ?? [];

  // Técnico asignado por servicio (tomamos el primero para el selector del calendario).
  const serviceIds = services.map((s) => s.id);
  const techIdByService = new Map<string, string>();
  if (serviceIds.length > 0) {
    const { data: pairs } = await supabase
      .from("service_technicians")
      .select("service_id, technician_id")
      .in("service_id", serviceIds);
    for (const p of pairs ?? []) {
      if (!techIdByService.has(p.service_id)) techIdByService.set(p.service_id, p.technician_id);
    }
    if (tech) {
      const assigned = new Set(
        (pairs ?? []).filter((p) => p.technician_id === tech).map((p) => p.service_id),
      );
      services = services.filter((s) => assigned.has(s.id));
    }
  } else if (tech) {
    services = [];
  }

  // Nombres de cliente / sucursal / tipo.
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

  // Conteo de propuestas pendientes (toda la cartera, no solo la semana).
  const { count: proposedCount } = await supabase
    .from("services")
    .select("id", { count: "exact", head: true })
    .eq("agenda_status", "propuesto");

  // Tarjetas del calendario (solo las que caen en la semana visible).
  const cards: Card[] = [];
  for (const s of services) {
    if (!s.scheduled_at) continue;
    const d = santiagoDate(s.scheduled_at);
    if (!daySet.has(d)) continue;
    cards.push({
      id: s.id,
      date: d,
      time: santiagoTime(s.scheduled_at),
      clientName: clientName.get(s.client_id) ?? "Cliente",
      typeName: typeName.get(s.service_type_id) ?? "",
      branchName: s.branch_id ? (branchName.get(s.branch_id) ?? null) : null,
      agendaStatus: s.agenda_status,
      fieldStatus: s.field_status,
      technicianId: techIdByService.get(s.id) ?? null,
    });
  }

  const days: DayCol[] = dayStrings.map((d) => ({
    date: d,
    label: dayLabel(d),
    isToday: d === today,
  }));

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
            Semana del {dayLabel(monday)} al {dayLabel(sunday)}. Arrastra una visita para cambiarla de día.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/agenda/ruta">
              <Route className="size-4" />
              Ruta del día
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/agenda/generar">
              <Sparkles className="size-4" />
              Generar visitas
            </Link>
          </Button>
          <Button asChild variant={proposedCount ? "default" : "outline"}>
            <Link href="/agenda/propuestas">
              <ClipboardList className="size-4" />
              Propuestas{proposedCount ? ` (${proposedCount})` : ""}
            </Link>
          </Button>
          <Button asChild>
            <Link href="/agenda/nuevo">
              <Plus className="size-4" />
              Nuevo servicio
            </Link>
          </Button>
        </div>
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

      <WeekGrid
        days={days}
        cards={cards}
        technicians={techList.map((t) => ({ id: t.id, name: t.full_name }))}
      />
    </div>
  );
}
