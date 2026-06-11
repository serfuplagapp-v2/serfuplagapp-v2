"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { createService } from "./actions";
import { initialFormState } from "../clientes/form-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Option = { id: string; name: string };

export function ServiceForm({
  clients,
  serviceTypes,
  technicians,
  defaultDate,
}: {
  clients: Option[];
  serviceTypes: Option[];
  technicians: Option[];
  defaultDate: string;
}) {
  const [state, formAction, pending] = useActionState(
    createService,
    initialFormState,
  );

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4">
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {clients.length === 0 && (
        <Alert>
          <AlertDescription>
            Primero crea al menos un cliente en la sección “Clientes”.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="client_id">Cliente *</Label>
        <Select id="client_id" name="client_id" defaultValue="" required>
          <option value="" disabled>
            Selecciona un cliente…
          </option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="service_type_id">Tipo de servicio *</Label>
          <Select id="service_type_id" name="service_type_id" defaultValue="" required>
            <option value="" disabled>
              Selecciona…
            </option>
            {serviceTypes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="scheduled_at">Fecha y hora *</Label>
          <Input
            id="scheduled_at"
            name="scheduled_at"
            type="datetime-local"
            defaultValue={defaultDate}
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="technician_id">Técnico</Label>
        <Select id="technician_id" name="technician_id" defaultValue="">
          <option value="">Sin asignar</option>
          {technicians.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">Notas</Label>
        <Textarea id="notes" name="notes" rows={2} placeholder="Indicaciones del servicio…" />
      </div>

      <div>
        <Button type="submit" disabled={pending || clients.length === 0}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Creando…
            </>
          ) : (
            "Crear servicio"
          )}
        </Button>
      </div>
    </form>
  );
}
