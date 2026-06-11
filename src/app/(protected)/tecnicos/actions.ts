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
