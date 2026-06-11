import Link from "next/link";
import { ClipboardList, Search } from "lucide-react";

import { requireEnabledProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addMonths, santiagoDate, santiagoLocalToISO, santiagoTime } from "@/lib/datetime";
import type { ServiceAgendaStatus, ServiceFieldStatus } from "@/lib/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50; // igual que la v1

type BadgeVariant = React.ComponentProps<typeof Badge>["variant"];

const AGENDA_BADGE: Record<ServiceAgendaStatus, { label: string; variant: BadgeVariant }> = {
  propuesto: { label: "Propuesto", variant: "muted" },
  programado: { label: "Programado", variant: "secondary" },
  enviado: { label: "Enviado", variant: "secondary" },
  confirmado: { label: "Confirmado", variant: "success" },
  reprogramado: { label: "Reprogramado", variant: "warning" },
  cancelado: { label: "Cancelado", variant: "destructive" },
};

// Pestañas de estado de terreno, con los colores de la v1.
const TABS: { k: ServiceFieldStatus | "todos"; l: string; c: string }[] = [
  { k: "todos", l: "Todas", c: "#555555" },
  { k: "planificada", l: "Planificadas", c: "#95a5a6" },
  { k: "asignada", l: "Asignadas", c: "#3498db" },
  { k: "en_proceso", l: "En proceso", c: "#e67e22" },
  { k: "por_validar", l: "Por validar", c: "#9b59b6" },
  { k: "terminada", l: "Terminadas", c: "#1e6b3a" },
];

const FIELD_VALUES: ServiceFieldStatus[] = [
  "planificada",
  "asignada",
  "en_proceso",
  "por_validar",
  "terminada",
];
const AGENDA_VALUES = Object.keys(AGENDA_BADGE) as ServiceAgendaStatus[];

interface OtRow {
  id: string;
  client_id: string;
  branch_id: string | null;
  service_type_id: string;
  scheduled_at: string | null;
  agenda_status: ServiceAgendaStatus;
  field_status: ServiceFieldStatus;
  folio: string | null;
}

