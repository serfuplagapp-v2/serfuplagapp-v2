"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { requireEnabledProfile } from "@/lib/auth";
import { santiagoLocalToISO } from "@/lib/datetime";
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
    await supabase.from("service_technicians").insert({
      tenant_id: tenantId,
      service_id: data.id,
      technician_id: technicianId,
    });
  }

  revalidatePath("/agenda");
  redirect("/agenda");
}
