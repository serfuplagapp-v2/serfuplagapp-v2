import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MapPin } from "lucide-react";

import { requireEnabledProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { santiagoDate, santiagoTime } from "@/lib/datetime";
import type { Json } from "@/lib/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CaptureForm } from "./capture-form";
import type { FotoItem } from "@/components/photo-upload";

export const dynamic = "force-dynamic";

const asStr = (v: Json | undefined, fb = ""): string => (typeof v === "string" ? v : fb);
const asArr = (v: Json | undefined): Json[] => (Array.isArray(v) ? v : []);

export default async function VisitaCapturaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tenantId } = await requireEnabledProfile();
  const { id } = await params;
  const supabase = await createClient();

  const { data: svc } = await supabase
    .from("services")
    .select("id, client_id, branch_id, service_type_id, scheduled_at, field_status, field_data, legacy_data")
    .eq("id", id)
    .maybeSingle();
  if (!svc) notFound();

  const [cliRes, brRes, stRes, pestsRes] = await Promise.all([
    supabase.from("clients").select("name").eq("id", svc.client_id).maybeSingle(),
    svc.branch_id
      ? supabase.from("branches").select("name, address, lat, lng").eq("id", svc.branch_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("service_types").select("name").eq("id", svc.service_type_id).maybeSingle(),
    supabase.from("pests").select("name").eq("active", true).order("name").limit(100),
  ]);

  const legacy = (svc.legacy_data ?? {}) as Record<string, Json>;
  const field = (svc.field_data ?? {}) as Record<string, Json>;
  const pick = (k: string): Json | undefined => (field[k] !== undefined && field[k] !== "" ? field[k] : legacy[k]);

  // URLs firmadas para las fotos ya subidas (1 hora).
  const fotoPaths = asArr(field.fotos).filter((x): x is string => typeof x === "string");
  let fotosIniciales: FotoItem[] = [];
  if (fotoPaths.length) {
    const { data: signed } = await supabase.storage.from("terreno").createSignedUrls(fotoPaths, 3600);
    fotosIniciales = (signed ?? []).flatMap((s) =>
      s.signedUrl && s.path ? [{ path: s.path, url: s.signedUrl }] : [],
    );
  }

  const br = brRes.data;
  const mapsHref = br?.lat
    ? `https://www.google.com/maps/dir/?api=1&destination=${br.lat},${br.lng}`
    : br?.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${br.address}, Chile`)}`
      : null;
  const terminada = svc.field_status === "terminada" || svc.field_status === "por_validar";

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
          <Link href="/terreno/hoy">
            <ChevronLeft className="size-4" />
            Visitas de hoy
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{cliRes.data?.name ?? "Cliente"}</h1>
            <p className="text-muted-foreground text-sm">
              {stRes.data?.name ?? ""}
              {svc.scheduled_at ? ` · ${santiagoDate(svc.scheduled_at)} ${santiagoTime(svc.scheduled_at)}` : ""}
            </p>
            {br && (
              <p className="text-muted-foreground text-sm">
                {br.name}
                {br.address ? ` · ${br.address}` : ""}
              </p>
            )}
          </div>
          <Badge variant={terminada ? "success" : "secondary"}>
            {svc.field_status === "por_validar" ? "Por validar" : svc.field_status === "terminada" ? "Terminada" : "En curso"}
          </Badge>
        </div>
        {mapsHref && (
          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary flex w-fit items-center gap-1 text-sm underline"
          >
            <MapPin className="size-4" />
            Cómo llegar (Google Maps)
          </a>
        )}
      </div>

      {svc.field_status === "por_validar" && (
        <p className="text-warning bg-warning/10 rounded-lg px-3 py-2 text-sm font-medium">
          Visita terminada por el técnico — pendiente de validación en la oficina.
        </p>
      )}

      <CaptureForm
        serviceId={svc.id}
        tenantId={tenantId}
        checkinHora={asStr(field.checkin_hora) || null}
        data={{
          trabajo_realizado: asStr(pick("trabajo_realizado")),
          observaciones: asStr(pick("observaciones")),
          recomendaciones: asStr(pick("recomendaciones")),
          plagas_detectadas: asArr(pick("plagas_detectadas")).filter((x): x is string => typeof x === "string"),
          nombre_firmante: asStr(pick("nombre_firmante")),
          rut_firmante: asStr(pick("rut_firmante")),
          firma_cliente_base64: asStr(field.firma_cliente_base64) || null,
        }}
        pests={(pestsRes.data ?? []).map((p) => p.name)}
        fotosIniciales={fotosIniciales}
        terminada={terminada}
      />
    </div>
  );
}
