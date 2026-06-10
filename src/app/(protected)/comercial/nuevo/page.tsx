import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { requireEnabledProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MovementForm } from "../movement-form";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function NuevoMovimientoPage() {
  await requireEnabledProfile();
  const supabase = await createClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .order("name", { ascending: true });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Button asChild variant="ghost" size="sm" className="w-fit -ml-2">
          <Link href="/comercial">
            <ChevronLeft className="size-4" />
            Volver a comercial
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo movimiento</h1>
      </div>

      <MovementForm clients={clients ?? []} />
    </div>
  );
}
