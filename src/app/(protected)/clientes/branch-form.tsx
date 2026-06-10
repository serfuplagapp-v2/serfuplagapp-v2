"use client";

import { useActionState } from "react";
import { Loader2, Plus } from "lucide-react";

import { initialFormState, type FormState } from "./form-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export function BranchForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <form
      action={formAction}
      className="bg-muted/40 flex flex-col gap-3 rounded-lg border p-4"
    >
      <p className="text-sm font-medium">Agregar sucursal</p>
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="branch_name">Nombre *</Label>
          <Input id="branch_name" name="name" placeholder="Ej: Sucursal Centro" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="branch_address">Dirección</Label>
          <Input id="branch_address" name="address" placeholder="Ej: Av. Principal 123, Temuco" />
        </div>
      </div>
      <div>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Agregar sucursal
        </Button>
      </div>
    </form>
  );
}
