import { requireEnabledProfile } from "@/lib/auth";
import { EnConstruccion } from "@/components/en-construccion";

export default async function PlantillasPage() {
  await requireEnabledProfile();
  return (
    <EnConstruccion
      titulo="Plantillas"
      fase="Fase 5"
      descripcion="Plantillas de correo globales y por cliente para envíos y recordatorios automáticos."
    />
  );
}
