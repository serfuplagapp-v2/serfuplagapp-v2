import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  ClipboardCheck,
  Home,
  MapPin,
  UserX,
} from "lucide-react";

import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  addDays,
  santiagoDate,
  santiagoTime,
  santiagoLocalToISO,
  todaySantiago,
} from "@/lib/datetime";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

interface Item {
  id: string;
  fecha: string | null;
  texto: string;
  sub: string;
}

function Tarjeta({
  icon: Icon,
  titulo,
  count,
  tone,
  href,
  cta,
  items,
  vacio,
}: {
  icon: React.ComponentType<{ className?: string }>;
  titulo: string;
  count: number;
  tone: "warning" | "destructive" | "primary";
  href: string;
  cta: string;
  items: Item[];
  vacio: string;
}) {
  const toneClass =
    tone === "destructive"
      ? "text-destructive"
      : tone === "warning"
        ? "text-warning"
        : "text-primary";
  return (
    <div className="bg-card flex flex-col rounded-xl border">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon className={`size-5 ${toneClass}`} aria-hidden />
          <h2 className="font-semibold">{titulo}</h2>
        </div>
        <span className={`text-2xl font-semibold ${count > 0 ? toneClass : "text-muted-foreground/50"}`}>
          {count}
        </span>
      </div>
      <div className="flex-1 px-4 py-2">
        {items.length === 0 ? (
          <p className="text-muted-foreground/70 py-4 text-center text-sm">{vacio}</p>
        ) : (
          <ul className="divide-y">
            {items.map((it) => (
              <li key={it.id} className="flex items-baseline gap-2 py-2 text-sm">
                {it.fecha && (
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{it.fecha}</span>
                )}
                <span className="min-w-0">
                  <span className="block truncate font-medium">{it.texto}</span>
                  <span className="text-muted-foreground block truncate text-xs">{it.sub}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {count > 0 && (
        <div className="border-t px-4 py-2">
          <Button asChild variant="ghost" size="sm" className="text-primary w-full">
            <Link href={href}>{cta} →</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

const LIST_LIMIT = 6;

export default async function PanelPage() {
  // OJO: /panel NO usa requireEnabledProfile (evita un bucle de redirect para
  // cuentas sin habilitar; el layout protegido ya cubre ese caso).
  const { profile } = await getSessionProfile();
  if (!profile?.tenant_id) {
    return null; // el layout muestra "cuenta no habilitada"
  }
  const supabase = await createClient();

  const hoy = todaySantiago();
  const ahoraISO = new Date().toISOString();
  const en7ISO = santiagoLocalToISO(`${addDays(hoy, 7)}T23:59`) ?? ahoraISO;

  // Todas las consultas en paralelo; conteos en el servidor, listas acotadas.
  const [
    propuestasC,
    propuestas,
    porValidarC,
    porValidar,
    atrasadasC,
    atrasadas,
    proximas,
    sinCoordsC,
    sinCoords,
  ] = await Promise.all([
    supabase.from("services").select("id", { count: "exact", head: true }).eq("agenda_status", "propuesto"),
    supabase
      .from("services")
      .select("id, client_id, scheduled_at")
      .eq("agenda_status", "propuesto")
      .order("scheduled_at")
      .limit(LIST_LIMIT),
    supabase.from("services").select("id", { count: "exact", head: true }).eq("field_status", "por_validar"),
    supabase
      .from("services")
      .select("id, client_id, scheduled_at")
      .eq("field_status", "por_validar")
      .order("scheduled_at", { ascending: false })
      .limit(LIST_LIMIT),
    supabase
      .from("services")
      .select("id", { count: "exact", head: true })
      .lt("scheduled_at", ahoraISO)
      .not("field_status", "in", "(terminada)")
      .not("agenda_status", "in", "(cancelado,propuesto)"),
    supabase
      .from("services")
      .select("id, client_id, scheduled_at")
      .lt("scheduled_at", ahoraISO)
      .not("field_status", "in", "(terminada)")
      .not("agenda_status", "in", "(cancelado,propuesto)")
      .order("scheduled_at", { ascending: false })
      .limit(LIST_LIMIT),
    supabase
      .from("services")
      .select("id, client_id, scheduled_at")
      .gte("scheduled_at", ahoraISO)
      .lte("scheduled_at", en7ISO)
      .not("agenda_status", "in", "(cancelado,propuesto)")
      .order("scheduled_at")
      .limit(400),
    supabase.from("branches").select("id", { count: "exact", head: true }).is("lat", null),
    supabase.from("branches").select("id, name, client_id").is("lat", null).limit(LIST_LIMIT),
  ]);

  // Próximos 7 días SIN técnico asignado.
  const proximasList = proximas.data ?? [];
  const proxIds = proximasList.map((s) => s.id);
  let sinTecnico: typeof proximasList = [];
  if (proxIds.length > 0) {
    const { data: pairs } = await supabase
      .from("service_technicians")
      .select("service_id")
      .in("service_id", proxIds);
    const asignados = new Set((pairs ?? []).map((p) => p.service_id));
    sinTecnico = proximasList.filter((s) => !asignados.has(s.id));
  }

  // Nombres de clientes de TODO lo listado (una sola consulta).
  const allClientIds = [
    ...new Set(
      [
        ...(propuestas.data ?? []),
        ...(porValidar.data ?? []),
        ...(atrasadas.data ?? []),
        ...sinTecnico.slice(0, LIST_LIMIT),
        ...(sinCoords.data ?? []),
      ].map((x) => x.client_id),
    ),
  ];
  const clientName = new Map<string, string>();
  if (allClientIds.length) {
    const { data } = await supabase.from("clients").select("id, name").in("id", allClientIds);
    for (const c of data ?? []) clientName.set(c.id, c.name);
  }

  const aItems = (rows: { id: string; client_id: string; scheduled_at: string | null }[]): Item[] =>
    rows.map((s) => ({
      id: s.id,
      fecha: s.scheduled_at ? santiagoDate(s.scheduled_at).slice(5) : null,
      texto: clientName.get(s.client_id) ?? "Cliente",
      sub: s.scheduled_at ? `a las ${santiagoTime(s.scheduled_at)}` : "",
    }));

  const totalAlertas =
    (propuestasC.count ?? 0) +
    (porValidarC.count ?? 0) +
    (atrasadasC.count ?? 0) +
    sinTecnico.length +
    (sinCoordsC.count ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Home className="text-primary size-6" aria-hidden />
          Inicio
        </h1>
        <p className="text-muted-foreground text-sm">
          {totalAlertas === 0
            ? "Operación al día. Nada requiere tu atención. 🎉"
            : `${totalAlertas} ${totalAlertas === 1 ? "cosa requiere" : "cosas requieren"} tu atención.`}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Tarjeta
          icon={ClipboardCheck}
          titulo="Propuestas por aprobar"
          count={propuestasC.count ?? 0}
          tone="primary"
          href="/agenda/propuestas"
          cta="Revisar propuestas"
          items={aItems(propuestas.data ?? [])}
          vacio="Sin propuestas pendientes."
        />
        <Tarjeta
          icon={AlertTriangle}
          titulo="Visitas atrasadas"
          count={atrasadasC.count ?? 0}
          tone="destructive"
          href="/ordenes"
          cta="Ver órdenes"
          items={aItems(atrasadas.data ?? [])}
          vacio="Sin visitas atrasadas."
        />
        <Tarjeta
          icon={UserX}
          titulo="Próximos 7 días sin técnico"
          count={sinTecnico.length}
          tone="warning"
          href="/agenda"
          cta="Asignar en la agenda"
          items={aItems(sinTecnico.slice(0, LIST_LIMIT))}
          vacio="Todas las visitas próximas tienen técnico."
        />
        <Tarjeta
          icon={CalendarClock}
          titulo="Por validar (terreno)"
          count={porValidarC.count ?? 0}
          tone="warning"
          href="/ordenes?estado=por_validar"
          cta="Ver por validar"
          items={aItems(porValidar.data ?? [])}
          vacio="Nada por validar."
        />
        <Tarjeta
          icon={MapPin}
          titulo="Sucursales sin ubicación"
          count={sinCoordsC.count ?? 0}
          tone="warning"
          href="/mapa"
          cta="Ver mapa"
          items={(sinCoords.data ?? []).map((b) => ({
            id: b.id,
            fecha: null,
            texto: b.name,
            sub: clientName.get(b.client_id) ?? "",
          }))}
          vacio="Todas las sucursales están ubicadas."
        />
      </div>
    </div>
  );
}
