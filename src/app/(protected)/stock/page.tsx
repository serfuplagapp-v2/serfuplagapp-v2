import { Bug, FileText, Package } from "lucide-react";

import { requireEnabledProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function StockPage() {
  await requireEnabledProfile();
  const supabase = await createClient();

  const [{ data: products }, { data: pests }, { data: texts }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, active, ingrediente_activo, isp, laboratorio, dosis, unidad, service_names")
      .order("name")
      .limit(500),
    supabase.from("pests").select("id, name, scientific_name, active").order("name").limit(200),
    supabase
      .from("predefined_texts")
      .select("id, kind, body, active")
      .order("kind")
      .order("sort_order")
      .limit(200),
  ]);

  const KIND_LABEL: Record<string, string> = {
    trabajo: "Trabajo realizado",
    observacion: "Observación",
    recomendacion: "Recomendación",
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Package className="text-primary size-6" aria-hidden />
          Stock · Catálogos
        </h1>
        <p className="text-muted-foreground text-sm">
          Productos, plagas y textos traídos de la v1 — alimentan los certificados (Fase 3).
          El control de inventario (entradas/salidas) llega más adelante.
        </p>
      </div>

      {/* Productos */}
      <section className="bg-card overflow-x-auto rounded-xl border">
        <h2 className="flex items-center gap-2 border-b px-4 py-2 font-semibold">
          <Package className="text-primary size-4" aria-hidden />
          Productos ({(products ?? []).length})
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Ingrediente activo</TableHead>
              <TableHead>Reg. ISP</TableHead>
              <TableHead>Laboratorio</TableHead>
              <TableHead>Dosis</TableHead>
              <TableHead>Servicios</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(products ?? []).map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-muted-foreground max-w-44 truncate">
                  {p.ingrediente_activo ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{p.isp ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{p.laboratorio ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground max-w-32 truncate">
                  {p.dosis ? `${p.dosis}${p.unidad ? ` ${p.unidad}` : ""}` : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground max-w-40 truncate">
                  {(p.service_names ?? []).join(", ") || "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={p.active ? "success" : "muted"}>
                    {p.active ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      {/* Plagas */}
      <section className="bg-card rounded-xl border">
        <h2 className="flex items-center gap-2 border-b px-4 py-2 font-semibold">
          <Bug className="text-primary size-4" aria-hidden />
          Plagas ({(pests ?? []).length})
        </h2>
        <div className="flex flex-wrap gap-2 p-4">
          {(pests ?? []).map((p) => (
            <span
              key={p.id}
              className={
                "rounded-full border px-3 py-1 text-sm " +
                (p.active ? "bg-secondary" : "text-muted-foreground/60 line-through")
              }
              title={p.scientific_name ?? undefined}
            >
              {p.name}
              {p.scientific_name && (
                <em className="text-muted-foreground ml-1 text-xs">({p.scientific_name})</em>
              )}
            </span>
          ))}
        </div>
      </section>

      {/* Textos predefinidos */}
      <section className="bg-card rounded-xl border">
        <h2 className="flex items-center gap-2 border-b px-4 py-2 font-semibold">
          <FileText className="text-primary size-4" aria-hidden />
          Textos predefinidos ({(texts ?? []).length})
        </h2>
        <ul className="divide-y">
          {(texts ?? []).map((t) => (
            <li key={t.id} className="flex items-start gap-3 px-4 py-2 text-sm">
              <Badge variant="muted" className="mt-0.5 shrink-0">
                {KIND_LABEL[t.kind] ?? t.kind}
              </Badge>
              <span className={t.active ? "" : "text-muted-foreground/60 line-through"}>{t.body}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
