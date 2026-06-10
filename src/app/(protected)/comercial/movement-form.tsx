"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { initialFormState, type FormState } from "./form-state";
import { createMovement } from "./actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type ClientOption = { id: string; name: string };

export function MovementForm({ clients }: { clients: ClientOption[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createMovement,
    initialFormState,
  );

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4">
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="client_id">Cliente</Label>
        <Select id="client_id" name="client_id" defaultValue="">
          <option value="">Sin cliente / varios</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="date">Fecha *</Label>
          <Input id="date" name="date" type="date" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="amount">Monto (CLP) *</Label>
          <Input
            id="amount"
            name="amount"
            inputMode="numeric"
            placeholder="Ej: 81964"
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="type">Tipo *</Label>
          <Select id="type" name="type" defaultValue="venta">
            <option value="venta">Venta</option>
            <option value="cotizacion">Cotización</option>
            <option value="nota_credito">Nota de crédito</option>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="status">Estado</Label>
          <Select id="status" name="status" defaultValue="cotizado">
            <option value="cotizado">Cotizado</option>
            <option value="aprobado">Aprobado (venta)</option>
            <option value="facturado">Facturado</option>
            <option value="pagado">Pagado</option>
            <option value="rechazado">Rechazado</option>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="oc_number">N° Orden de Compra (OC)</Label>
          <Input id="oc_number" name="oc_number" placeholder="Opcional" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Descripción / glosa</Label>
        <Textarea
          id="description"
          name="description"
          placeholder="Ej: Desratización mensual, Casino Recoleta…"
          rows={2}
        />
      </div>

      <p className="text-muted-foreground text-xs">
        Las notas de crédito se guardan automáticamente con monto negativo.
      </p>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Guardando…
            </>
          ) : (
            "Registrar movimiento"
          )}
        </Button>
      </div>
    </form>
  );
}
