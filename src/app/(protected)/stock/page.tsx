import { requireEnabledProfile } from "@/lib/auth";
import { EnConstruccion } from "@/components/en-construccion";

export default async function StockPage() {
  await requireEnabledProfile();
  return (
    <EnConstruccion
      titulo="Stock"
      fase="Fase 3"
      descripcion="Catálogo de productos (rodenticidas, insecticidas…) y su uso por servicio. Llega junto con Terreno."
    />
  );
}
