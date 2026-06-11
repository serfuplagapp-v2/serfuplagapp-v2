"use server";

import { revalidatePath } from "next/cache";

import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { requireEnabledProfile } from "@/lib/auth";
import type { FormState } from "../clientes/form-state";

export async function createTask(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { tenantId } = await requireEnabledProfile();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Escribe el título de la tarea." };

  const dueRaw = String(formData.get("due_date") ?? "").trim();
  const due_date = /^\d{4}-\d{2}-\d{2}$/.test(dueRaw) ? dueRaw : null;
  const priority = String(formData.get("priority") ?? "") === "alta" ? "alta" as const : "normal" as const;
  const client_id = String(formData.get("client_id") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("tasks").insert({
    tenant_id: tenantId,
    title,
    due_date,
    priority,
    client_id,
    notes,
  });
  if (error) return { error: "No se pudo crear la tarea." };

  revalidatePath("/pendientes");
  return { error: null };
}

/** Marca una tarea como hecha (o la reabre). */
export async function toggleTask(formData: FormData): Promise<void> {
  await requireEnabledProfile();
  const id = String(formData.get("id") ?? "");
  const done = String(formData.get("done") ?? "") === "true";
  if (!id) return;
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("tasks")
    .update({
      status: done ? "hecha" : "pendiente",
      done_at: done ? new Date().toISOString() : null,
    })
    .eq("id", id);
  revalidatePath("/pendientes");
}

export async function deleteTask(formData: FormData): Promise<void> {
  await requireEnabledProfile();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createSupabaseServerClient();
  await supabase.from("tasks").delete().eq("id", id);
  revalidatePath("/pendientes");
}
