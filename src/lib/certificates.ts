import { createClient } from "@/lib/supabase/server";
import { buildCertificateView, productNamesFrom, type CertificateView } from "@/lib/cert-view";

// Re-export de los helpers puros: las páginas importan todo desde aquí.
export * from "@/lib/cert-view";

/**
 * Vista unificada de un certificado: TODOS los datos ya resueltos
 * (jsonb interpretado, productos enriquecidos del catálogo, config legal de la
 * empresa). La usan la hoja imprimible (/terreno/[id]) y el generador de PDF,
 * así ambas salidas muestran siempre lo mismo. Devuelve null si no existe
 * (o la RLS no deja verlo). `tenantId` viene de requireEnabledProfile.
 */
export async function getCertificateView(
  certId: string,
  tenantId: string,
): Promise<CertificateView | null> {
  const supabase = await createClient();

  const { data: cert } = await supabase
    .from("certificates")
    .select(
      "id, folio, service_id, client_id, branch_id, issued_at, service_date, data, pdf_path, verify_code, sent_at, sent_to",
    )
    .eq("id", certId)
    .maybeSingle();
  if (!cert) return null;

  const { data: settings } = await supabase
    .from("tenant_settings")
    .select("data")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const nombres = productNamesFrom(cert.data);
  let catalogo: Awaited<ReturnType<typeof fetchCatalog>> = [];
  if (nombres.length) catalogo = await fetchCatalog(nombres);

  return buildCertificateView(cert, settings?.data ?? {}, catalogo);
}

async function fetchCatalog(nombres: string[]) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("name, isp, formulacion, ingrediente_activo, concentracion, dosis")
    .in("name", nombres);
  return data ?? [];
}
