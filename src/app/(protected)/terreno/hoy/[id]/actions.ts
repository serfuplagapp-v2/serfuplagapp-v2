"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { requireEnabledProfile } from "@/lib/auth";
import type { Json } from "@/lib/supabase/types";
import type { FormState } from "../../../clientes/form-state";

/** Mezcla campos nuevos sobre el field_data existente (sin perder lo previo). */
async function mergeFieldData(
  serviceId: string,
  patch: Record<string, Json>,
): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data: svc } = await supabase
    .from("services")
    .select("field_data")
    .eq("id", serviceId)
    .maybeSingle();
  if (!svc) return "No se encontró la visita.";
  const current = (svc.field_data ?? {}) as Record<string, Json>;
  const { error } = await supabase
    .from("services")
    .update({ field_data: { ...current, ...patch } })
    .eq("id", serviceId);
  return error ? "No se pudo guardar." : null;
}

/** Check-in del técnico: hora + GPS (si el teléfono lo entrega) y pasa a "en proceso". */
export async function checkIn(
  serviceId: string,
  lat: number | null,
  lng: number | null,
): Promise<void> {
  await requireEnabledProfile();
  const patch: Record<string, Json> = { checkin_hora: new Date().toISOString() };
  if (typeof lat === "number" && typeof lng === "number") {
    patch.checkin_lat = lat;
    patch.checkin_lng = lng;
  }
  const err = await mergeFieldData(serviceId, patch);
  if (!err) {
    const supabase = await createSupabaseServerClient();
    await supabase
      .from("services")
      .update({ field_status: "en_proceso" })
      .eq("id", serviceId)
      .in("field_status", ["planificada", "asignada"]);
  }
  revalidatePath(`/terreno/hoy/${serviceId}`);
  revalidatePath("/terreno/hoy");
}

/**
 * Guarda el registro de la visita. Con intent="terminar" además hace el
 * check-out y deja la OT "por validar" (el admin la cierra y emite el
 * certificado desde /ordenes — flujo v1).
 */
export async function saveVisit(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireEnabledProfile();
  const id = String(fd.get("id") ?? "").trim();
  if (!id) return { error: "Visita inválida." };
  const intent = String(fd.get("intent") ?? "guardar");
  const str = (k: string) => String(fd.get(k) ?? "").trim();

  let fotos: Json = [];
  try {
    const raw = JSON.parse(str("fotos") || "[]");
    if (Array.isArray(raw)) fotos = raw.filter((p) => typeof p === "string").slice(0, 30);
  } catch {
    fotos = [];
  }

  const patch: Record<string, Json> = {
    trabajo_realizado: str("trabajo_realizado"),
    observaciones: str("observaciones"),
    recomendaciones: str("recomendaciones"),
    plagas_detectadas: fd.getAll("plagas").map((p) => String(p)).slice(0, 50),
    nombre_firmante: str("nombre_firmante"),
    rut_firmante: str("rut_firmante"),
    fotos,
  };
  const firma = str("firma_base64");
  if (firma.startsWith("data:image/")) patch.firma_cliente_base64 = firma;

  if (intent === "terminar") {
    if (!patch.trabajo_realizado) {
      return { error: "Describe el trabajo realizado antes de terminar la visita." };
    }
    if (!patch.nombre_firmante) {
      return { error: "Falta el nombre de quien recibe el servicio." };
    }
    patch.checkout_hora = new Date().toISOString();
    const lat = Number(fd.get("checkout_lat"));
    const lng = Number(fd.get("checkout_lng"));
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      patch.checkout_lat = lat;
      patch.checkout_lng = lng;
    }
  }

  const err = await mergeFieldData(id, patch);
  if (err) return { error: err };

  if (intent === "terminar") {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("services")
      .update({ field_status: "por_validar" })
      .eq("id", id)
      .neq("field_status", "terminada");
    if (error) return { error: "El registro se guardó pero no se pudo cerrar la visita." };
    revalidatePath("/terreno/hoy");
    revalidatePath("/ordenes");
    redirect("/terreno/hoy?ok=1");
  }

  revalidatePath(`/terreno/hoy/${id}`);
  return { error: null };
}
