"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  APIProvider,
  Map,
  InfoWindow,
  useMap,
} from "@vis.gl/react-google-maps";
import { MarkerClusterer } from "@googlemaps/markerclusterer";

export interface Sucursal {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  clientId: string;
  clientName: string;
}

// Centro de Santiago (mismo default que la v1).
const SANTIAGO = { lat: -33.45, lng: -70.65 };

export function MapaView({
  apiKey,
  sucursales,
}: {
  apiKey: string;
  sucursales: Sucursal[];
}) {
  const [selected, setSelected] = useState<Sucursal | null>(null);

  return (
    <div className="relative h-[calc(100dvh-13rem)] min-h-[420px] w-full overflow-hidden rounded-xl border">
      <APIProvider apiKey={apiKey} language="es" region="CL">
        <Map
          defaultCenter={SANTIAGO}
          defaultZoom={11}
          gestureHandling="greedy"
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl
          className="h-full w-full"
        >
          <Pines sucursales={sucursales} onSelect={setSelected} />

          {selected && (
            <InfoWindow
              position={{ lat: selected.lat, lng: selected.lng }}
              onCloseClick={() => setSelected(null)}
            >
              <div className="min-w-44 space-y-1 p-1 text-sm">
                <p className="font-semibold text-[#1B3A6B]">{selected.name}</p>
                {selected.clientName && (
                  <p className="text-neutral-500">{selected.clientName}</p>
                )}
                {selected.address && <p>{selected.address}</p>}
                <Link
                  href={`/clientes/${selected.clientId}`}
                  className="inline-block pt-1 font-medium text-[#1B3A6B] underline"
                >
                  Ver ficha del cliente →
                </Link>
              </div>
            </InfoWindow>
          )}
        </Map>
      </APIProvider>
    </div>
  );
}

/**
 * Crea los pines y los AGRUPA (clustering) para que cientos de marcadores no
 * traben el mapa. Lección heredada de la v1: una sola instancia, sin recrear.
 */
function Pines({
  sucursales,
  onSelect,
}: {
  sucursales: Sucursal[];
  onSelect: (s: Sucursal) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || sucursales.length === 0) return;

    const markers = sucursales.map((s) => {
      const marker = new google.maps.Marker({
        position: { lat: s.lat, lng: s.lng },
        title: s.name,
      });
      marker.addListener("click", () => onSelect(s));
      return marker;
    });

    const clusterer = new MarkerClusterer({ map, markers });

    // Encuadrar el mapa para que se vean todas las sucursales.
    const unica = sucursales.length === 1 ? sucursales[0] : null;
    if (unica) {
      map.setCenter({ lat: unica.lat, lng: unica.lng });
      map.setZoom(15);
    } else {
      const bounds = new google.maps.LatLngBounds();
      sucursales.forEach((s) => bounds.extend({ lat: s.lat, lng: s.lng }));
      map.fitBounds(bounds, 48);
    }

    return () => {
      clusterer.clearMarkers();
      markers.forEach((m) => m.setMap(null));
    };
  }, [map, sucursales, onSelect]);

  return null;
}
