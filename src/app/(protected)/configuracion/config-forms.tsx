"use client";

import { useActionState } from "react";
import { Loader2, Plus, Save } from "lucide-react";

import { updateTenant, createServiceType } from "./actions";
import { initialFormState } from "../clientes/form-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TenantForm({
  name,
  rut,
  canEdit,
}: {
  name: string;
  rut: string;
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateTenant, initialFormState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Razón social *</Label>
          <Input id="name" name="name" defaultValue={name} required disabled={!canEdit} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="rut">RUT</Label>
          <Input id="rut" name="rut" defaultValue={rut} placeholder="76818360-0" disabled={!canEdit} />
        </div>
      </div>
      {canEdit && (
        <div>
          <Button type="submit" disabled={pending} size="sm">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Guardar empresa
          </Button>
        </div>
      )}
    </form>
  );
}

export function ServiceTypeForm() {
  const [state, formAction, pending] = useActionState(createServiceType, initialFormState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <div className="flex gap-2">
        <Input name="name" placeholder="Nuevo tipo de servicio…" required className="max-w-xs" />
        <Button type="submit" disabled={pending} variant="outline" size="sm" className="h-9">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Agregar
        </Button>
      </div>
    </form>
  );
}
