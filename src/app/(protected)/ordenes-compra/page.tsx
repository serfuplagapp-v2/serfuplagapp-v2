import { requireEnabledProfile } from "@/lib/auth";
import { EnConstruccion } from "@/components/en-construccion";

export default async function OrdenesCompraPage() {
  await requireEnabledProfile();
  return (
    <EnConstruccion
      titulo="Órdenes de Compra"
      fase="Fase 4"
      descripcion="Gestión de OC de clientes institucionales con estados derivados. Hoy la OC ya se puede anotar en cada contrato y movimiento."
      mientras={{ href: "/comercial", label: "Ir a Comercial" }}
    />
  );
}
