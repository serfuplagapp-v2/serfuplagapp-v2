"use server";

import { revalidatePath } from "next/cache";

import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { requireEnabledProfile } from "@/lib/auth";
import type { FormState } from "../clientes/form-state";

/** Edita nombre y RUT de la empresa (solo owner/admin; la RLS lo refuerza). */
export async function updateTenant(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { role, tenantId } = await requireEnabledProfile();
  if (role !== "owner" && role !== "admin") {
    return { error: "Solo el dueño o un administrador puede editar la empresa." };
  }
  const name = String(formData.get("name") ?? "").trim();
  const rut = String(formData.get("rut") ?? "").trim() || null;
  if (!name) return { error: "El nombre de la empresa es obligatorio." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("tenants").update({ name, rut }).eq("id", tenantId);
  if (error) return { error: "No se pudieron guardar los datos de la empresa." };

  revalidatePath("/configuracion");
  return { error: null };
}

/** Agrega un tipo de servicio al catálogo de la empresa. */
export async function createServiceType(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { tenantId } = await requireEnabledProfile();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Escribe el nombre del tipo de servicio." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("service_types")
    .insert({ tenant_id: tenantId, name });
  if (error) {
    return { error: "No se pudo crear (¿ya existe un tipo con ese nombre?)." };
  }
  revalidatePath("/configuracion");
  return { error: null };
}

/** Activa o desactiva un tipo de servicio (no se borra: las OTs lo referencian). */
export async function toggleServiceType(formData: FormData): Promise<void> {
  await requireEnabledProfile();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) return;
  const supabase = await createSupabaseServerClient();
  await supabase.from("service_types").update({ active }).eq("id", id);
  revalidatePath("/configuracion");
}