export default async function OrdenesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    estado?: string;
    agenda?: string;
    mes?: string;
    tec?: string;
    page?: string;
  }>;
}) {
  await requireEnabledProfile();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const estado = FIELD_VALUES.includes(sp.estado as ServiceFieldStatus)
    ? (sp.estado as ServiceFieldStatus)
    : "todos";
  const agenda = AGENDA_VALUES.includes(sp.agenda as ServiceAgendaStatus)
    ? (sp.agenda as ServiceAgendaStatus)
    : "";
  const mes = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? (sp.mes as string) : "";
  const tec = (sp.tec ?? "").trim();
  const page = Math.max(1, Number(sp.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  // Búsqueda por cliente o RUT: primero los ids que calzan (acotado).
  let clientIdsFilter: string[] | null = null;
  if (q) {
    const safe = q.replace(/[,()%*]/g, " ").trim();
    if (safe) {
      const { data } = await supabase
        .from("clients")
        .select("id")
        .or(`name.ilike.%${safe}%,rut.ilike.%${safe}%`)
        .limit(100);
      clientIdsFilter = (data ?? []).map((c) => c.id);
      if (clientIdsFilter.length === 0) clientIdsFilter = ["00000000-0000-0000-0000-000000000000"];
    }
  }

  // Filtro por técnico: ids de sus servicios (acotado; ~cientos por técnico).
  let techServiceIds: string[] | null = null;
  if (tec) {
    const { data } = await supabase
      .from("service_technicians")
      .select("service_id")
      .eq("technician_id", tec)
      .limit(5000);
    techServiceIds = (data ?? []).map((p) => p.service_id);
    if (techServiceIds.length === 0) techServiceIds = ["00000000-0000-0000-0000-000000000000"];
  }

  const mesDesde = mes ? santiagoLocalToISO(`${mes}-01T00:00`) : null;
  const mesHasta = mes ? santiagoLocalToISO(`${addMonths(`${mes}-01`, 1)}T00:00`) : null;

  // Aplica los filtros comunes (todos menos el estado de terreno).
  // El tipo del builder de supabase-js es complejo; usamos un genérico mínimo.
  function applyCommon<T extends {
    in: (c: string, v: string[]) => T;
    eq: (c: string, v: string) => T;
    gte: (c: string, v: string) => T;
    lt: (c: string, v: string) => T;
  }>(qb: T): T {
    let x = qb;
    if (clientIdsFilter) x = x.in("client_id", clientIdsFilter);
    if (techServiceIds) x = x.in("id", techServiceIds);
    if (agenda) x = x.eq("agenda_status", agenda);
    if (mesDesde) x = x.gte("scheduled_at", mesDesde);
    if (mesHasta) x = x.lt("scheduled_at", mesHasta);
    return x;
  }

  // Lista de la página + contadores por pestaña, todo en paralelo.
  let listQuery = applyCommon(
    supabase
      .from("services")
      .select(
        "id, client_id, branch_id, service_type_id, scheduled_at, agenda_status, field_status, folio:legacy_data->>folio",
        { count: "exact" },
      ),
  );
  if (estado !== "todos") listQuery = listQuery.eq("field_status", estado);

  const countFor = (k: ServiceFieldStatus | "todos") => {
    let cq = applyCommon(
      supabase.from("services").select("id", { count: "exact", head: true }),
    );
    if (k !== "todos") cq = cq.eq("field_status", k);
    return cq;
  };

  const [listRes, ...countRes] = await Promise.all([
    listQuery.order("scheduled_at", { ascending: false, nullsFirst: false }).range(from, to),
    ...TABS.map((t) => countFor(t.k)),
  ]);

  // El selector JSON `folio:legacy_data->>folio` no se tipa solo; OtRow lo define.
  const services = (listRes.data ?? []) as unknown as OtRow[];
  const total = listRes.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const tabCounts = new Map(TABS.map((t, i) => [t.k, countRes[i]?.count ?? 0]));

  // Nombres SOLO de la página visible (rápido).
  const clientName = new Map<string, string>();
  const branchName = new Map<string, string>();
  const typeName = new Map<string, string>();
  const techsByService = new Map<string, string[]>();
  const clientIds = [...new Set(services.map((s) => s.client_id))];
  const branchIds = [...new Set(services.map((s) => s.branch_id).filter((x): x is string => !!x))];
  const typeIds = [...new Set(services.map((s) => s.service_type_id))];
  const serviceIds = services.map((s) => s.id);
  const [cRes, bRes, tRes, stRes, techRes] = await Promise.all([
    clientIds.length
      ? supabase.from("clients").select("id, name").in("id", clientIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    branchIds.length
      ? supabase.from("branches").select("id, name").in("id", branchIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    typeIds.length
      ? supabase.from("service_types").select("id, name").in("id", typeIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    serviceIds.length
      ? supabase
          .from("service_technicians")
          .select("service_id, technician_id")
          .in("service_id", serviceIds)
      : Promise.resolve({ data: [] as { service_id: string; technician_id: string }[] }),
    supabase.from("technicians").select("id, full_name").order("full_name").limit(200),
  ]);
  for (const c of cRes.data ?? []) clientName.set(c.id, c.name);
  for (const b of bRes.data ?? []) branchName.set(b.id, b.name);
  for (const t of tRes.data ?? []) typeName.set(t.id, t.name);
  const techList = techRes.data ?? [];
  const techName = new Map(techList.map((t) => [t.id, t.full_name]));
  for (const p of stRes.data ?? []) {
    const n = techName.get(p.technician_id);
    if (!n) continue;
    const arr = techsByService.get(p.service_id) ?? [];
    arr.push(n);
    techsByService.set(p.service_id, arr);
  }

  const hrefFor = (overrides: Record<string, string | number | null>) => {
    const params = new URLSearchParams();
    const cur: Record<string, string> = { q, estado, agenda, mes, tec, page: String(page) };
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null) delete cur[k];
      else cur[k] = String(v);
    }
    if (cur.q) params.set("q", cur.q);
    if (cur.estado && cur.estado !== "todos") params.set("estado", cur.estado);
    if (cur.agenda) params.set("agenda", cur.agenda);
    if (cur.mes) params.set("mes", cur.mes);
    if (cur.tec) params.set("tec", cur.tec);
    if (cur.page && cur.page !== "1") params.set("page", cur.page);
    const qs = params.toString();
    return qs ? `/ordenes?${qs}` : "/ordenes";
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <ClipboardList className="text-primary size-6" aria-hidden />
            Órdenes de trabajo
          </h1>
          <p className="text-muted-foreground text-sm">
            {total} {total === 1 ? "orden" : "órdenes"} · mostrando{" "}
            {total === 0 ? 0 : from + 1}–{Math.min(to + 1, total)}.
          </p>
        </div>
        <Button asChild>
          <Link href="/agenda/nuevo">Nueva orden</Link>
        </Button>
      </div>

      {/* Pestañas por estado de terreno (estilo v1: pills con contador) */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const isActive = estado === t.k;
          return (
            <Link
              key={t.k}
              href={hrefFor({ estado: t.k === "todos" ? null : t.k, page: null })}
              className="rounded-full border px-3 py-1 text-[13px] font-medium transition-colors"
              style={
                isActive
                  ? { background: t.c, borderColor: t.c, color: "#fff" }
                  : { borderColor: t.c, color: t.c }
              }
            >
              {t.l} ({tabCounts.get(t.k) ?? 0})
            </Link>
          );
        })}
      </div>

      <form method="get" className="flex flex-wrap items-center gap-2">
        {estado !== "todos" && <input type="hidden" name="estado" value={estado} />}
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input name="q" defaultValue={q} placeholder="Cliente o RUT…" className="w-48 pl-9" />
        </div>
        <Select name="agenda" defaultValue={agenda} className="w-auto">
          <option value="">Agenda: todas</option>
          {AGENDA_VALUES.map((v) => (
            <option key={v} value={v}>
              {AGENDA_BADGE[v].label}
            </option>
          ))}
        </Select>
        <Select name="tec" defaultValue={tec} className="w-auto">
          <option value="">Técnicos: todos</option>
          {techList.map((t) => (
            <option key={t.id} value={t.id}>
              {t.full_name}
            </option>
          ))}
        </Select>
        <Input name="mes" type="month" defaultValue={mes} className="w-auto" />
        <Button type="submit" variant="outline" size="sm">
          Filtrar
        </Button>
        {(q || agenda || mes || tec) && (
          <Button asChild variant="ghost" size="sm">
            <Link href="/ordenes">Limpiar</Link>
          </Button>
        )}
      </form>

      <div className="bg-card overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Folio</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Sucursal</TableHead>
              <TableHead>Servicio</TableHead>
              <TableHead>Técnicos</TableHead>
              <TableHead>Agenda</TableHead>
              <TableHead>Terreno</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground py-10 text-center">
                  No hay órdenes con este filtro.
                </TableCell>
              </TableRow>
            ) : (
              services.map((s) => {
                const fieldTab = TABS.find((t) => t.k === s.field_status);
                return (
                  <TableRow key={s.id}>
                    <TableCell className="text-muted-foreground whitespace-nowrap tabular-nums">
                      {s.folio ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {s.scheduled_at ? (
                        <>
                          <span className="font-medium">{santiagoDate(s.scheduled_at)}</span>{" "}
                          <span className="text-muted-foreground">{santiagoTime(s.scheduled_at)}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="max-w-52 truncate font-medium">
                      <Link
                        href={`/clientes/${s.client_id}`}
                        className="hover:text-primary hover:underline"
                      >
                        {clientName.get(s.client_id) ?? "Cliente"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-40 truncate">
                      {s.branch_id ? (branchName.get(s.branch_id) ?? "—") : "—"}
                    </TableCell>
                    <TableCell className="max-w-40 truncate">
                      <span className="rounded bg-[#e8eef5] px-1.5 py-0.5 text-xs font-medium text-[#1B3A6B]">
                        {typeName.get(s.service_type_id) ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-40 truncate">
                      {(techsByService.get(s.id) ?? []).join(", ") || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={AGENDA_BADGE[s.agenda_status].variant}>
                        {AGENDA_BADGE[s.agenda_status].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                        style={{ background: fieldTab?.c ?? "#555" }}
                      >
                        {fieldTab?.l.replace(/s$/, "") ?? s.field_status}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Página {page} de {pageCount}
          </p>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" disabled={page <= 1}>
              <Link href={hrefFor({ page: page - 1 })}>Anterior</Link>
            </Button>
            <Button asChild variant="outline" size="sm" disabled={page >= pageCount}>
              <Link href={hrefFor({ page: page + 1 })}>Siguiente</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
