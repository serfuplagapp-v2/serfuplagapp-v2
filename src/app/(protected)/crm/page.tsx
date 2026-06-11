import { requireEnabledProfile } from "@/lib/auth";
import { EnConstruccion } from "@/components/en-construccion";

export default async function CrmPage() {
  await requireEnabledProfile();
  return (
    <EnConstruccion
      titulo="CRM"
      fase="Fase 5"
      descripcion="Pipeline de oportunidades, cotizaciones con folio, actividades y tickets. Las cotizaciones serán lo primero en llegar."
      mientras={{ href: "/comercial", label: "Registrar movimientos en Comercial" }}
    />
  );
}
