"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { requireEnabledProfile } from "@/lib/auth";
import { santiagoLocalToISO, santiagoTime } from "@/lib/datetime";
import { computeProposals } from "@/lib/generator";
import type { FormState } from "../clientes/form-state";

export async function createService(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { tenantId } = await requireEnabledProfile();

  const clientId = String(formData.get("client_id") ?? "");
  const serviceTypeId = String(formData.get("service_type_id") ?? "");
  if (!clientId) return { error: "Selecciona un cliente." };
  if (!serviceTypeId) return { error: "Selecciona un tipo de servicio." };

  const scheduledAt = santiagoLocalToISO(String(formData.get("scheduled_at") ?? ""));
  const technicianId = String(formData.get("technician_id") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("services")
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      service_type_id: serviceTypeId,
      scheduled_at: scheduledAt,
      notes,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "No se pudo crear el servicio." };

  if (technicianId) {
    const { error: techError } = await supabase.from("service_technicians").insert({
      tenant_id: tenantId,
      service_id: data.id,
      technician_id: technicianId,
    });
    if (techError) {
      return {
        error:
          "El servicio se creó, pero no se pudo asignar el técnico. Asígnalo desde la agenda.",
      };
    }
  }

  revalidatePath("/agenda");
  redirect("/agenda");
}

// ─────────────────────────────────────────────────────────────────────────────
// Generador de propuestas desde contratos
// ─────────────────────────────────────────────────────────────────────────────

/** Genera servicios PROPUESTOS (recalcula en el servidor; no confía en el cliente). */
export async function generateProposals(formData: FormData): Promise<void> {
  const { tenantId } = await requireEnabledProfile();
  const from = String(formData.get("from") ?? "");
  const to = String(formData.get("to") ?? "");
  const clientId = String(formData.get("client_id") ?? "").trim() || null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
    redirect("/agenda/generar?error=rango");
  }

  const supabase = await createSupabaseServerClient();
  const { proposals } = await computeProposals(supabase, { from, to, clientId });

  if (proposals.length > 0) {
    const rows = proposals.map((p) => ({
      tenant_id: tenantId,
      client_id: p.clientId,
      branch_id: p.branchId,
      contract_id: p.contractId,
      service_type_id: p.serviceTypeId,
      scheduled_at: p.scheduledAtISO,
      agenda_status: "propuesto" as const,
    }));
    // Insertar por lotes para no exceder límites del cliente. Si un lote falla,
    // se corta y se avisa: las propuestas ya insertadas quedan en la página de
    // propuestas (donde se pueden aprobar o descartar sin perder nada).
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from("services").insert(rows.slice(i, i + 500));
      if (error) {
        revalidatePath("/agenda");
        revalidatePath("/agenda/propuestas");
        redirect(`/agenda/propuestas?error=guardar&ok=${i}&total=${rows.length}`);
      }
    }
  }

  revalidatePath("/agenda");
  revalidatePath("/agenda/propuestas");
  redirect("/agenda/propuestas");
}

function idList(formData: FormData): string[] {
  return String(formData.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Aprobar propuestas: pasan de 'propuesto' a 'programado'. */
export async function approveProposals(formData: FormData): Promise<void> {
  await requireEnabledProfile();
  const supabase = await createSupabaseServerClient();
  const ids = idList(formData);
  let q = supabase
    .from("services")
    .update({ agenda_status: "programado" })
    .eq("agenda_status", "propuesto");
  // La RLS limita a la empresa; si vienen ids, solo esos; si no, todas las propuestas.
  if (ids.length > 0) q = q.in("id", ids);
  const { error } = await q;
  revalidatePath("/agenda");
  revalidatePath("/agenda/propuestas");
  redirect(error ? "/agenda/propuestas?error=accion" : "/agenda/propuestas");
}

/** Descartar propuestas: se eliminan (solo las que están en 'propuesto'). */
export async function discardProposals(formData: FormData): Promise<void> {
  await requireEnabledProfile();
  const supabase = await createSupabaseServerClient();
  const ids = idList(formData);
  let q = supabase.from("services").delete().eq("agenda_status", "propuesto");
  if (ids.length > 0) q = q.in("id", ids);
  const { error } = await q;
  revalidatePath("/agenda");
  revalidatePath("/agenda/propuestas");
  redirect(error ? "/agenda/propuestas?error=accion" : "/agenda/propuestas");
}

// ─────────────────────────────────────────────────────────────────────────────
// Calendario: reprogramar (arrastrar a otro día) y asignar técnico
// ─────────────────────────────────────────────────────────────────────────────

/** Mueve un servicio a otra fecha conservando la hora local de Chile. */
export async function rescheduleService(serviceId: string, newDate: string): Promise<void> {
  await requireEnabledProfile();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return;
  const supabase = await createSupabaseServerClient();

  const { data: svc } = await supabase
    .from("services")
    .select("id, scheduled_at")
    .eq("id", serviceId)
    .maybeSingle();
  if (!svc) return;

  // Conservar la hora local actual; si no tenía, usar 09:00.
  const time = svc.scheduled_at ? santiagoTime(svc.scheduled_at) : "09:00";
  const iso = santiagoLocalToISO(`${newDate}T${time}`);
  if (!iso) return;

  await supabase.from("services").update({ scheduled_at: iso }).eq("id", serviceId);
  revalidatePath("/agenda");
}

/** Asigna (o limpia) el técnico de un servicio. Refleja el estado de terreno. */
export async function assignTechnician(
  serviceId: string,
  technicianId: string | null,
): Promise<void> {
  const { tenantId } = await requireEnabledProfile();
  const supabase = await createSupabaseServerClient();

  const { data: svc } = await supabase
    .from("services")
    .select("id, field_status")
    .eq("id", serviceId)
    .maybeSingle();
  if (!svc) return;

  // Reemplazar la asignación (la UI maneja un solo técnico desde el calendario).
  await supabase.from("service_technicians").delete().eq("service_id", serviceId);
  if (technicianId) {
    await supabase.from("service_technicians").insert({
      tenant_id: tenantId,
      service_id: serviceId,
      technician_id: technicianId,
    });
    if (svc.field_status === "planificada") {
      await supabase.from("services").update({ field_status: "asignada" }).eq("id", serviceId);
    }
  } else if (svc.field_status === "asignada") {
    await supabase.from("services").update({ field_status: "planificada" }).eq("id", serviceId);
  }

  revalidatePath("/agenda");
}
