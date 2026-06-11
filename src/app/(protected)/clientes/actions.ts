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

export async function updateContact(
  contactId: string,
  clientId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireEnabledProfile();
  const name = str(formData, "name");
  if (!name) return { error: "El nombre del contacto es obligatorio." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("contacts")
    .update({
      name,
      role: strOrNull(formData, "role"),
      phone: strOrNull(formData, "phone"),
      email: strOrNull(formData, "email"),
      branch_id: strOrNull(formData, "branch_id"),
      es_destinatario: bool(formData, "es_destinatario"),
      es_cc: bool(formData, "es_cc"),
      recibe_whatsapp: bool(formData, "recibe_whatsapp"),
    })
    .eq("id", contactId);

  if (error) return { error: "No se pudieron guardar los cambios del contacto." };
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

// ===========================================================================
// Plantilla de correo del cliente (réplica pestaña "Correo" v1)
// ===========================================================================
const EMAILS_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Valida una lista "a@b.cl, c@d.cl" y la devuelve normalizada (o null si vacía). */
function normalizeEmailList(raw: string): { value: string | null; error: string | null } {
  const items = raw
    .split(/[,;]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!items.length) return { value: null, error: null };
  const bad = items.find((e) => !EMAILS_RE.test(e));
  if (bad) return { value: null, error: `"${bad}" no parece un correo válido.` };
  return { value: items.join(", "), error: null };
}

export async function saveEmailTemplate(
  clientId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { tenantId } = await requireEnabledProfile();

  const to = normalizeEmailList(str(formData, "to_emails"));
  if (to.error) return { error: `Destinatario: ${to.error}` };
  const cc = normalizeEmailList(str(formData, "cc_emails"));
  if (cc.error) return { error: `CC: ${cc.error}` };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("email_templates").upsert(
    {
      tenant_id: tenantId,
      client_id: clientId,
      to_emails: to.value,
      cc_emails: cc.value,
      subject: strOrNull(formData, "subject"),
      body: strOrNull(formData, "body"),
    },
    { onConflict: "client_id" },
  );

  if (error) return { error: "No se pudo guardar la plantilla de correo." };
  revalidatePath(`/clientes/${clientId}`);
  return { error: null };
}
