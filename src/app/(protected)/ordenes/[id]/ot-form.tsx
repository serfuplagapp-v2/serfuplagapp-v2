"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Loader2, Plus, Save, Trash2 } from "lucide-react";

import { saveOrden } from "./actions";
import { initialFormState } from "../../clientes/form-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// Valores exactos de la v1 (modulos/ordenes/detalle.js).
const TIPO_VISITA = [
  ["servicio_calendarizado", "Servicio calendarizado"],
  ["servicio_adicional", "Adicional"],
  ["visita_tecnica", "Visita técnica"],
  ["emergencia", "Emergencia"],
  ["auditoria", "Auditoría"],
  ["inspeccion", "Inspección"],
  ["seguimiento", "Seguimiento"],
] as const;

const GRADOS = [
  ["sin_evidencia", "Sin evidencia"],
  ["bajo", "Bajo"],
  ["medio", "Medio"],
  ["alto", "Alto"],
] as const;

const VIGENCIAS = [30, 60, 90, 180, 365];

export interface ProductoUsado {
  nombre: string;
  cantidad: string;
  unidad: string;
}

export interface OtFormData {
  tipo_visita: string;
  metodologia: string;
  grado_infestacion: string;
  insumos: string;
  areas_tratadas: string;
  plagas_detectadas: string[];
  productos_usados: ProductoUsado[];
  trabajo_realizado: string;
  observaciones: string;
  recomendaciones: string;
  nombre_firmante: string;
  rut_firmante: string;
  correo_firmante: string;
  vigencia_dias: number;
}

