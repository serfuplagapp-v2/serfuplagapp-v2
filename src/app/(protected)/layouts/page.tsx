import { requireEnabledProfile } from "@/lib/auth";
import { EnConstruccion } from "@/components/en-construccion";

export default async function LayoutsPage() {
  await requireEnabledProfile();
  return (
    <EnConstruccion
      titulo="Layouts"
      fase="Fase 3"
      descripcion="Editor visual de planos con estaciones (cebaderas, trampas, UV) y checklist por estación."
    />
  );
}
