"use client";

import { useActionState, useId } from "react";
import { Loader2, Plus, Save } from "lucide-react";

import { initialFormState, type FormState } from "./form-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

function Check({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="size-4 accent-[var(--color-primary)]"
      />
      {label}
    </label>
  );
}

interface ContactDefaults {
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  branch_id: string | null;
  es_destinatario: boolean;
  es_cc: boolean;
  recibe_whatsapp: boolean;
}

/** Crea o edita un contacto (con defaultValues pasa a modo edición). */
export function ContactForm({
  action,
  branches,
  defaultValues,
}: {
  action: Action;
  branches: { id: string; name: string }[];
  defaultValues?: ContactDefaults;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const uid = useId();
  const editing = Boolean(defaultValues);

  return (
    <form
      action={formAction}
      className="bg-muted/40 flex flex-col gap-3 rounded-lg border p-4"
    >
      {!editing && <p className="text-sm font-medium">Agregar contacto</p>}
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
            placeholder="Nombre y apellido"
            defaultValue={defaultValues?.name}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${uid}-role`}>Cargo</Label>
          <Input
            id={`${uid}-role`}
            name="role"
            placeholder="Ej: Administrador, Conserje"
            defaultValue={defaultValues?.role ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${uid}-phone`}>Teléfono</Label>
          <Input
            id={`${uid}-phone`}
            name="phone"
            placeholder="+56 9 ..."
            defaultValue={defaultValues?.phone ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${uid}-email`}>Correo</Label>
          <Input
            id={`${uid}-email`}
            name="email"
            type="email"
            placeholder="correo@cliente.cl"
            defaultValue={defaultValues?.email ?? ""}
          />
        </div>
        {branches.length > 0 && (
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor={`${uid}-branch`}>Sucursal (opcional)</Label>
            <Select
              id={`${uid}-branch`}
              name="branch_id"
              defaultValue={defaultValues?.branch_id ?? ""}
            >
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
        <Check
          name="es_destinatario"
          label="Destinatario de correo"
          defaultChecked={defaultValues?.es_destinatario}
        />
        <Check name="es_cc" label="Con copia (CC)" defaultChecked={defaultValues?.es_cc} />
        <Check
          name="recibe_whatsapp"
          label="Recibe WhatsApp"
          defaultChecked={defaultValues?.recibe_whatsapp}
        />
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
          {editing ? "Guardar cambios" : "Agregar contacto"}
        </Button>
      </div>
    </form>
  );
}