export function OtForm({
  serviceId,
  scheduledLocal,
  technicianId,
  notes,
  terminada,
  data,
  technicians,
  pests,
  productCatalog,
}: {
  serviceId: string;
  scheduledLocal: string; // "YYYY-MM-DDTHH:mm" hora Chile
  technicianId: string;
  notes: string;
  terminada: boolean;
  data: OtFormData;
  technicians: { id: string; name: string }[];
  pests: string[];
  productCatalog: { name: string; unidad: string | null }[];
}) {
  const [state, formAction, pending] = useActionState(saveOrden, initialFormState);
  const [productos, setProductos] = useState<ProductoUsado[]>(data.productos_usados);

  const setProd = (i: number, patch: Partial<ProductoUsado>) =>
    setProductos((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={serviceId} />
      <input type="hidden" name="productos_usados" value={JSON.stringify(productos)} />

      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {/* Datos generales */}
      <section className="bg-card rounded-xl border p-4">
        <h2 className="mb-3 font-semibold">📋 Datos generales</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="scheduled_at">Fecha programada</Label>
            <Input
              id="scheduled_at"
              name="scheduled_at"
              type="datetime-local"
              defaultValue={scheduledLocal}
              disabled={terminada}
              title={terminada ? "OT cerrada — fecha bloqueada" : undefined}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="technician_id">Técnico</Label>
            <Select id="technician_id" name="technician_id" defaultValue={technicianId} disabled={terminada}>
              <option value="">Sin asignar</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tipo_visita">Tipo de visita</Label>
            <Select id="tipo_visita" name="tipo_visita" defaultValue={data.tipo_visita}>
              {TIPO_VISITA.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="metodologia">Metodología</Label>
            <Input id="metodologia" name="metodologia" defaultValue={data.metodologia} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="grado_infestacion">Grado de infestación</Label>
            <Select id="grado_infestacion" name="grado_infestacion" defaultValue={data.grado_infestacion}>
              {GRADOS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="insumos">Insumos utilizados</Label>
            <Input id="insumos" name="insumos" defaultValue={data.insumos} />
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-1.5">
          <Label htmlFor="areas_tratadas">Áreas tratadas</Label>
          <Textarea id="areas_tratadas" name="areas_tratadas" rows={2} defaultValue={data.areas_tratadas} />
        </div>
        <div className="mt-3 flex flex-col gap-1.5">
          <Label>Plagas controladas</Label>
          <div className="flex flex-wrap gap-2">
            {pests.map((p) => (
              <label
                key={p}
                className="bg-secondary/60 has-checked:bg-primary has-checked:text-primary-foreground flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm"
              >
                <input
                  type="checkbox"
                  name="plagas"
                  value={p}
                  defaultChecked={data.plagas_detectadas.includes(p)}
                  className="sr-only"
                />
                {p}
              </label>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-1.5">
          <Label htmlFor="notes">Instrucciones al técnico (no salen en el certificado)</Label>
          <Textarea id="notes" name="notes" rows={2} defaultValue={notes} />
        </div>
      </section>

      {/* Productos usados */}
      <section className="bg-card rounded-xl border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">🧪 Productos usados</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setProductos((r) => [...r, { nombre: "", cantidad: "", unidad: "" }])}
          >
            <Plus className="size-4" />
            Agregar
          </Button>
        </div>
        {productos.length === 0 ? (
          <p className="text-muted-foreground text-sm">Sin productos registrados.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {productos.map((p, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Select
                  value={p.nombre}
                  onChange={(e) => {
                    const cat = productCatalog.find((c) => c.name === e.target.value);
                    setProd(i, { nombre: e.target.value, unidad: p.unidad || cat?.unidad || "" });
                  }}
                  className="min-w-56 flex-1"
                  aria-label="Producto"
                >
                  <option value="">Selecciona producto…</option>
                  {productCatalog.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                  {p.nombre && !productCatalog.some((c) => c.name === p.nombre) && (
                    <option value={p.nombre}>{p.nombre}</option>
                  )}
                </Select>
                <Input
                  value={p.cantidad}
                  onChange={(e) => setProd(i, { cantidad: e.target.value })}
                  placeholder="Cantidad"
                  className="w-24"
                  aria-label="Cantidad"
                />
                <Input
                  value={p.unidad}
                  onChange={(e) => setProd(i, { unidad: e.target.value })}
                  placeholder="Unidad"
                  className="w-24"
                  aria-label="Unidad"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive size-8 p-0"
                  onClick={() => setProductos((rows) => rows.filter((_, j) => j !== i))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Registros del técnico */}
      <section className="bg-card rounded-xl border p-4">
        <h2 className="mb-3 font-semibold">📝 Registro del servicio</h2>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="trabajo_realizado">Trabajo realizado</Label>
            <Textarea id="trabajo_realizado" name="trabajo_realizado" rows={3} defaultValue={data.trabajo_realizado} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="observaciones">Observaciones (salen en el certificado)</Label>
            <Textarea id="observaciones" name="observaciones" rows={2} defaultValue={data.observaciones} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="recomendaciones">Recomendaciones (salen en el certificado)</Label>
            <Textarea id="recomendaciones" name="recomendaciones" rows={2} defaultValue={data.recomendaciones} />
          </div>
        </div>
      </section>

      {/* Firmante y vigencia */}
      <section className="bg-card rounded-xl border p-4">
        <h2 className="mb-3 font-semibold">✍️ Recibe el servicio y vigencia</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nombre_firmante">Recibe (nombre)</Label>
            <Input id="nombre_firmante" name="nombre_firmante" defaultValue={data.nombre_firmante} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rut_firmante">RUT</Label>
            <Input id="rut_firmante" name="rut_firmante" defaultValue={data.rut_firmante} placeholder="12345678-9" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="correo_firmante">Correo</Label>
            <Input id="correo_firmante" name="correo_firmante" type="email" defaultValue={data.correo_firmante} />
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-1.5">
          <Label htmlFor="vigencia_dias">Vigencia del certificado</Label>
          <Select id="vigencia_dias" name="vigencia_dias" defaultValue={String(data.vigencia_dias)} className="w-44">
            {VIGENCIAS.map((d) => (
              <option key={d} value={d}>
                {d} días
              </option>
            ))}
          </Select>
        </div>
      </section>

      {/* Acciones */}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" name="intent" value="guardar" disabled={pending} variant="outline">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Guardar cambios
        </Button>
        {!terminada && (
          <Button
            type="submit"
            name="intent"
            value="cerrar"
            disabled={pending}
            onClick={(e) => {
              if (!window.confirm("¿Cerrar la OT y generar el certificado con el siguiente folio? Esta acción asigna folio correlativo.")) {
                e.preventDefault();
              }
            }}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Cerrar OT y generar certificado
          </Button>
        )}
      </div>
    </form>
  );
}
