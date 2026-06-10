import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { requireEnabledProfile } from "@/lib/auth";
import { createClient } from "../actions";
import { ClientForm } from "../client-form";
import { Button } from "@/components/ui/button";

export default async function NuevoClientePage() {
  await requireEnabledProfile();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Button asChild variant="ghost" size="sm" className="w-fit -ml-2">
          <Link href="/clientes">
            <ChevronLeft className="size-4" />
            Volver a clientes
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo cliente</h1>
      </div>

      <ClientForm action={createClient} submitLabel="Crear cliente" />
    </div>
  );
}
