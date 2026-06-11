"use client";

import { useActionState } from "react";
import { FileDown, FileText, Loader2, Mail } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { enviarCertificado, generarPdfCertificado } from "./actions";
import { initialCertState } from "./state";

interface Props {
  certId: string;
  /** URL firmada (1 h) del PDF guardado, o null si aún no se genera. */
  pdfUrl: string | null;
  /** Último envío ya formateado (fecha larga), o null. */
  sentAtLabel: string | null;
  sentTo: string | null;
  /** Correo sugerido (firmante del servicio o contacto destinatario del cliente). */
  defaultEmail: string;
  /** ¿Está configurado el proveedor de correo? (RESEND_API_KEY + EMAIL_FROM) */
  emailReady: boolean;
}

/** Controles de PDF y envío por correo (no se imprimen). */
export function SendCertificate({ certId, pdfUrl, sentAtLabel, sentTo, defaultEmail, emailReady }: Props) {
  const [genState, genAction, genPending] = useActionState(generarPdfCertificado, initialCertState);
  const [sendState, sendAction, sendPending] = useActionState(enviarCertificado, initialCertState);

  const error = sendState.error ?? genState.error;
  const ok = sendState.ok ?? genState.ok;

  return (
    <div className="no-print bg-card mx-auto flex w-full max-w-[210mm] flex-col gap-3 rounded-lg border p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <FileText className="text-primary size-4" aria-hidden />
        PDF y envío al cliente
      </p>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {!error && ok && (
        <Alert>
          <AlertDescription>{ok}</AlertDescription>
        </Alert>
      )}
      {!emailReady && (
        <Alert>
          <AlertDescription>
            El envío por correo aún no está configurado: falta crear la cuenta del proveedor
            (Resend) y cargar RESEND_API_KEY y EMAIL_FROM en Vercel. El PDF sí se puede
            generar y descargar.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {pdfUrl && (
          <Button asChild variant="outline" size="sm">
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
              <FileDown className="size-4" />
              Descargar PDF
            </a>
          </Button>
        )}
        <form action={genAction}>
          <input type="hidden" name="id" value={certId} />
          <Button type="submit" size="sm" variant={pdfUrl ? "ghost" : "outline"} disabled={genPending}>
            {genPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Generando…
              </>
            ) : pdfUrl ? (
              "Regenerar PDF"
            ) : (
              <>
                <FileDown className="size-4" /> Generar PDF
              </>
            )}
          </Button>
        </form>
      </div>

      <form action={sendAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={certId} />
        <div className="flex min-w-56 flex-1 flex-col gap-1.5">
          <Label htmlFor="cert-email">Correo del destinatario</Label>
          <Input
            id="cert-email"
            name="email"
            type="email"
            required
            defaultValue={defaultEmail}
            placeholder="nombre@empresa.cl"
          />
        </div>
        <Button type="submit" disabled={sendPending || !emailReady}>
          {sendPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Enviando…
            </>
          ) : (
            <>
              <Mail className="size-4" /> Enviar por correo
            </>
          )}
        </Button>
      </form>

      {sentAtLabel && sentTo && (
        <p className="text-muted-foreground text-xs">
          Último envío: a <span className="font-medium">{sentTo}</span> el {sentAtLabel}.
        </p>
      )}
    </div>
  );
}
