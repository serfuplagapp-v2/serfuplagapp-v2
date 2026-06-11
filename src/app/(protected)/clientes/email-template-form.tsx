"use client";

import { useActionState } from "react";
import { Loader2, Save } from "lucide-react";

import { initialFormState, type FormState } from "./form-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

interface TemplateDefaults {
  to_emails: string | null;
  cc_emails: string | null;
  subject: string | null;
  body: string | null;
}

/**
 * Plantilla de correo del cliente (réplica pestaña "Correo" v1): a quién se
 * envían los avisos/certificados de este cliente y con qué texto. Las
 * variables se reemplazan al enviar.
 */
export function EmailTemplateForm({
  action,
  defaultValues,
}: {
  action: Action;
  defaultValues: TemplateDefaults | null;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tpl_to">Destinatario(s)</Label>
          <Input
            id="tpl_to"
            name="to_emails"
            placeholder="correo@cliente.cl, otro@cliente.cl"
            defaultValue={defaultValues?.to_emails ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tpl_cc">Con copia (CC)</Label>
          <Input
            id="tpl_cc"
            name="cc_emails"
            placeholder="supervisor@cliente.cl"
            defaultValue={defaultValues?.cc_emails ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="tpl_subject">Asunto (opcional)</Label>
          <Input
            id="tpl_subject"
            name="subject"
            placeholder="Aviso de servicio — {servicios} — {cliente} · {fecha_servicio}"
            defaultValue={defaultValues?.subject ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="tpl_body">Cuerpo (opcional)</Label>
          <Textarea
            id="tpl_body"
            name="body"
            rows={5}
            placeholder={
              "Estimado/a {nombre_pila}:\n\nLe informamos que tiene programado un servicio de {servicios} para el {dia} {dia_numero} de {mes} de {anio}.\n..."
            }
            defaultValue={defaultValues?.body ?? ""}
          />
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        Variables disponibles: {"{cliente}"}, {"{nombre_pila}"}, {"{servicios}"},{" "}
        {"{fecha_servicio}"}, {"{dia}"}, {"{dia_numero}"}, {"{mes}"}, {"{anio}"},{" "}
        {"{hora_servicio}"}, {"{direccion}"}. Si dejas asunto/cuerpo vacíos se usa el texto
        estándar de la empresa.
      </p>
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Guardar plantilla
        </Button>
      </div>
    </form>
  );
}
