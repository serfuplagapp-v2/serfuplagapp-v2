"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { requireEnabledProfile } from "@/lib/auth";
import { santiagoLocalToISO } from "@/lib/datetime";
import type { Json, ServiceFieldStatus } from "@/lib/supabase/types";
import type { FormState } from "../../clientes/form-state";

function str(fd: FormData, k: string): string {
  return String(fd.get(k) ?? "").trim();
}

/** Arma el field_data desde el formulario (mismo esqueleto que la v1). */
function buildFieldData(fd: FormData): Record<string, Json> {
  let productos: Json = [];
  try {
    const raw = JSON.parse(str(fd, "productos_usados") || "[]");
    if (Array.isArray(raw)) {
      productos = raw
        .filter((p) => p && typeof p === "object" && typeof p.nombre === "string" && p.nombre.trim())
        .map((p) => ({
          nombre: String(p.nombre).slice(0, 200),
          cantidad: String(p.cantidad ?? "").slice(0, 50),
          unidad: String(p.unidad ?? "").slice(0, 50),
        }));
    }
  } catch {
    productos = [];
  }
  return {
    tipo_visita: str(fd, "tipo_visita") || "servicio_calendarizado",
    metodologia: str(fd, "metodologia") || "M.I.P (Manejo Integrado de Plagas)",
    grado_infestacion: str(fd, "grado_infestacion") || "sin_evidencia",
    insumos: str(fd, "insumos") || "Plaguicidas con registro",
    areas_tratadas: str(fd, "areas_tratadas"),
    plagas_detectadas: fd.getAll("plagas").map((p) => String(p)).slice(0, 50),
    productos_usados: productos,
    trabajo_realizado: str(fd, "trabajo_realizado"),
    observaciones: str(fd, "observaciones"),
    recomendaciones: str(fd, "recomendaciones"),
    nombre_firmante: str(fd, "nombre_firmante"),
    rut_firmante: str(fd, "rut_firmante"),
    correo_firmante: str(fd, "correo_firmante"),
    vigencia_dias: Number(str(fd, "vigencia_dias")) || 30,
  };
}

/**
 * Guarda el detalle de la OT. Con intent="cerrar" además la cierra: asigna el
 * folio correlativo (atómico), crea el certificado y deja la OT terminada.
 */
