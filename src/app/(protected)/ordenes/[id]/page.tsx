import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ClipboardList, FileCheck2 } from "lucide-react";

import { requireEnabledProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { santiagoDate, santiagoTime } from "@/lib/datetime";
import type { Json, ServiceAgendaStatus, ServiceFieldStatus } from "@/lib/supabase/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { OtForm, type OtFormData, type ProductoUsado } from "./ot-form";
import { setOrdenFieldStatus, deleteOrden } from "./actions";

export const dynamic = "force-dynamic";

type BadgeVariant = React.ComponentProps<typeof Badge>["variant"];

const AGENDA_BADGE: Record<ServiceAgendaStatus, { label: string; variant: BadgeVariant }> = {
  propuesto: { label: "Propuesto", variant: "muted" },
  programado: { label: "Programado", variant: "secondary" },
  enviado: { label: "Enviado", variant: "secondary" },
  confirmado: { label: "Confirmado", variant: "success" },
  reprogramado: { label: "Reprogramado", variant: "warning" },
  cancelado: { label: "Cancelado", variant: "destructive" },
};
const FIELD_LABEL: Record<ServiceFieldStatus, string> = {
  planificada: "Planificada",
  asignada: "Asignada",
  en_proceso: "En proceso",
  por_validar: "Por validar",
  terminada: "Terminada",
};

const asStr = (v: Json | undefined, fallback = ""): string =>
  typeof v === "string" ? v : fallback;
const asArr = (v: Json | undefined): Json[] => (Array.isArray(v) ? v : []);

export default async function OrdenDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireEnabledProfile();
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: svc } = await supabase
    .from("services")
    .select(
      "id, client_id, branch_id, service_type_id, scheduled_at, agenda_status, field_status, notes, field_data, legacy_data",
    )
    .eq("id", id)
    .maybeSingle();
  if (!svc) notFound();

  const [cliRes, brRes, stRes, techsRes, pairRes, pestsRes, prodRes, certRes] = await Promise.all([
    supabase.from("clients").select("id, name").eq("id", svc.client_id).maybeSingle(),
    svc.branch_id
      ? supabase.from("branches").select("id, name, address").eq("id", svc.branch_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("service_types").select("name").eq("id", svc.service_type_id).maybeSingle(),
    supabase.from("technicians").select("id, full_name").eq("active", true).order("full_name").limit(200),
    supabase.from("service_technicians").select("technician_id").eq("service_id", id).limit(10),
    supabase.from("pests").select("name").eq("active", true).order("name").limit(200),
    supabase.from("products").select("name, unidad").eq("active", true).order("name").limit(500),
    supabase.from("certificates").select("id, folio").eq("service_id", id).order("folio", { ascending: false }).limit(5),
  ]);

  // Prefill: lo capturado en la v2 manda; si no hay, lo heredado de la v1.
  const legacy = (svc.legacy_data ?? {}) as Record<string, Json>;
  const field = (svc.field_data ?? {}) as Record<string, Json>;
  const pick = (k: string): Json | undefined => (field[k] !== undefined && field[k] !== "" ? field[k] : legacy[k]);

  const productosRaw = asArr(pick("productos_usados"));
  const productos: ProductoUsado[] = productosRaw
    .map((p) => {
      if (typeof p === "string") return { nombre: p, cantidad: "", unidad: "" };
      if (p && typeof p === "object" && !Array.isArray(p)) {
        const o = p as Record<string, Json>;
        return {
          nombre: asStr(o.nombre),
          cantidad: typeof o.cantidad === "number" ? String(o.cantidad) : asStr(o.cantidad),
          unidad: asStr(o.unidad),
        };
      }
      return { nombre: "", cantidad: "", unidad: "" };
    })
    .filter((p) => p.nombre);

  const formData: OtFormData = {
    tipo_visita: asStr(pick("tipo_visita"), "servicio_calendarizado"),
    metodologia: asStr(pick("metodologia"), "M.I.P (Manejo Integrado de Plagas)"),
    grado_infestacion: asStr(pick("grado_infestacion"), "sin_evidencia"),
    insumos: asStr(pick("insumos"), "Plaguicidas con registro"),
    areas_tratadas: asStr(pick("areas_tratadas")),
    plagas_detectadas: asArr(pick("plagas_detectadas")).filter((x): x is string => typeof x === "string"),
    productos_usados: productos,
    trabajo_realizado: asStr(pick("trabajo_realizado")),
    observaciones: asStr(pick("observaciones")),
    recomendaciones: asStr(pick("recomendaciones")),
    nombre_firmante: asStr(pick("nombre_firmante")),
    rut_firmante: asStr(pick("rut_firmante")),
    correo_firmante: asStr(pick("correo_firmante")),
    vigencia_dias: Number(pick("vigencia_dias")) || 30,
  };

  const scheduledLocal = svc.scheduled_at
    ? `${santiagoDate(svc.scheduled_at)}T${santiagoTime(svc.scheduled_at)}`
    : "";
  const technicianId = pairRes.data?.[0]?.technician_id ?? "";
  const terminada = svc.field_status === "terminada";
  const certs = certRes.data ?? [];

  // Transiciones rápidas de estado de terreno (sin cerrar).
  const quick: { to: ServiceFieldStatus; label: string }[] = terminada
    ? []
    : svc.field_status === "planificada" || svc.field_status === "asignada"
      ? [{ to: "en_proceso", label: "▶ Marcar en proceso" }]
      : svc.field_status === "en_proceso"
        ? [{ to: "por_validar", label: "Pasar a por validar" }]
        : [];

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
          <Link href="/ordenes">
            <ChevronLeft className="size-4" />
            Volver a Órdenes
          </Link>
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <ClipboardList className="text-primary size-6" aria-hidden />
              <Link href={`/clientes/${svc.client_id}`} className="hover:underline">
                {cliRes.data?.name ?? "Cliente"}
              </Link>
            </h1>
            <p className="text-muted-foreground text-sm">
              {stRes.data?.name ?? "Servicio"}
              {brRes.data ? ` · ${brRes.data.name}` : ""}
              {svc.scheduled_at
                ? ` · ${santiagoDate(svc.scheduled_at)} ${santiagoTime(svc.scheduled_at)}`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant={AGENDA_BADGE[svc.agenda_status].variant}>
              {AGENDA_BADGE[svc.agenda_status].label}
            </Badge>
            <Badge variant={terminada ? "success" : "secondary"}>{FIELD_LABEL[svc.field_status]}</Badge>
          </div>
        </div>
      </div>

      {sp.error === "no-eliminable" && (
        <Alert variant="destructive">
          <AlertDescription>
            Esta OT ya está en ejecución o terminada: no se puede eliminar (regla heredada de la v1).
          </AlertDescription>
        </Alert>
      )}
      {sp.error === "eliminar" && (
        <Alert variant="destructive">
          <AlertDescription>No se pudo eliminar la OT.</AlertDescription>
        </Alert>
      )}

      {/* Certificados ya emitidos para esta OT */}
      {certs.length > 0 && (
        <Alert variant="success">
          <AlertDescription className="flex flex-wrap items-center gap-2">
            <FileCheck2 className="size-4" aria-hidden />
            {certs.length === 1 ? "Certificado emitido:" : "Certificados emitidos:"}
            {certs.map((c) => (
              <Link key={c.id} href={`/terreno/${c.id}`} className="font-semibold underline">
                Folio {c.folio}
              </Link>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {/* Transición rápida de estado */}
      {quick.length > 0 && (
        <div className="bg-card flex flex-wrap items-center gap-2 rounded-xl border p-3">
          <span className="text-muted-foreground text-sm">Estado de terreno:</span>
          {quick.map((qb) => (
            <form key={qb.to} action={setOrdenFieldStatus}>
              <input type="hidden" name="id" value={svc.id} />
              <input type="hidden" name="status" value={qb.to} />
              <Button type="submit" size="sm" variant="outline">
                {qb.label}
              </Button>
            </form>
          ))}
        </div>
      )}

      <OtForm
        serviceId={svc.id}
        scheduledLocal={scheduledLocal}
        technicianId={technicianId}
        notes={svc.notes ?? ""}
        terminada={terminada}
        data={formData}
        technicians={(techsRes.data ?? []).map((t) => ({ id: t.id, name: t.full_name }))}
        pests={(pestsRes.data ?? []).map((p) => p.name)}
        productCatalog={(prodRes.data ?? []).map((p) => ({ name: p.name, unidad: p.unidad }))}
      />

      {["planificada", "asignada"].includes(svc.field_status) && (
        <div className="border-t pt-3">
          <form action={deleteOrden}>
            <input type="hidden" name="id" value={svc.id} />
            <ConfirmSubmit
              variant="ghost"
              size="sm"
              className="text-destructive"
              message="¿Eliminar esta orden de trabajo? Esta acción no se puede deshacer."
            >
              Eliminar OT
            </ConfirmSubmit>
          </form>
        </div>
      )}
    </div>
  );
}
