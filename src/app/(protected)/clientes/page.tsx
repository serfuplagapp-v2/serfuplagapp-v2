import Link from "next/link";
import { Plus, Search, Users } from "lucide-react";

import { requireEnabledProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ClientType } from "@/lib/supabase/types";
import { Badge } from "@/components/ui/badge";
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

const PAGE_SIZE = 25;

const TYPE_LABEL: Record<ClientType, string> = {
  residencial: "Residencial",
  empresa: "Empresa",
  institucional: "Institucional",
};

export default async function ClientesPage({
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
  let query = supabase
    .from("clients")
    .select("id, name, rut, type", { count: "exact" })
    .order("name", { ascending: true })
    .range(from, to);

  if (q) {
    // Quitamos caracteres que rompen la sintaxis de filtros de PostgREST.
    const safe = q.replace(/[,()%*]/g, " ").trim();
    if (safe) query = query.or(`name.ilike.%${safe}%,rut.ilike.%${safe}%`);
  }

  const { data: clients, count } = await query;
  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const hrefFor = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/clientes?${qs}` : "/clientes";
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Users className="text-primary size-6" aria-hidden />
            Clientes
          </h1>
          <p className="text-muted-foreground text-sm">
            {total} {total === 1 ? "cliente" : "clientes"} en total.
          </p>
        </div>
        <Button asChild>
          <Link href="/clientes/nuevo">
            <Plus className="size-4" />
            Nuevo cliente
          </Link>
        </Button>
      </div>

      <form method="get" className="flex max-w-md gap-2">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nombre o RUT…"
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="outline">
          Buscar
        </Button>
      </form>

      <div className="bg-card rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>RUT</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(clients ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground py-10 text-center">
                  {q
                    ? "No se encontraron clientes con esa búsqueda."
                    : "Aún no hay clientes. Crea el primero con “Nuevo cliente”."}
                </TableCell>
              </TableRow>
            ) : (
              (clients ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/clientes/${c.id}`}
                      className="hover:text-primary hover:underline"
                    >
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.rut ?? "—"}
                  </TableCell>
                  <TableCell>
                    {c.type ? (
                      <Badge variant="muted">{TYPE_LABEL[c.type]}</Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/clientes/${c.id}`}>Ver</Link>
                    </Button>
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
            <Button
              asChild
              variant="outline"
              size="sm"
              disabled={page <= 1}
            >
              <Link href={hrefFor(page - 1)}>Anterior</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              disabled={page >= pageCount}
            >
              <Link href={hrefFor(page + 1)}>Siguiente</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
