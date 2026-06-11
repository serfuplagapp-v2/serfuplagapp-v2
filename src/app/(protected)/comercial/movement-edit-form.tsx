"use client";

import { useActionState } from "react";
import { Loader2, Save } from "lucide-react";

import { updateMovement } from "./actions";
import { initialFormState } from "./form-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Movement } from "@/lib/supabase/types";

type Option = { id: string; name: string };

export function MovementEditForm({
  movement,
  clients,
}: {
  movement: Movement;
  clients: Option[];
}) {
  const [state, formAction, pending] = useActionState(updateMovement, initialFormState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={movement.id} />
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="date">Fecha *</Label>
          <Input id="date" name="date" type="date" defaultValue={movement.date} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="type">Tipo</Label>
          <Select id="type" name="type" defaultValue={movement.type}>
            <option value="venta">Venta</option>
            <option value="cotizacion">Cotización</option>
            <option value="nota_credito">Nota de crédito</option>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="amount">Monto (CLP) *</Label>
          <Input id="amount" name="amount" defaultValue={String(movement.amount)} required />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="client_id">Cliente</Label>
          <Select id="client_id" name="client_id" defaultValue={movement.client_id ?? ""}>
            <option value="">— Sin cliente enlazado —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          {movement.client_name_raw && !movement.client_id && (
            <p className="text-muted-foreground text-xs">
              Nombre original de la v1: <strong>{movement.client_name_raw}</strong>
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="status">Estado</Label>
          <Select id="status" name="status" defaultValue={movement.status}>
            <option value="cotizado">Cotizado</option>
            <option value="aprobado">Aprobado</option>
            <option value="facturado">Facturado</option>
            <option value="pagado">Pagado</option>
            <option value="rechazado">Rechazado</option>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="oc_number">N° Orden de Compra</Label>
          <Input id="oc_number" name="oc_number" defaultValue={movement.oc_number ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="dte_folio">Folio DTE (factura)</Label>
          <Input id="dte_folio" name="dte_folio" defaultValue={movement.dte_folio ?? ""} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Glosa</Label>
        <Textarea
          id="description"
          name="description"
          rows={2}
          defaultValue={movement.description ?? ""}
        />
      </div>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}
