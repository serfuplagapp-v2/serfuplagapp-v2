import { requireEnabledProfile } from "@/lib/auth";
import { EnConstruccion } from "@/components/en-construccion";

export default async function TerrenoPage() {
  await requireEnabledProfile();
  return (
    <EnConstruccion
      titulo="Terreno"
      fase="Fase 3 (lo próximo en construirse)"
      descripcion="Registro del servicio en terreno: check-in, plagas, productos, fotos, firma del cliente y certificado con folio correlativo (continúa desde el 30.697 de la v1)."
      mientras={{ href: "/ordenes", label: "Ver las órdenes de trabajo" }}
    />
  );
}
