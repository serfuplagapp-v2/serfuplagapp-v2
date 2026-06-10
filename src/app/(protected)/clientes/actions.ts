"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { requireEnabledProfile } from "@/lib/auth";
import type { ClientType } from "@/lib/supabase/types";
import type { FormState } from "./form-state";

const CLIENT_TYPES: ClientType[] = ["residencial", "empresa", "institucional"];

/** Normaliza el RUT al formato único almacenado: sin puntos, con guion y DV. */
function normalizeRut(raw: string): string | null {
  const cleaned = raw.replace(/[.\s]/g, "").toUpperCase().trim();
  if (!cleaned) return null;
  if (cleaned.includes("-")) return cleaned;
  if (cleaned.length < 2) return cleaned;
  return `${cleaned.slice(0, -1)}-${cleaned.slice(-1)}`;
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}
function strOrNull(formData: FormData, key: string): string | null {
  const v = str(formData, key);
  return v === "" ? null : v;
}
function bool(formData: FormData, key: string): boolean {
  return formData.get(key) != null;
}

// ===========================================================================
// Clientes
// ===========================================================================
export async function createClient(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { tenantId } = await requireEnabledProfile();
  const name = str(formData, "name");
  if (!name) return { error: "El nombre del cliente es obligatorio." };

  const typeRaw = str(formData, "type");
  const type = CLIENT_TYPES.includes(typeRaw as ClientType)
    ? (typeRaw as ClientType)
    : null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      tenant_id: tenantId,
      name,
      rut: normalizeRut(str(formData, "rut")),
      type,
      notes: strOrNull(formData, "notes"),
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "No se pudo crear el cliente. Inténtalo nuevamente." };
  }

  revalidatePath("/clientes");
  redirect(`/clientes/${data.id}`);
}

export async function updateClient(
  clientId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireEnabledProfile();
  const name = str(formData, "name");
  if (!name) return { error: "El nombre del cliente es obligatorio." };

  const typeRaw = str(formData, "type");
  const type = CLIENT_TYPES.includes(typeRaw as ClientType)
    ? (typeRaw as ClientType)
    : null;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("clients")
    .update({
      name,
      rut: normalizeRut(str(formData, "rut")),
      type,
      notes: strOrNull(formData, "notes"),
    })
    .eq("id", clientId);

  if (error) return { error: "No se pudieron guardar los cambios." };

  revalidatePath("/clientes");
  redirect(`/clientes/${clientId}`);
}

export async function deleteClient(clientId: string): Promise<void> {
  await requireEnabledProfile();
  const supabase = await createSupabaseServerClient();
  await supabase.from("clients").delete().eq("id", clientId);
  revalidatePath("/clientes");
  redirect("/clientes");
}

// ===========================================================================
// Sucursales
// ===========================================================================
export async function createBranch(
  clientId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { tenantId } = await requireEnabledProfile();
  const name = str(formData, "name");
  if (!name) return { error: "El nombre de la sucursal es obligatorio." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("branches").insert({
    tenant_id: tenantId,
    client_id: clientId,
    name,
    address: strOrNull(formData, "address"),
  });

  if (error) return { error: "No se pudo crear la sucursal." };
  revalidatePath(`/clientes/${clientId}`);
  return { error: null };
}

export async function updateBranch(
  branchId: string,
  clientId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireEnabledProfile();
  const name = str(formData, "name");
  if (!name) return { error: "El nombre de la sucursal es obligatorio." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("branches")
    .update({ name, address: strOrNull(formData, "address") })
    .eq("id", branchId);

  if (error) return { error: "No se pudieron guardar los cambios." };
  revalidatePath(`/clientes/${clientId}`);
  return { error: null };
}

export async function deleteBranch(
  branchId: string,
  clientId: string,
): Promise<void> {
  await requireEnabledProfile();
  const supabase = await createSupabaseServerClient();
  await supabase.from("branches").delete().eq("id", branchId);
  revalidatePath(`/clientes/${clientId}`);
}

// ===========================================================================
// Contactos
// ===========================================================================
export async function createContact(
  clientId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { tenantId } = await requireEnabledProfile();
  const name = str(formData, "name");
  if (!name) return { error: "El nombre del contacto es obligatorio." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("contacts").insert({
    tenant_id: tenantId,
    client_id: clientId,
    branch_id: strOrNull(formData, "branch_id"),
    name,
    role: strOrNull(formData, "role"),
    phone: strOrNull(formData, "phone"),
    email: strOrNull(formData, "email"),
    es_destinatario: bool(formData, "es_destinatario"),
    es_cc: bool(formData, "es_cc"),
    recibe_whatsapp: bool(formData, "recibe_whatsapp"),
  });

  if (error) return { error: "No se pudo crear el contacto." };
  revalidatePath(`/clientes/${clientId}`);
  return { error: null };
}

export async function deleteContact(
  contactId: string,
  clientId: string,
): Promise<void> {
  await requireEnabledProfile();
  const supabase = await createSupabaseServerClient();
  await supabase.from("contacts").delete().eq("id", contactId);
  revalidatePath(`/clientes/${clientId}`);
}
