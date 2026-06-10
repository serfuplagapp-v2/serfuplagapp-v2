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
