"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { requireEnabledProfile } from "@/lib/auth";
import type { MovementType, MovementStatus } from "@/lib/supabase/types";
import type { FormState } from "./form-state";

const TYPES: MovementType[] = ["venta", "cotizacion", "nota_credito"];
const STATUSES: MovementStatus[] = [
  "cotizado",
  "aprobado",
  "facturado",
  "pagado",
  "rechazado",
];

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}
function strOrNull(formData: FormData, key: string): string | null {
  const v = str(formData, key);
  return v === "" ? null : v;
}

function parseAmount(formData: FormData, type: MovementType): number | null {
  const amountDigits = str(formData, "amount").replace(/[^0-9-]/g, "");
  const parsed = amountDigits && amountDigits !== "-" ? parseInt(amountDigits, 10) : NaN;
  if (Number.isNaN(parsed)) return null;
  // Nota de crédito siempre con monto negativo (lección de la consolidación RCV).
  return type === "nota_credito" ? -Math.abs(parsed) : parsed;
}

/** Actualiza un movimiento existente (fecha, cliente, tipo, monto, estado, glosa, OC, folio). */
export async function updateMovement(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireEnabledProfile();
  const id = str(formData, "id");
  if (!id) return { error: "Movimiento inválido." };

  const date = str(formData, "date");
  if (!date) return { error: "La fecha es obligatoria." };

  const typeRaw = str(formData, "type");
  const type: MovementType = TYPES.includes(typeRaw as MovementType)
    ? (typeRaw as MovementType)
    : "venta";
  const amount = parseAmount(formData, type);
  if (amount === null) return { error: "El monto es obligatorio y debe ser un número." };

  const statusRaw = str(formData, "status");
  const status: MovementStatus = STATUSES.includes(statusRaw as MovementStatus)
    ? (statusRaw as MovementStatus)
    : "cotizado";

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("movements")
    .update({
      client_id: strOrNull(formData, "client_id"),
      date,
      type,
      amount,
      status,
      description: strOrNull(formData, "description"),
      oc_number: strOrNull(formData, "oc_number"),
      dte_folio: strOrNull(formData, "dte_folio"),
    })
    .eq("id", id);
  if (error) return { error: "No se pudieron guardar los cambios." };

  revalidatePath("/comercial");
  revalidatePath(`/comercial/${id}`);
  return { error: null };
}

/** Avanza (o cambia) el estado del movimiento con un clic. */
export async function setMovementStatus(formData: FormData): Promise<void> {
  await requireEnabledProfile();
  const id = String(formData.get("id") ?? "");
  const statusRaw = String(formData.get("status") ?? "");
  if (!id || !STATUSES.includes(statusRaw as MovementStatus)) return;
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("movements")
    .update({ status: statusRaw as MovementStatus })
    .eq("id", id);
  revalidatePath("/comercial");
  revalidatePath(`/comercial/${id}`);
}

/** Elimina un movimiento (con confirmación en la UI). */
export async function deleteMovement(formData: FormData): Promise<void> {
  await requireEnabledProfile();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createSupabaseServerClient();
  // Primero los enlaces (movement_services y DTE caen por FK cascade si aplica;
  // movement_services tiene FK compuesta on delete cascade vía movements).
  const { error } = await supabase.from("movements").delete().eq("id", id);
  if (error) {
    redirect(`/comercial/${id}?error=eliminar`);
  }
  revalidatePath("/comercial");
  redirect("/comercial");
}

export async function createMovement(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { tenantId } = await requireEnabledProfile();

  const date = str(formData, "date");
  if (!date) return { error: "La fecha es obligatoria." };

  const amountDigits = str(formData, "amount").replace(/[^0-9-]/g, "");
  const parsed = amountDigits && amountDigits !== "-" ? parseInt(amountDigits, 10) : NaN;
  if (Number.isNaN(parsed)) return { error: "El monto es obligatorio y debe ser un número." };

  const typeRaw = str(formData, "type");
  const type: MovementType = TYPES.includes(typeRaw as MovementType)
    ? (typeRaw as MovementType)
    : "venta";

  // Nota de crédito siempre con monto negativo (lección de la consolidación RCV).
  const amount = type === "nota_credito" ? -Math.abs(parsed) : parsed;

  const statusRaw = str(formData, "status");
  const status: MovementStatus = STATUSES.includes(statusRaw as MovementStatus)
    ? (statusRaw as MovementStatus)
    : "cotizado";

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("movements").insert({
    tenant_id: tenantId,
    client_id: strOrNull(formData, "client_id"),
    date,
    type,
    amount,
    status,
    description: strOrNull(formData, "description"),
    oc_number: strOrNull(formData, "oc_number"),
  });

  if (error) {
    return { error: "No se pudo registrar el movimiento. Revisa los datos." };
  }

  revalidatePath("/comercial");
  redirect("/comercial");
}
