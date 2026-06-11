"use client";

import { useActionState } from "react";
import { Loader2, Plus } from "lucide-react";

import { createTechnician } from "./actions";
import { initialFormState } from "../clientes/form-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TechForm() {
  const [state, formAction, pending] = useActionState(createTechnician, initialFormState);

  return (
    <form action={formAction} className="bg-card flex flex-col gap-4 rounded-lg border p-4">
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="full_name">Nombre del técnico *</Label>
          <Input id="full_name" name="full_name" required placeholder="Ej: Juan Pérez" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="license_info">Licencia / certificación (opcional)</Label>
          <Input id="license_info" name="license_info" placeholder="Ej: Aplicador autorizado" />
        </div>
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Agregando…
            </>
          ) : (
            <>
              <Plus className="size-4" /> Agregar técnico
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
