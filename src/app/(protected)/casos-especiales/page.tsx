import { requireEnabledProfile } from "@/lib/auth";
import { EnConstruccion } from "@/components/en-construccion";

export default async function CasosEspecialesPage() {
  await requireEnabledProfile();
  return (
    <EnConstruccion
      titulo="Casos Especiales"
      fase="Fase 3"
      descripcion="Seguimiento de casos SLIP y situaciones fuera del programa regular."
    />
  );
}
