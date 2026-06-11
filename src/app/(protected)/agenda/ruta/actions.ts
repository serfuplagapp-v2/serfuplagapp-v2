"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { requireEnabledProfile } from "@/lib/auth";
import type { OptimizeResult, RouteStop } from "./types";

/**
 * Optimiza el orden de las paradas por CALLES reales usando la Routes API de
 * Google (orden de waypoints + trazado). Requiere una llave de servidor en
 * `GOOGLE_MAPS_SERVER_KEY` (la llave pública del mapa está restringida por
 * dominio y no sirve para llamadas REST). Si no hay llave, devuelve un aviso y
 * la app sigue usando el orden por cercanía (gratis e instantáneo).
 */
export async function optimizeByStreets(stops: RouteStop[]): Promise<OptimizeResult> {
  await requireEnabledProfile();
  if (stops.length < 2) return { ok: false, error: "Se necesitan al menos 2 paradas." };

  const key = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!key) {
    return {
      ok: false,
      error:
        "Falta la llave de servidor de Google (GOOGLE_MAPS_SERVER_KEY). Por ahora la ruta se ordena por cercanía.",
    };
  }

  const first = stops[0]!;
  const last = stops[stops.length - 1]!;
  const body = {
    origin: { location: { latLng: { latitude: first.lat, longitude: first.lng } } },
    destination: { location: { latLng: { latitude: last.lat, longitude: last.lng } } },
    travelMode: "DRIVE",
    optimizeWaypointOrder: true,
    intermediates: stops.slice(1, -1).map((p) => ({
      location: { latLng: { latitude: p.lat, longitude: p.lng } },
    })),
  };

  try {
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "routes.duration,routes.distanceMeters,routes.polyline,routes.optimizedIntermediateWaypointIndex",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route) return { ok: false, error: "Google no devolvió una ruta." };

    // Reconstruir el orden completo: origen + intermedios reordenados + destino.
    const interIds = stops.slice(1, -1).map((s) => s.serviceId);
    const optIdx: number[] = route.optimizedIntermediateWaypointIndex ?? interIds.map((_, i) => i);
    const order = [
      first.serviceId,
      ...optIdx.map((i) => interIds[i]!),
      last.serviceId,
    ];

    return {
      ok: true,
      order,
      polyline: route.polyline?.encodedPolyline,
      distanceKm: route.distanceMeters ? Math.round(route.distanceMeters / 100) / 10 : undefined,
      durationMin: route.duration ? Math.round(parseInt(route.duration, 10) / 60) : undefined,
    };
  } catch {
    return { ok: false, error: "No se pudo contactar a Google. La ruta queda ordenada por cercanía." };
  }
}

/** Guarda la ruta del día (orden de paradas + geometría opcional). */
export async function saveRoute(formData: FormData): Promise<void> {
  const { tenantId } = await requireEnabledProfile();
  const date = String(formData.get("date") ?? "");
  const technicianId = String(formData.get("technician_id") ?? "").trim() || null;
  const orderedIds = String(formData.get("ordered_ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const polyline = String(formData.get("polyline") ?? "").trim() || null;
  const distanceRaw = String(formData.get("distance_km") ?? "").trim();
  const durationRaw = String(formData.get("duration_min") ?? "").trim();
  const distanceKm = distanceRaw ? Number(distanceRaw) : null;
  const durationMin = durationRaw ? Math.round(Number(durationRaw)) : null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || orderedIds.length === 0) {
    redirect("/agenda/ruta");
  }

  // `redirect()` corta la ejecución (lanza); el tipo explícito `never` en la
  // constante permite a TypeScript estrechar el flujo tras llamarla.
  const back: (status: "saved" | "error") => never = (status) => {
    const p = new URLSearchParams({ date });
    if (technicianId) p.set("tech", technicianId);
    p.set(status, "1");
    revalidatePath("/agenda/ruta");
    redirect(`/agenda/ruta?${p.toString()}`);
  };

  const supabase = await createSupabaseServerClient();

  // Validar que las paradas existan (la RLS ya limita a la empresa); descarta ids
  // inventados o viejos para no guardar una ruta con paradas fantasma.
  const { data: validRows } = await supabase
    .from("services")
    .select("id")
    .in("id", orderedIds);
  const validIds = new Set((validRows ?? []).map((r) => r.id));
  const cleanIds = orderedIds.filter((id) => validIds.has(id));
  if (cleanIds.length === 0) back("error");

  const { data: route, error } = await supabase
    .from("routes")
    .insert({
      tenant_id: tenantId,
      technician_id: technicianId,
      date,
      status: "planificada",
      polyline,
      distance_km: Number.isFinite(distanceKm) ? distanceKm : null,
      duration_min: Number.isFinite(durationMin) ? durationMin : null,
    })
    .select("id")
    .single();
  if (error || !route) back("error");

  const stops = cleanIds.map((serviceId, i) => ({
    tenant_id: tenantId,
    route_id: route.id,
    service_id: serviceId,
    position: i + 1,
  }));
  for (let i = 0; i < stops.length; i += 500) {
    const { error: stopsError } = await supabase
      .from("route_stops")
      .insert(stops.slice(i, i + 500));
    if (stopsError) {
      // No dejar una ruta a medias: se borra la cabecera (las paradas caen en cascada).
      await supabase.from("routes").delete().eq("id", route.id);
      back("error");
    }
  }

  back("saved");
}