export async function saveOrden(_prev: FormState, fd: FormData): Promise<FormState> {
  const { tenantId } = await requireEnabledProfile();
  const id = str(fd, "id");
  if (!id) return { error: "Orden inválida." };
  const intent = str(fd, "intent");

  const supabase = await createSupabaseServerClient();
  const { data: svc } = await supabase
    .from("services")
    .select("id, client_id, branch_id, service_type_id, scheduled_at, field_status, field_data, legacy_data")
    .eq("id", id)
    .maybeSingle();
  if (!svc) return { error: "No se encontró la orden." };

  // 1) Guardar los datos del formulario.
  const fieldData = buildFieldData(fd);
  const scheduledAt = santiagoLocalToISO(str(fd, "scheduled_at")) ?? svc.scheduled_at;
  const notes = str(fd, "notes") || null;

  const { error: upErr } = await supabase
    .from("services")
    .update({ field_data: fieldData, scheduled_at: scheduledAt, notes })
    .eq("id", id);
  if (upErr) return { error: "No se pudieron guardar los cambios." };

  // Técnico (reemplaza la asignación, igual que el calendario). En OTs
  // terminadas el selector va deshabilitado (no se envía): NO tocar la
  // asignación histórica en ese caso.
  let technicianId = str(fd, "technician_id");
  if (svc.field_status !== "terminada") {
    await supabase.from("service_technicians").delete().eq("service_id", id);
    if (technicianId) {
      const { error: tErr } = await supabase.from("service_technicians").insert({
        tenant_id: tenantId,
        service_id: id,
        technician_id: technicianId,
      });
      if (tErr) return { error: "Los datos se guardaron, pero no se pudo asignar el técnico." };
      if (svc.field_status === "planificada") {
        await supabase.from("services").update({ field_status: "asignada" }).eq("id", id);
      }
    }
  } else {
    const { data: pair } = await supabase
      .from("service_technicians")
      .select("technician_id")
      .eq("service_id", id)
      .limit(1);
    technicianId = pair?.[0]?.technician_id ?? "";
  }

  revalidatePath(`/ordenes/${id}`);
  revalidatePath("/ordenes");
  revalidatePath("/agenda");

  if (intent !== "cerrar") return { error: null };

  // 2) Cerrar OT y generar certificado (réplica del flujo v1).
  if (svc.field_status === "terminada") return { error: "Esta orden ya está terminada." };
  if (!technicianId) return { error: "Para cerrar la OT primero asigna un técnico." };

  // Folio correlativo atómico.
  const { data: folio, error: folioErr } = await supabase.rpc("next_cert_folio");
  if (folioErr || typeof folio !== "number") {
    return { error: "No se pudo obtener el folio correlativo. Revisa Configuración." };
  }

  // Nombres para congelar en el certificado (el cert es una foto del momento).
  const [{ data: cli }, { data: br }, { data: st }, { data: tech }] = await Promise.all([
    supabase.from("clients").select("name, rut").eq("id", svc.client_id).maybeSingle(),
    svc.branch_id
      ? supabase.from("branches").select("name, address").eq("id", svc.branch_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("service_types").select("name").eq("id", svc.service_type_id).maybeSingle(),
    supabase.from("technicians").select("full_name").eq("id", technicianId).maybeSingle(),
  ]);

  const vigenciaDias = Number(fieldData.vigencia_dias) || 30;
  const base = scheduledAt ? new Date(scheduledAt) : new Date();
  const vigencia = new Date(base);
  vigencia.setUTCDate(vigencia.getUTCDate() + vigenciaDias);

  const certData: Record<string, Json> = {
    ...fieldData,
    cliente_nombre: cli?.name ?? "",
    cliente_rut: cli?.rut ?? null,
    sucursal_nombre: br?.name ?? null,
    direccion: br?.address ?? null,
    servicios: [st?.name ?? "Servicio"],
    tecnico: tech?.full_name ?? "",
    tecnicos: tech?.full_name ? [tech.full_name] : [],
    titular: String(fieldData.nombre_firmante ?? ""),
    fecha_vigencia: vigencia.toISOString(),
  };

  const { data: cert, error: certErr } = await supabase
    .from("certificates")
    .insert({
      tenant_id: tenantId,
      folio,
      service_id: id,
      client_id: svc.client_id,
      branch_id: svc.branch_id,
      issued_at: new Date().toISOString(),
      service_date: scheduledAt,
      data: certData,
    })
    .select("id")
    .single();
  if (certErr || !cert) {
    // OJO: el folio ya se consumió; preferimos un folio saltado a un cert duplicado.
    return { error: "No se pudo crear el certificado (el folio quedó reservado). Inténtalo de nuevo." };
  }

  const { error: closeErr } = await supabase
    .from("services")
    .update({ field_status: "terminada", completed_at: new Date().toISOString() })
    .eq("id", id);
  if (closeErr) {
    return { error: `El certificado folio ${folio} se creó, pero la OT no quedó marcada terminada. Reintenta.` };
  }

  revalidatePath(`/ordenes/${id}`);
  revalidatePath("/ordenes");
  revalidatePath("/terreno");
  redirect(`/terreno/${cert.id}`);
}

/** Cambia el estado de terreno con un clic (asignada → en proceso → por validar). */
export async function setOrdenFieldStatus(fd: FormData): Promise<void> {
  await requireEnabledProfile();
  const id = String(fd.get("id") ?? "");
  const status = String(fd.get("status") ?? "") as ServiceFieldStatus;
  const valid: ServiceFieldStatus[] = ["planificada", "asignada", "en_proceso", "por_validar"];
  if (!id || !valid.includes(status)) return;
  const supabase = await createSupabaseServerClient();
  await supabase.from("services").update({ field_status: status }).eq("id", id);
  revalidatePath(`/ordenes/${id}`);
  revalidatePath("/ordenes");
}

/** Elimina la OT (solo si aún no se ejecuta: planificada o asignada, regla v1). */
export async function deleteOrden(fd: FormData): Promise<void> {
  await requireEnabledProfile();
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  const supabase = await createSupabaseServerClient();
  const { data: svc } = await supabase
    .from("services")
    .select("field_status")
    .eq("id", id)
    .maybeSingle();
  if (!svc || !["planificada", "asignada"].includes(svc.field_status)) {
    redirect(`/ordenes/${id}?error=no-eliminable`);
  }
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) redirect(`/ordenes/${id}?error=eliminar`);
  revalidatePath("/ordenes");
  revalidatePath("/agenda");
  redirect("/ordenes");
}
