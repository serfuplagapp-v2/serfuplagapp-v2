import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Receipt } from "lucide-react";

import { requireEnabledProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { santiagoDate } from "@/lib/datetime";
import type { MovementStatus } from "@/lib/supabase/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { MovementEditForm } from "../movement-edit-form";
import { setMovementStatus, deleteMovement } from "../actions";

export const dynamic = "force-dynamic";

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const STATUS_LABEL: Record<MovementStatus, string> = {
  cotizado: "Cotizado",
  aprobado: "Aprobado",
  facturado: "Facturado",
  pagado: "Pagado",
  rechazado: "Rechazado",
};

// Avances de estado disponibles según el estado actual (flujo v1: cobro).
const NEXT_STATUS: Record<MovementStatus, { to: MovementStatus; label: string }[]> = {
  cotizado: [
    { to: "aprobado", label: "✓ Aprobar" },
    { to: "rechazado", label: "Rechazar" },
  ],
  aprobado: [
    { to: "facturado", label: "✓ Marcar facturado" },
    { to: "rechazado", label: "Rechazar" },
  ],
  facturado: [{ to: "pagado", label: "✓ Marcar pagado" }],
  pagado: [],
  rechazado: [{ to: "cotizado", label: "Reabrir como cotizado" }],
};

export default async function MovimientoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireEnabledProfile();
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: movement } = await supabase
    .from("movements")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!movement) notFound();

  const [{ data: clients }, { data: links }, { data: dtes }] = await Promise.all([
    supabase.from("clients").select("id, name").order("name").limit(500),
    supabase.from("movement_services").select("service_id").eq("movement_id", id),
    supabase
      .from("dte_documents")
      .select("id, sii_type, folio, status, pdf_path")
      .eq("movement_id", id),
  ]);

  // OTs enlazadas (solo de este movimiento — pocas).
  const serviceIds = (links ?? []).map((l) => l.service_id);
  let services: { id: string; scheduled_at: string | null; client_id: string }[] = [];
  if (serviceIds.length) {
    const { data } = await supabase
      .from("services")
      .select("id, scheduled_at, client_id")
      .in("id", serviceIds);
    services = data ?? [];
  }

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
          <Link href="/comercial">
            <ChevronLeft className="size-4" />
            Volver a Facturación
          </Link>
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Receipt className="text-primary size-6" aria-hidden />
            Movimiento · {clp.format(movement.amount)}
          </h1>
          <Badge variant={movement.status === "pagado" ? "success" : movement.status === "rechazado" ? "destructive" : "secondary"}>
            {STATUS_LABEL[movement.status]}
          </Badge>
        </div>
      </div>

      {sp.error === "eliminar" && (
        <Alert variant="destructive">
          <AlertDescription>No se pudo eliminar el movimiento.</AlertDescription>
        </Alert>
      )}

      {/* Avance rápido de estado */}
      {NEXT_STATUS[movement.status].length > 0 && (
        <div className="bg-card flex flex-wrap items-center gap-2 rounded-xl border p-3">
          <span className="text-muted-foreground text-sm">Avanzar estado:</span>
          {NEXT_STATUS[movement.status].map((n) => (
            <form key={n.to} action={setMovementStatus}>
              <input type="hidden" name="id" value={movement.id} />
              <input type="hidden" name="status" value={n.to} />
              <Button type="submit" size="sm" variant={n.to === "rechazado" ? "ghost" : "outline"}>
                {n.label}
              </Button>
            </form>
          ))}
        </div>
      )}

      <div className="bg-card rounded-xl border p-4">
        <MovementEditForm
          movement={movement}
          clients={(clients ?? []).map((c) => ({ id: c.id, name: c.name }))}
        />
      </div>

      {/* DTE asociados */}
      {(dtes ?? []).length > 0 && (
        <div className="bg-card rounded-xl border p-4">
          <h2 className="mb-2 font-semibold">Documentos tributarios (DTE)</h2>
          <ul className="divide-y text-sm">
            {(dtes ?? []).map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  {d.sii_type === 61 ? "Nota de crédito" : "Factura"} · Folio {d.folio ?? "—"} ·{" "}
                  <span className="text-muted-foreground">{d.status ?? ""}</span>
                </span>
                {d.pdf_path && (
                  <a
                    href={d.pdf_path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary text-xs underline"
                  >
                    Ver PDF
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* OTs enlazadas */}
      {services.length > 0 && (
        <div className="bg-card rounded-xl border p-4">
          <h2 className="mb-2 font-semibold">Órdenes de trabajo enlazadas</h2>
          <ul className="divide-y text-sm">
            {services.map((s) => (
              <li key={s.id} className="py-2">
                <Link href={`/ordenes/${s.id}`} className="text-primary hover:underline">
                  OT del {s.scheduled_at ? santiagoDate(s.scheduled_at) : "(sin fecha)"} →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t pt-3">
        <form action={deleteMovement}>
          <input type="hidden" name="id" value={movement.id} />
          <ConfirmSubmit
            variant="ghost"
            size="sm"
            className="text-destructive"
            message="¿Eliminar este movimiento? Sus enlaces a OTs y DTE también se eliminan. Esta acción no se puede deshacer."
          >
            Eliminar movimiento
          </ConfirmSubmit>
        </form>
      </div>
    </div>
  );
}
