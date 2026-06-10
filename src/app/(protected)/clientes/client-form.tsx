"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { initialFormState, type FormState } from "./form-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export function ClientForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: Action;
  defaultValues?: {
    name?: string | null;
    rut?: string | null;
    type?: string | null;
    notes?: string | null;
  };
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const d = defaultValues ?? {};

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4">
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nombre del cliente *</Label>
        <Input
          id="name"
          name="name"
          defaultValue={d.name ?? ""}
          placeholder="Ej: C.C.A.F. La Araucana"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="rut">RUT</Label>
          <Input
            id="rut"
            name="rut"
            defaultValue={d.rut ?? ""}
            placeholder="76818360-0"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="type">Tipo</Label>
          <Select id="type" name="type" defaultValue={d.type ?? ""}>
            <option value="">Sin especificar</option>
            <option value="residencial">Residencial</option>
            <option value="empresa">Empresa</option>
            <option value="institucional">Institucional</option>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">Notas</Label>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={d.notes ?? ""}
          placeholder="Información adicional del cliente…"
          rows={3}
        />
      </div>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Guardando…
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </div>
    </form>
  );
}
