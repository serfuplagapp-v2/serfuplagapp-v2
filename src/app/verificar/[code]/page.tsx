import type { Metadata } from "next";
import { ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { fechaLarga, vigenciaExpirada } from "@/lib/certificates";

/**
 * Verificación PÚBLICA de certificados (la abre el QR impreso en el PDF).
 * No requiere iniciar sesión: usa la función verify_certificate (SECURITY
 * DEFINER) que entrega SOLO los campos seguros de UN certificado por su
 * código aleatorio. Nadie puede listar ni adivinar certificados.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verificación de certificado — Serfuplagapp",
  robots: { index: false },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-2 last:border-b-0">
      <span className="text-muted-foreground shrink-0 text-xs tracking-wide uppercase">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}

export default async function VerificarPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  let cert: {
    folio: number;
    client_name: string | null;
    branch_name: string | null;
    service_date: string | null;
    issued_at: string | null;
    valid_until: string | null;
    tenant_name: string;
  } | null = null;

  if (UUID_RE.test(code)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("verify_certificate", { p_code: code });
    cert = data?.[0] ?? null;
  }

  // Vigencia: solo se evalúa si la fecha heredada se puede interpretar.
  const vencido = vigenciaExpirada(cert?.valid_until ?? null);

  return (
    <main className="bg-muted/40 flex min-h-screen flex-col items-center justify-center p-4">
      <div className="bg-card w-full max-w-md overflow-hidden rounded-xl border shadow-sm">
        <div className="bg-[#122850] px-6 py-4 text-white">
          <p className="text-base font-semibold">{cert?.tenant_name ?? "Serfuplagapp"}</p>
          <p className="text-xs opacity-80">Verificación de certificado</p>
        </div>

        {cert ? (
          <div className="flex flex-col gap-4 p-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="size-10 shrink-0 text-[#1E6B3A]" aria-hidden />
              <div>
                <p className="text-lg font-semibold text-[#1E6B3A]">Certificado auténtico</p>
                <p className="text-muted-foreground text-sm">
                  Este certificado fue emitido por {cert.tenant_name}.
                </p>
              </div>
            </div>

            {vencido && (
              <div className="flex items-start gap-2 rounded-lg border border-[#B85C00]/40 bg-[#B85C00]/10 p-3 text-sm text-[#B85C00]">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                <p>
                  La vigencia de este certificado terminó el {fechaLarga(cert.valid_until)}. El
                  documento es auténtico, pero ya no está vigente.
                </p>
              </div>
            )}

            <div>
              <Dato label="Folio" value={String(cert.folio)} />
              {cert.client_name && <Dato label="Cliente" value={cert.client_name} />}
              {cert.branch_name && <Dato label="Sucursal" value={cert.branch_name} />}
              <Dato label="Fecha del servicio" value={fechaLarga(cert.service_date)} />
              <Dato label="Emisión" value={fechaLarga(cert.issued_at)} />
              {cert.valid_until && <Dato label="Vigencia hasta" value={fechaLarga(cert.valid_until)} />}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-6">
            <div className="flex items-center gap-3">
              <ShieldX className="size-10 shrink-0 text-[#C0392B]" aria-hidden />
              <div>
                <p className="text-lg font-semibold text-[#C0392B]">Certificado no encontrado</p>
                <p className="text-muted-foreground text-sm">
                  El código consultado no corresponde a un certificado emitido en esta
                  plataforma. Si lo escaneaste desde un documento, contacta a la empresa
                  emisora para confirmar su validez.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      <p className="text-muted-foreground mt-4 text-xs">
        Serfuplagapp · verificación de certificados de control de plagas
      </p>
    </main>
  );
}
