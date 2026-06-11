"use client";

import { useActionState, useRef, useEffect } from "react";
import { Loader2, Plus } from "lucide-react";

import { createTask } from "./actions";
import { initialFormState } from "../clientes/form-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Option = { id: string; name: string };

export function TaskForm({ clients }: { clients: Option[] }) {
  const [state, formAction, pending] = useActionState(createTask, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);

  // Limpia el formulario cuando la tarea se guardó bien.
  useEffect(() => {
    if (!pending && state.error === null) formRef.current?.reset();
  }, [pending, state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="bg-card flex flex-col gap-3 rounded-xl border p-4"
    >
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">Nueva tarea *</Label>
          <Input id="title" name="title" required placeholder="Ej: Llamar a Globe por renovación…" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="due_date">Fecha</Label>
          <Input id="due_date" name="due_date" type="date" className="w-auto" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="priority">Prioridad</Label>
          <Select id="priority" name="priority" defaultValue="normal" className="w-auto">
            <option value="normal">Normal</option>
            <option value="alta">Importante</option>
          </Select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="client_id">Cliente relacionado (opcional)</Label>
          <Select id="client_id" name="client_id" defaultValue="">
            <option value="">Sin cliente</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="notes">Notas</Label>
          <Textarea id="notes" name="notes" rows={1} placeholder="Detalle opcional…" />
        </div>
      </div>
      <div>
        <Button type="submit" disabled={pending} size="sm">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Agregar tarea
        </Button>
      </div>
    </form>
  );
}
