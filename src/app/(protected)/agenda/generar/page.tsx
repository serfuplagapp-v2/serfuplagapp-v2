import Link from "next/link";
import { ChevronLeft, Sparkles, AlertTriangle } from "lucide-react";

import { requireEnabledProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addMonths, dayLabel, todaySantiago } from "@/lib/datetime";
import { computeProposals } from "@/lib/generator";
import { generateProposals } from "../actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

// La vista previa necesita datos frescos.
export const dynamic = "force-dynamic";

const MONTHS_ES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];
function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${MONTHS_ES[Number(m) - 1]} ${y}`;
}

export default async function GenerarPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; client?: string; error?: string }>;
}) {
  await requireEnabledProfile();
  const sp = await searchParams;

  const today = todaySantiago();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.from ?? "") ? (sp.from as string) : today;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(sp.to ?? "") ? (sp.to as string) : addMonths(today, 18);
  const clientId = (sp.client ?? "").trim() || null;

  const supabase = await createClient();
  const { data: clients } = await supabase.from("clients").select("id, name").order("name");

  const rangoValido = from <= to;
  const { proposals, contractsConsidered, contractsSinSucursal, truncated } = rangoValido
    ? await computeProposals(supabase, { from, to, clientId })
    : { proposals: [], contractsConsidered: 0, contractsSinSucursal: 0, truncated: false };

  // Resumen por mes.
  const byMonth = new Map<string, number>();
  for (const p of proposals) {
    const ym = p.date.slice(0, 7);
    byMonth.set(ym, (byMonth.get(ym) ?? 0) + 1);
  }
  const months = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
          <Link href="/agenda">
            <ChevronLeft className="size-4" />
            Volver a la agenda
          </Link>
        </Button>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Sparkles className="text-primary size-6" aria-hidden />
          Generar visitas
        </h1>
        <p className="text-muted-foreground text-sm">
          Calcula las visitas que faltan de cada contrato vigente en el rango elegido.
          Solo propone lo nuevo (no repite lo que ya está en la agenda). Después revisas y apruebas.
        </p>
      </div>

      {sp.error === "rango" && (
        <Alert variant="destructive">
          <AlertDescription>El rango de fechas no es válido. La fecha “desde” debe ser anterior a “hasta”.</AlertDescription>
        </Alert>
      )}

      {/* Filtros: re-renderiza la vista previa */}
      <form method="get" className="bg-card flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="from">Desde</Label>
          <Input id="from" name="from" type="date" defaultValue={from} className="w-auto" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="to">Hasta</Label>
          <Input id="to" name="to" type="date" defaultValue={to} className="w-auto" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="client">Cliente (opcional)</Label>
          <Select id="client" name="client" defaultValue={clientId ?? ""} className="w-auto min-w-56">
            <option value="">Todos los contratos vigentes</option>
            {(clients ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="outline">
          Ver propuestas
        </Button>
      </form>

      {/* Resultado */}
      {!rangoValido ? (
        <Alert variant="destructive">
          <AlertDescription>La fecha “desde” debe ser anterior a “hasta”.</AlertDescription>
        </Alert>
      ) : proposals.length === 0 ? (
        <Alert>
          <AlertTitle>No hay visitas nuevas que proponer</AlertTitle>
          <AlertDescription>
            En este rango los contratos vigentes ya tienen todas sus visitas en la agenda.
            Prueba extendiendo la fecha “hasta” (por ejemplo, más allá de mayo 2027) para
            generar las visitas siguientes. Se evaluaron {contractsConsidered} contratos.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="bg-card rounded-lg border p-4">
            <p className="text-3xl font-semibold">{proposals.length}</p>
            <p className="text-muted-foreground text-sm">
              visitas nuevas propuestas, del {dayLabel(from)} al {dayLabel(to)} ·{" "}
              {contractsConsidered} contratos evaluados.
            </p>
          </div>

          {truncated && (
            <Alert variant="warning">
              <AlertTitle className="flex items-center gap-2">
                <AlertTriangle className="size-4" /> El rango es muy grande
              </AlertTitle>
              <AlertDescription>
                Se alcanzó el tope de 5.000 visitas y quedaron contratos sin evaluar. Acorta el
                rango de fechas (o genera por partes); lo que ya generes no se duplica.
              </AlertDescription>
            </Alert>
          )}

          {contractsSinSucursal > 0 && (
            <Alert variant="warning">
              <AlertTitle className="flex items-center gap-2">
                <AlertTriangle className="size-4" /> {contractsSinSucursal}{" "}
                {contractsSinSucursal === 1 ? "contrato sin sucursal clara" : "contratos sin sucursal clara"}
              </AlertTitle>
              <AlertDescription>
                Esas visitas se crearán sin sucursal asignada; podrás asignarla después desde
                la ficha del cliente o la agenda. El resto queda con su sucursal correcta.
              </AlertDescription>
            </Alert>
          )}

          <div className="bg-card overflow-hidden rounded-lg border">
            <div className="border-b px-4 py-2 text-sm font-semibold">Visitas por mes</div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 p-4 sm:grid-cols-3 md:grid-cols-4">
              {months.map(([ym, n]) => (
                <div key={ym} className="flex items-center justify-between gap-2 text-sm">
                  <span className="capitalize">{monthLabel(ym)}</span>
                  <span className="text-muted-foreground font-medium">{n}</span>
                </div>
              ))}
            </div>
          </div>

          <form action={generateProposals} className="flex items-center gap-3">
            <input type="hidden" name="from" value={from} />
            <input type="hidden" name="to" value={to} />
            <input type="hidden" name="client_id" value={clientId ?? ""} />
            <Button type="submit">
              <Sparkles className="size-4" />
              Generar {proposals.length} propuestas
            </Button>
            <span className="text-muted-foreground text-xs">
              Se crearán como “propuesto”. Nada se confirma hasta que las apruebes.
            </span>
          </form>
        </div>
      )}
    </div>
  );
}
