import Link from "next/link";
import { Plus, Receipt, Search, TrendingUp } from "lucide-react";

import { requireEnabledProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { MovementType, MovementStatus } from "@/lib/supabase/types";
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

const PAGE_SIZE = 25;
const TYPES: MovementType[] = ["venta", "cotizacion", "nota_credito"];
const TYPE_LABEL: Record<MovementType, string> = {
  venta: "Venta",
  cotizacion: "Cotización",
  nota_credito: "Nota de crédito",
};
const STATUS_LABEL: Record<MovementStatus, string> = {
  cotizado: "Cotizado",
  aprobado: "Aprobado",
  facturado: "Facturado",
  pagado: "Pagado",
  rechazado: "Rechazado",
};

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const pad = (n: number) => String(n).padStart(2, "0");
function monthRange(mes: string): { from: string; to: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(mes);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]); // 1–12
  const to = mo === 12 ? `${y + 1}-01-01` : `${y}-${pad(mo + 1)}-01`;
  return { from: `${m[1]}-${m[2]}-01`, to };
}

export default async function ComercialPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; mes?: string; tipo?: string; page?: string }>;
}) {
  await requireEnabledProfile();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const mes = (sp.mes ?? "").trim();
  const tipo = TYPES.includes(sp.tipo as MovementType) ? (sp.tipo as MovementType) : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  // Rangos de mes para el dashboard (mes actual y anterior).
  const now = new Date();
  const cur = monthRange(`${now.getFullYear()}-${pad(now.getMonth() + 1)}`)!;
  const prevY = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const prevM = now.getMonth() === 0 ? 12 : now.getMonth();
  const prev = monthRange(`${prevY}-${pad(prevM)}`)!;

  const range = mes ? monthRange(mes) : null;
  const safeQ = q.replace(/[,()%*]/g, " ").trim();

  // Lista (paginada en servidor).
  let listQuery = supabase
    .from("movements")
    .select("id, date, type, status, amount, description, client_id, client_name_raw")
    .order("date", { ascending: false })
    .range(from, to);
  if (range) listQuery = listQuery.gte("date", range.from).lt("date", range.to);
  if (tipo) listQuery = listQuery.eq("type", tipo);
  if (safeQ)
    listQuery = listQuery.or(
      `description.ilike.%${safeQ}%,client_name_raw.ilike.%${safeQ}%`,
    );

  const rpc = (
    f: string | null,
    t: string | null,
    type: string | null,
    text: string | null,
  ) => supabase.rpc("movements_summary", { p_from: f, p_to: t, p_type: type, p_q: text });

  const [
    { data: movements },
    { data: clients },
    { data: filterTotalD },
    { data: ventasMesD },
    { data: ventasPrevD },
    { data: totalAllD },
  ] = await Promise.all([
    listQuery,
    supabase.from("clients").select("id, name"),
    rpc(range?.from ?? null, range?.to ?? null, tipo || null, safeQ || null),
    rpc(cur.from, cur.to, "venta", null),
    rpc(prev.from, prev.to, "venta", null),
    rpc(null, null, null, null),
  ]);

  const clientName = new Map((clients ?? []).map((c) => [c.id, c.name]));
  const num = (d: { total: number; n: number }[] | null) => ({
    total: Number(d?.[0]?.total ?? 0),
    n: Number(d?.[0]?.n ?? 0),
  });
  const filterTotal = num(filterTotalD);
  const ventasMes = num(ventasMesD).total;
  const ventasPrev = num(ventasPrevD).total;
  const totalAll = num(totalAllD);
  const pageCount = Math.max(1, Math.ceil(filterTotal.n / PAGE_SIZE));

  const variacion =
    ventasPrev > 0 ? Math.round(((ventasMes - ventasPrev) / ventasPrev) * 100) : null;

  const hrefFor = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (mes) params.set("mes", mes);
    if (tipo) params.set("tipo", tipo);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/comercial?${qs}` : "/comercial";
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="modulo-sticky-top flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Receipt className="text-primary size-6" aria-hidden />
            Comercial
          </h1>
          <p className="text-muted-foreground text-sm">
            {totalAll.n} {totalAll.n === 1 ? "movimiento" : "movimientos"} registrados.
          </p>
        </div>
        <Button asChild>
          <Link href="/comercial/nuevo">
            <Plus className="size-4" />
            Nuevo movimiento
          </Link>
        </Button>
      </div>

      {/* Dashboard */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="bg-card rounded-xl border p-4">
          <p className="text-muted-foreground text-xs">Ventas de este mes</p>
          <p className="mt-1 text-2xl font-semibold">{clp.format(ventasMes)}</p>
          {variacion !== null && (
            <p
              className={`mt-1 flex items-center gap-1 text-xs ${
                variacion >= 0 ? "text-[#1E6B3A]" : "text-[#C0392B]"
              }`}
            >
              <TrendingUp className="size-3" />
              {variacion >= 0 ? "+" : ""}
              {variacion}% vs. mes anterior
            </p>
          )}
        </div>
        <div className="bg-card rounded-xl border p-4">
          <p className="text-muted-foreground text-xs">Ventas mes anterior</p>
          <p className="mt-1 text-2xl font-semibold">{clp.format(ventasPrev)}</p>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <p className="text-muted-foreground text-xs">Total histórico (todo)</p>
          <p className="mt-1 text-2xl font-semibold">{clp.format(totalAll.total)}</p>
        </div>
      </div>

      {/* Filtros */}
      <form method="get" className="flex flex-wrap items-end gap-2">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Buscar glosa o cliente…"
            className="w-56 pl-9"
          />
        </div>
        <Input name="mes" type="month" defaultValue={mes} className="w-40" />
        <Select name="tipo" defaultValue={tipo} className="w-44">
          <option value="">Todos los tipos</option>
          <option value="venta">Ventas</option>
          <option value="cotizacion">Cotizaciones</option>
          <option value="nota_credito">Notas de crédito</option>
        </Select>
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
      </form>

      {/* Total del filtro */}
      <div className="text-muted-foreground flex justify-between text-sm">
        <span>
          {filterTotal.n} {filterTotal.n === 1 ? "movimiento" : "movimientos"} en el filtro
        </span>
        <span className="font-medium text-foreground">
          Total: {clp.format(filterTotal.total)}
        </span>
      </div>

      <div className="bg-card rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Glosa</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(movements ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground py-10 text-center">
                  {q || mes || tipo
                    ? "No hay movimientos con esos filtros."
                    : "Aún no hay movimientos. Registra el primero con “Nuevo movimiento”."}
                </TableCell>
              </TableRow>
            ) : (
              (movements ?? []).map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="whitespace-nowrap">
                    <Link href={`/comercial/${m.id}`} className="hover:text-primary hover:underline">
                      {m.date}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/comercial/${m.id}`} className="hover:text-primary hover:underline">
                      {m.client_id ? clientName.get(m.client_id) ?? "—" : m.client_name_raw ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate">
                    {m.description ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="muted">{TYPE_LABEL[m.type]}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {STATUS_LABEL[m.status]}
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${m.amount < 0 ? "text-[#C0392B]" : ""}`}
                  >
                    {clp.format(m.amount)}
                  </TableCell>
                </TableRow>
              ))
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
              <Link href={hrefFor(page - 1)}>Anterior</Link>
            </Button>
            <Button asChild variant="outline" size="sm" disabled={page >= pageCount}>
              <Link href={hrefFor(page + 1)}>Siguiente</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
