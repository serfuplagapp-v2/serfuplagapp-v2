"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { requireEnabledProfile } from "@/lib/auth";
import type { FormState } from "../clientes/form-state";

export async function createTechnician(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { tenantId } = await requireEnabledProfile();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const licenseInfo = String(formData.get("license_info") ?? "").trim() || null;
  if (!fullName) return { error: "El nombre del técnico es obligatorio." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("technicians").insert({
    tenant_id: tenantId,
    full_name: fullName,
    license_info: licenseInfo,
  });
  if (error) return { error: "No se pudo crear el técnico." };

  revalidatePath("/tecnicos");
  redirect("/tecnicos");
}

export async function toggleTechnician(formData: FormData): Promise<void> {
  await requireEnabledProfile();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) return;

  const supabase = await createSupabaseServerClient();
  await supabase.from("technicians").update({ active }).eq("id", id);
  revalidatePath("/tecnicos");
}

/**
 * Enlaza (o desenlaza, con valor vacío) la cuenta de la app de un técnico.
 * Con la cuenta enlazada, ese usuario ve SOLO sus visitas en Terreno →
 * Visitas de hoy.
 */
export async function linkTechnicianProfile(formData: FormData): Promise<void> {
  const { tenantId } = await requireEnabledProfile();
  const id = String(formData.get("id") ?? "");
  const profileId = String(formData.get("profile_id") ?? "").trim();
  if (!id) return;

  const supabase = await createSupabaseServerClient();
  if (profileId) {
    // Solo cuentas de la propia empresa (la FK de profile_id no valida tenant,
    // así que se comprueba aquí; la RLS de profiles ya limita lo visible).
    const { data: prof } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", profileId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!prof) return;
  }
  await supabase
    .from("technicians")
    .update({ profile_id: profileId || null })
    .eq("id", id);
  revalidatePath("/tecnicos");
  revalidatePath("/terreno/hoy");
}
