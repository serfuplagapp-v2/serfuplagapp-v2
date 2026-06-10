import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { requireEnabledProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todaySantiago } from "@/lib/datetime";
import { ServiceForm } from "../service-form";
import { Button } from "@/components/ui/button";

export default async function NuevoServicioPage() {
  await requireEnabledProfile();
  const supabase = await createClient();

  const [clientsRes, typesRes, techsRes] = await Promise.all([
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("service_types").select("id, name").eq("active", true).order("name"),
    supabase.from("technicians").select("id, full_name").eq("active", true).order("full_name"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
          <Link href="/agenda">
            <ChevronLeft className="size-4" />
            Volver a la agenda
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo servicio</h1>
      </div>

      <ServiceForm
        clients={(clientsRes.data ?? []).map((c) => ({ id: c.id, name: c.name }))}
        serviceTypes={(typesRes.data ?? []).map((t) => ({ id: t.id, name: t.name }))}
        technicians={(techsRes.data ?? []).map((t) => ({ id: t.id, name: t.full_name }))}
        defaultDate={`${todaySantiago()}T09:00`}
      />
    </div>
  );
}
