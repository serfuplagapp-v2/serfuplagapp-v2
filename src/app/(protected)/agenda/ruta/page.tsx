import Link from "next/link";
import { ChevronLeft, Route as RouteIcon } from "lucide-react";

import { requireEnabledProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dayLabel, santiagoDate, santiagoTime, todaySantiago } from "@/lib/datetime";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { RouteView, type Stop } from "./route-view";

export const dynamic = "force-dynamic";

export default async function RutaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; tech?: string; saved?: string; error?: string }>;
}) {
  await requireEnabledProfile();
  const sp = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? (sp.date as string) : todaySantiago();
  const tech = (sp.tech ?? "").trim();

  // Ventana UTC que cubre el día de Santiago; el filtro fino es por fecha local.
  const startBound = new Date(`${date}T00:00:00Z`);
  startBound.setUTCHours(startBound.getUTCHours() - 12);
  const endBound = new Date(`${date}T00:00:00Z`);
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
    .select("id, client_id, branch_id, service_type_id, scheduled_at")
    .not("scheduled_at", "is", null)
    .gte("scheduled_at", startBound.toISOString())
    .lt("scheduled_at", endBound.toISOString())
    .order("scheduled_at");
  let services = (servicesRaw ?? []).filter((s) => s.scheduled_at && santiagoDate(s.scheduled_at) === date);

  // Filtro por técnico.
  const serviceIds = services.map((s) => s.id);
  if (serviceIds.length > 0 && tech) {
    const { data: pairs } = await supabase
      .from("service_technicians")
      .select("service_id, technician_id")
      .in("service_id", serviceIds)
      .eq("technician_id", tech);
    const assigned = new Set((pairs ?? []).map((p) => p.service_id));
    services = services.filter((s) => assigned.has(s.id));
  } else if (tech && serviceIds.length === 0) {
    services = [];
  }

  // Nombres + coordenadas de sucursal.
  const clientName = new Map<string, string>();
  const typeName = new Map<string, string>();
  const branchInfo = new Map<string, { name: string; lat: number | null; lng: number | null }>();
  const clientIds = [...new Set(services.map((s) => s.client_id))];
  const branchIds = [...new Set(services.map((s) => s.branch_id).filter((x): x is string => !!x))];
  const typeIds = [...new Set(services.map((s) => s.service_type_id))];
  if (clientIds.length) {
    const { data } = await supabase.from("clients").select("id, name").in("id", clientIds);
    for (const c of data ?? []) clientName.set(c.id, c.name);
  }
  if (branchIds.length) {
    const { data } = await supabase.from("branches").select("id, name, lat, lng").in("id", branchIds);
    for (const b of data ?? []) branchInfo.set(b.id, { name: b.name, lat: b.lat, lng: b.lng });
  }
  if (typeIds.length) {
    const { data } = await supabase.from("service_types").select("id, name").in("id", typeIds);
    for (const t of data ?? []) typeName.set(t.id, t.name);
  }

  const conCoords: Stop[] = [];
  let sinCoords = 0;
  for (const s of services) {
    const b = s.branch_id ? branchInfo.get(s.branch_id) : undefined;
    if (!b || b.lat == null || b.lng == null) {
      sinCoords++;
      continue;
    }
    conCoords.push({
      serviceId: s.id,
      clientName: clientName.get(s.client_id) ?? "Cliente",
      typeName: typeName.get(s.service_type_id) ?? "",
      branchName: b.name,
      time: s.scheduled_at ? santiagoTime(s.scheduled_at) : "",
      lat: b.lat,
      lng: b.lng,
    });
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

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
          <RouteIcon className="text-primary size-6" aria-hidden />
          Ruta del día
        </h1>
        <p className="text-muted-foreground text-sm">
          {dayLabel(date)} · {conCoords.length} {conCoords.length === 1 ? "parada" : "paradas"}
          {sinCoords > 0 ? ` · ${sinCoords} sin ubicación` : ""}.
        </p>
      </div>

      {sp.saved === "1" && (
        <Alert variant="success">
          <AlertDescription>Ruta guardada.</AlertDescription>
        </Alert>
      )}
      {sp.error === "1" && (
        <Alert variant="destructive">
          <AlertDescription>
            No se pudo guardar la ruta. Inténtalo de nuevo.
          </AlertDescription>
        </Alert>
      )}

      {/* Selección de día + técnico */}
      <form method="get" className="bg-card flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="date">Día</Label>
          <Input id="date" name="date" type="date" defaultValue={date} className="w-auto" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tech">Técnico (opcional)</Label>
          <Select id="tech" name="tech" defaultValue={tech} className="w-auto min-w-48">
            <option value="">Todas las visitas del día</option>
            {techList.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="outline">
          Ver ruta
        </Button>
      </form>

      {conCoords.length === 0 ? (
        <Alert>
          <AlertTitle>No hay paradas con ubicación este día</AlertTitle>
          <AlertDescription>
            {services.length > 0
              ? "Las visitas de este día no tienen coordenadas en su sucursal. Asigna la dirección/ubicación de la sucursal para incluirlas en la ruta."
              : "No hay visitas agendadas para este día y filtro."}
          </AlertDescription>
        </Alert>
      ) : apiKey ? (
        <RouteView
          apiKey={apiKey}
          date={date}
          tech={tech}
          stops={conCoords}
        />
      ) : (
        <Alert>
          <AlertTitle>Falta la llave de Google Maps</AlertTitle>
          <AlertDescription>
            Configura <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> para ver la ruta en el mapa.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
