import Link from "next/link";
import { Hammer } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Pantalla estándar para módulos del menú v1 que aún no se portan a la v2.
 * Mantiene el mapa de navegación completo (paridad con la v1) sin engañar:
 * dice en qué fase llega y, si existe, hacia dónde ir mientras tanto.
 */
export function EnConstruccion({
  titulo,
  fase,
  descripcion,
  mientras,
}: {
  titulo: string;
  fase: string;
  descripcion: string;
  mientras?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="bg-secondary text-primary flex size-14 items-center justify-center rounded-full">
        <Hammer className="size-7" aria-hidden />
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{descripcion}</p>
        <p className="text-warning mt-2 text-sm font-medium">
          En construcción — llega en la {fase}.
        </p>
      </div>
      {mientras && (
        <Button asChild variant="outline">
          <Link href={mientras.href}>{mientras.label}</Link>
        </Button>
      )}
    </div>
  );
}
