"use client";

import { useActionState, useId } from "react";
import { Loader2, Plus, Save } from "lucide-react";

import { initialFormState, type FormState } from "./form-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

interface BranchDefaults {
  name: string;
  address: string | null;
}

/** Crea o edita una sucursal (con defaultValues pasa a modo edición). */
export function BranchForm({
  action,
  defaultValues,
}: {
  action: Action;
  defaultValues?: BranchDefaults;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const uid = useId();
  const editing = Boolean(defaultValues);

  return (
    <form
      action={formAction}
      className="bg-muted/40 flex flex-col gap-3 rounded-lg border p-4"
    >
      {!editing && <p className="text-sm font-medium">Agregar sucursal</p>}
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${uid}-name`}>Nombre *</Label>
          <Input
            id={`${uid}-name`}
            name="name"
            placeholder="Ej: Sucursal Centro"
            defaultValue={defaultValues?.name}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${uid}-address`}>Dirección</Label>
          <Input
            id={`${uid}-address`}
            name="address"
            placeholder="Ej: Av. Principal 123, Temuco"
            defaultValue={defaultValues?.address ?? ""}
          />
        </div>
      </div>
      <div>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : editing ? (
            <Save className="size-4" />
          ) : (
            <Plus className="size-4" />
          )}
          {editing ? "Guardar cambios" : "Agregar sucursal"}
        </Button>
      </div>
    </form>
  );
}
