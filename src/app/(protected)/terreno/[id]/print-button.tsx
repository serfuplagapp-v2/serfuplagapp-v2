"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Imprime la página (el usuario elige "Guardar como PDF" en el diálogo). */
export function PrintButton() {
  return (
    <Button type="button" onClick={() => window.print()}>
      <Printer className="size-4" />
      Imprimir / Guardar PDF
    </Button>
  );
}
