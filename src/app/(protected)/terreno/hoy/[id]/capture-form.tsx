"use client";

import { useActionState, useState, useTransition } from "react";
import { CheckCircle2, Loader2, MapPin, Save } from "lucide-react";

import { checkIn, saveVisit } from "./actions";
import { initialFormState } from "../../../clientes/form-state";
import { SignaturePad } from "@/components/signature-pad";
import { PhotoUpload, type FotoItem } from "@/components/photo-upload";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CaptureForm({
  serviceId,
  tenantId,
  checkinHora,
  data,
  pests,
  fotosIniciales,
  terminada,
}: {
  serviceId: string;
  tenantId: string;
  checkinHora: string | null;
  data: {
    trabajo_realizado: string;
    observaciones: string;
    recomendaciones: string;
    plagas_detectadas: string[];
    nombre_firmante: string;
    rut_firmante: string;
    firma_cliente_base64: string | null;
  };
  pests: string[];
  fotosIniciales: FotoItem[];
  terminada: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveVisit, initialFormState);
  const [firma, setFirma] = useState<string | null>(data.firma_cliente_base64);
  const [fotoPaths, setFotoPaths] = useState<string[]>(fotosIniciales.map((f) => f.path));
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [checking, startChecking] = useTransition();

  function doCheckIn() {
    startChecking(async () => {
      const coords = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 8000 },
        );
      });
      if (coords) setGps(coords);
      await checkIn(serviceId, coords?.lat ?? null, coords?.lng ?? null);
    });
  }

  // Pedir GPS al terminar (mejor esfuerzo, sin bloquear).
  function captureCheckoutGps(form: HTMLFormElement) {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => {
        (form.elements.namedItem("checkout_lat") as HTMLInputElement).value = String(p.coords.latitude);
        (form.elements.namedItem("checkout_lng") as HTMLInputElement).value = String(p.coords.longitude);
      },
      () => undefined,
      { timeout: 4000 },
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={(e) => captureCheckoutGps(e.currentTarget)}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="id" value={serviceId} />
      <input type="hidden" name="firma_base64" value={firma ?? ""} />
      <input type="hidden" name="fotos" value={JSON.stringify(fotoPaths)} />
      <input type="hidden" name="checkout_lat" defaultValue="" />
      <input type="hidden" name="checkout_lng" defaultValue="" />

      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {/* Check-in */}
      <div className="bg-card rounded-xl border p-3">
        {checkinHora ? (
          <p className="text-success flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 className="size-4" />
            Check-in hecho a las{" "}
            {new Intl.DateTimeFormat("es-CL", {
              timeZone: "America/Santiago",
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(checkinHora))}
            {gps ? " (con GPS)" : ""}
          </p>
        ) : (
          <Button type="button" onClick={doCheckIn} disabled={checking || terminada} className="w-full" size="lg">
            {checking ? <Loader2 className="size-5 animate-spin" /> : <MapPin className="size-5" />}
            Hacer check-in (llegué al lugar)
          </Button>
        )}
      </div>

      {/* Registro */}
      <div className="bg-card flex flex-col gap-3 rounded-xl border p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="trabajo_realizado">Trabajo realizado *</Label>
          <Textarea
            id="trabajo_realizado"
            name="trabajo_realizado"
            rows={3}
            defaultValue={data.trabajo_realizado}
            placeholder="Qué se hizo en la visita…"
            disabled={terminada}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Plagas encontradas</Label>
          <div className="flex flex-wrap gap-2">
            {pests.map((p) => (
              <label
                key={p}
                className="bg-secondary/60 has-checked:bg-primary has-checked:text-primary-foreground flex cursor-pointer items-center rounded-full border px-3 py-1.5 text-sm"
              >
                <input
                  type="checkbox"
                  name="plagas"
                  value={p}
                  defaultChecked={data.plagas_detectadas.includes(p)}
                  disabled={terminada}
                  className="sr-only"
                />
                {p}
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="observaciones">Observaciones</Label>
          <Textarea id="observaciones" name="observaciones" rows={2} defaultValue={data.observaciones} disabled={terminada} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="recomendaciones">Recomendaciones al cliente</Label>
          <Textarea id="recomendaciones" name="recomendaciones" rows={2} defaultValue={data.recomendaciones} disabled={terminada} />
        </div>
      </div>

      {/* Fotos */}
      <div className="bg-card rounded-xl border p-4">
        <Label className="mb-2 block">📷 Fotos de la visita</Label>
        <PhotoUpload
          tenantId={tenantId}
          serviceId={serviceId}
          initial={fotosIniciales}
          onChange={setFotoPaths}
        />
      </div>

      {/* Firma y firmante */}
      <div className="bg-card flex flex-col gap-3 rounded-xl border p-4">
        <Label className="block">✍️ Recibe el servicio</Label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input name="nombre_firmante" defaultValue={data.nombre_firmante} placeholder="Nombre de quien recibe *" disabled={terminada} />
          <Input name="rut_firmante" defaultValue={data.rut_firmante} placeholder="RUT (opcional)" disabled={terminada} />
        </div>
        {!terminada && <SignaturePad initial={data.firma_cliente_base64} onChange={setFirma} />}
        {terminada && data.firma_cliente_base64 && (
          // eslint-disable-next-line @next/next/no-img-element -- firma base64
          <img src={data.firma_cliente_base64} alt="Firma del cliente" className="h-24 w-fit rounded border bg-white" />
        )}
      </div>

      {/* Acciones */}
      {!terminada && (
        <div className="flex flex-col gap-2 pb-6 sm:flex-row">
          <Button type="submit" name="intent" value="guardar" variant="outline" disabled={pending} size="lg" className="flex-1">
            {pending ? <Loader2 className="size-5 animate-spin" /> : <Save className="size-5" />}
            Guardar avance
          </Button>
          <Button
            type="submit"
            name="intent"
            value="terminar"
            disabled={pending}
            size="lg"
            className="flex-1"
            onClick={(e) => {
              if (!window.confirm("¿Terminar la visita? Quedará 'por validar' para la oficina.")) e.preventDefault();
            }}
          >
            {pending ? <Loader2 className="size-5 animate-spin" /> : <CheckCircle2 className="size-5" />}
            Terminar visita
          </Button>
        </div>
      )}
    </form>
  );
}
