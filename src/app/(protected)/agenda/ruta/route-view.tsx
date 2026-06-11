"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { APIProvider, Map as GMap, useMap } from "@vis.gl/react-google-maps";
import { Loader2, MapPin, Navigation, Save, Wand2 } from "lucide-react";

import {
  decodificarPolyline,
  linkGoogleMapsRuta,
  optimizarRutaVecinoCercano,
  largoRutaKm,
  type Punto,
} from "@/lib/routing";
import { Button } from "@/components/ui/button";
import { optimizeByStreets, saveRoute } from "./actions";

export interface Stop {
  serviceId: string;
  clientName: string;
  typeName: string;
  branchName: string | null;
  time: string;
  lat: number;
  lng: number;
}

const SANTIAGO = { lat: -33.45, lng: -70.65 };

export function RouteView({
  apiKey,
  date,
  tech,
  stops,
}: {
  apiKey: string;
  date: string;
  tech: string;
  stops: Stop[];
}) {
  const stopById = useMemo(() => new Map(stops.map((s) => [s.serviceId, s])), [stops]);

  // Orden inicial: vecino más cercano.
  const initialOrder = useMemo(() => {
    const pts: Punto[] = stops.map((s) => ({ lat: s.lat, lng: s.lng }));
    return optimizarRutaVecinoCercano(pts).map((i) => stops[i]!.serviceId);
  }, [stops]);

  const [order, setOrder] = useState<string[]>(initialOrder);
  const [path, setPath] = useState<Punto[] | null>(null); // trazado por calles (decodificado)
  const [encoded, setEncoded] = useState<string | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [durationMin, setDurationMin] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [optimizing, startOptimize] = useTransition();

  const orderedStops = useMemo(
    () => order.map((id) => stopById.get(id)).filter((s): s is Stop => !!s),
    [order, stopById],
  );

  const aproxKm = useMemo(
    () => largoRutaKm(orderedStops.map((s) => ({ lat: s.lat, lng: s.lng })), orderedStops.map((_, i) => i)),
    [orderedStops],
  );

  function reordenarPorCercania() {
    setOrder(initialOrder);
    setPath(null);
    setEncoded(null);
    setDistanceKm(null);
    setDurationMin(null);
    setMsg(null);
  }

  function optimizarPorCalles() {
    setMsg(null);
    startOptimize(async () => {
      const res = await optimizeByStreets(
        orderedStops.map((s) => ({ serviceId: s.serviceId, lat: s.lat, lng: s.lng })),
      );
      if (res.ok && res.order) {
        setOrder(res.order);
        setEncoded(res.polyline ?? null);
        setPath(res.polyline ? decodificarPolyline(res.polyline) : null);
        setDistanceKm(res.distanceKm ?? null);
        setDurationMin(res.durationMin ?? null);
      } else {
        setMsg(res.error ?? "No se pudo optimizar por calles.");
      }
    });
  }

  const gmapsLink = linkGoogleMapsRuta(orderedStops.map((s) => ({ lat: s.lat, lng: s.lng })));

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      {/* Mapa */}
      <div className="relative h-[calc(100dvh-20rem)] min-h-[380px] w-full overflow-hidden rounded-xl border">
        <APIProvider apiKey={apiKey} language="es" region="CL">
          <GMap
            defaultCenter={SANTIAGO}
            defaultZoom={11}
            gestureHandling="greedy"
            mapTypeControl={false}
            streetViewControl={false}
            fullscreenControl
            className="h-full w-full"
          >
            <RoutePins stops={orderedStops} path={path} />
          </GMap>
        </APIProvider>
      </div>

      {/* Panel */}
      <div className="flex flex-col gap-3">
        <div className="bg-card rounded-lg border p-3 text-sm">
          <p className="text-muted-foreground">
            {orderedStops.length} paradas ·{" "}
            {distanceKm != null ? (
              <>
                <strong>{distanceKm} km</strong> por calles
                {durationMin != null ? ` · ~${durationMin} min` : ""}
              </>
            ) : (
              <>~{aproxKm.toFixed(1)} km en línea recta</>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={optimizarPorCalles} disabled={optimizing}>
            {optimizing ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
            Optimizar por calles
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={reordenarPorCercania}>
            Reordenar por cercanía
          </Button>
        </div>

        {msg && <p className="text-warning text-xs">{msg}</p>}

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={gmapsLink} target="_blank" rel="noopener noreferrer">
              <Navigation className="size-4" />
              Abrir en Google Maps
            </a>
          </Button>
          <form action={saveRoute}>
            <input type="hidden" name="date" value={date} />
            <input type="hidden" name="technician_id" value={tech} />
            <input type="hidden" name="ordered_ids" value={order.join(",")} />
            <input type="hidden" name="polyline" value={encoded ?? ""} />
            <input type="hidden" name="distance_km" value={distanceKm ?? ""} />
            <input type="hidden" name="duration_min" value={durationMin ?? ""} />
            <Button type="submit" size="sm">
              <Save className="size-4" />
              Guardar ruta
            </Button>
          </form>
        </div>

        {/* Lista ordenada */}
        <ol className="flex flex-col gap-2">
          {orderedStops.map((s, i) => (
            <li
              key={s.serviceId}
              className="bg-card flex items-start gap-2 rounded-lg border p-2 text-sm"
            >
              <span className="bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium">{s.clientName}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {s.time ? `${s.time} · ` : ""}
                  {s.typeName}
                  {s.branchName ? ` · ${s.branchName}` : ""}
                </p>
              </div>
              <MapPin className="text-muted-foreground/50 ml-auto size-4 shrink-0" aria-hidden />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/** Dibuja los marcadores numerados + el trazado, imperativamente (una sola vez por cambio). */
function RoutePins({ stops, path }: { stops: Stop[]; path: Punto[] | null }) {
  const map = useMap();

  useEffect(() => {
    if (!map || stops.length === 0) return;

    const markers = stops.map(
      (s, i) =>
        new google.maps.Marker({
          map,
          position: { lat: s.lat, lng: s.lng },
          label: { text: String(i + 1), color: "#ffffff", fontSize: "12px", fontWeight: "bold" },
          title: `${i + 1}. ${s.clientName}`,
        }),
    );

    const linePath = path ?? stops.map((s) => ({ lat: s.lat, lng: s.lng }));
    const line = new google.maps.Polyline({
      map,
      path: linePath,
      strokeColor: "#1B3A6B",
      strokeOpacity: path ? 0.9 : 0.6,
      strokeWeight: path ? 4 : 3,
    });

    const bounds = new google.maps.LatLngBounds();
    stops.forEach((s) => bounds.extend({ lat: s.lat, lng: s.lng }));
    if (stops.length === 1) {
      map.setCenter({ lat: stops[0]!.lat, lng: stops[0]!.lng });
      map.setZoom(15);
    } else {
      map.fitBounds(bounds, 56);
    }

    return () => {
      markers.forEach((m) => m.setMap(null));
      line.setMap(null);
    };
  }, [map, stops, path]);

  return null;
}
