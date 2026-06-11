import { MapPin } from "lucide-react";

import { requireEnabledProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MapaView, type Sucursal } from "./mapa-view";

// El mapa necesita datos frescos de las sucursales.
export const dynamic = "force-dynamic";

export default async function MapaPage() {
  await requireEnabledProfile();
  const supabase = await createClient();

  // Una sola pasada al servidor: sucursales con coordenadas + nombres de clientes
  // + cuántas quedan sin ubicar. RLS filtra por empresa automáticamente.
  const [{ data: branchesRaw }, { data: clientsRaw }, { count: sinCoords }] =
    await Promise.all([
      supabase
        .from("branches")
        .select("id, name, address, lat, lng, client_id")
        .not("lat", "is", null)
        .not("lng", "is", null),
      supabase.from("clients").select("id, name"),
      supabase
        .from("branches")
        .select("id", { count: "exact", head: true })
        .is("lat", null),
    ]);

  const clientName = new Map((clientsRaw ?? []).map((c) => [c.id, c.name]));
  const sucursales: Sucursal[] = (branchesRaw ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    address: b.address ?? null,
    lat: b.lat as number,
    lng: b.lng as number,
    clientId: b.client_id,
    clientName: clientName.get(b.client_id) ?? "",
  }));

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const sinUbicar = sinCoords ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="modulo-sticky-top">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <MapPin className="text-primary size-6" aria-hidden />
          Mapa
        </h1>
        <p className="text-muted-foreground text-sm">
          {sucursales.length} {sucursales.length === 1 ? "sucursal ubicada" : "sucursales ubicadas"}
          {sinUbicar > 0 ? ` · ${sinUbicar} sin ubicación todavía` : ""}.
        </p>
      </div>

      {apiKey ? (
        <MapaView apiKey={apiKey} sucursales={sucursales} />
      ) : (
        <Alert>
          <AlertTitle>Falta la llave de Google Maps</AlertTitle>
          <AlertDescription>
            Pega tu clave en <code>Secretos/maps.txt</code> (y en las variables de
            entorno) para activar el mapa. El resto ya está listo.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
