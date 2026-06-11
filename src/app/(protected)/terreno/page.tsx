import Link from "next/link";
import { Search, SprayCan } from "lucide-react";

import { requireEnabledProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { santiagoDate } from "@/lib/datetime";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function TerrenoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireEnabledProfile();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number(sp.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  // Búsqueda: por folio exacto o por nombre de cliente.
  let clientIdsFilter: string[] | null = null;
  const folioQ = /^\d{3,}$/.test(q) ? Number(q) : null;
  if (q && !folioQ) {
    const safe = q.replace(/[,()%*]/g, " ").trim();
    if (safe) {
      const { data } = await supabase.from("clients").select("id").ilike("name", `%${safe}%`).limit(100);
      clientIdsFilter = (data ?? []).map((c) => c.id);
      if (clientIdsFilter.length === 0) clientIdsFilter = ["00000000-0000-0000-0000-000000000000"];
    }
  }

  let query = supabase
    .from("certificates")
    .select("id, folio, client_id, branch_id, service_id, issued_at, service_date, data", { count: "exact" })
    .order("folio", { ascending: false })
    .range(from, to);
  if (folioQ) query = query.eq("folio", folioQ);
  if (clientIdsFilter) query = query.in("client_id", clientIdsFilter);

  const { data: certsRaw, count } = await query;
  const certs = certsRaw ?? [];
  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Nombres solo de la página visible.
  const clientName = new Map<string, string>();
  const branchName = new Map<string, string>();
  const clientIds = [...new Set(certs.map((c) => c.client_id).filter((x): x is string => !!x))];
  const branchIds = [...new Set(certs.map((c) => c.branch_id).filter((x): x is string => !!x))];
  if (clientIds.length) {
    const { data } = await supabase.from("clients").select("id, name").in("id", clientIds);
    for (const c of data ?? []) clientName.set(c.id, c.name);
  }
  if (branchIds.length) {
    const { data } = await supabase.from("branches").select("id, name").in("id", branchIds);
    for (const b of data ?? []) branchName.set(b.id, b.name);
  }

  const hrefFor = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/terreno?${qs}` : "/terreno";
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <SprayCan className="text-primary size-6" aria-hidden />
          Terreno · Certificados
        </h1>
        <p className="text-muted-foreground text-sm">
          {total} certificados emitidos (historia traída de la v1). El registro en terreno
          (check-in, firma, PDF) llega en la Fase 3 — los nuevos folios seguirán desde el correlativo.
        </p>
      </div>

      <form method="get" className="flex max-w-md gap-2">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input name="q" defaultValue={q} placeholder="Folio (ej: 30650) o cliente…" className="pl-9" />
        </div>
        <Button type="submit" variant="outline">
          Buscar
        </Button>
      </form>

      {total === 0 && q ? (
        <Alert>
          <AlertTitle>Sin resultados</AlertTitle>
          <AlertDescription>No hay certificados con esa búsqueda.</AlertDescription>
        </Alert>
      ) : (
        <div className="bg-card overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Folio</TableHead>
                <TableHead>Emisión</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Sucursal</TableHead>
                <TableHead>Servicios</TableHead>
                <TableHead>Técnico</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {certs.map((c) => {
                const d = (c.data ?? {}) as Record<string, unknown>;
                const servicios = Array.isArray(d.servicios) ? (d.servicios as string[]).join(", ") : "";
                const tecnico = typeof d.tecnico === "string" ? d.tecnico : "";
                const clienteRaw = typeof d.cliente_nombre === "string" ? d.cliente_nombre : "";
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-semibold tabular-nums">{c.folio}</TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {c.issued_at ? santiagoDate(c.issued_at) : "—"}
                    </TableCell>
                    <TableCell className="max-w-56 truncate font-medium">
                      {c.client_id ? (
                        <Link href={`/clientes/${c.client_id}`} className="hover:text-primary hover:underline">
                          {clientName.get(c.client_id) ?? clienteRaw}
                        </Link>
                      ) : (
                        clienteRaw || "—"
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-44 truncate">
                      {c.branch_id ? (branchName.get(c.branch_id) ?? "—") : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-40 truncate">{servicios || "—"}</TableCell>
                    <TableCell className="text-muted-foreground max-w-36 truncate">{tecnico || "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

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
