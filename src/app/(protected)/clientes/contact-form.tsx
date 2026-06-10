"use client";

import { useActionState } from "react";
import { Loader2, Plus } from "lucide-react";

import { initialFormState, type FormState } from "./form-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

function Check({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        name={name}
        className="size-4 accent-[var(--color-primary)]"
      />
      {label}
    </label>
  );
}

export function ContactForm({
  action,
  branches,
}: {
  action: Action;
  branches: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <form
      action={formAction}
      className="bg-muted/40 flex flex-col gap-3 rounded-lg border p-4"
    >
      <p className="text-sm font-medium">Agregar contacto</p>
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contact_name">Nombre *</Label>
          <Input id="contact_name" name="name" placeholder="Nombre y apellido" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contact_role">Cargo</Label>
          <Input id="contact_role" name="role" placeholder="Ej: Administrador, Conserje" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contact_phone">Teléfono</Label>
          <Input id="contact_phone" name="phone" placeholder="+56 9 ..." />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contact_email">Correo</Label>
          <Input id="contact_email" name="email" type="email" placeholder="correo@cliente.cl" />
        </div>
        {branches.length > 0 && (
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="contact_branch">Sucursal (opcional)</Label>
            <Select id="contact_branch" name="branch_id" defaultValue="">
              <option value="">Contacto del cliente (sin sucursal)</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
        <Check name="es_destinatario" label="Destinatario de correo" />
        <Check name="es_cc" label="Con copia (CC)" />
        <Check name="recibe_whatsapp" label="Recibe WhatsApp" />
      </div>
      <div>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Agregar contacto
        </Button>
      </div>
    </form>
  );
}
