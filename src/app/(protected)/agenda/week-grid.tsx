"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { User, GripVertical } from "lucide-react";

import { rescheduleService, assignTechnician } from "./actions";
import type { ServiceAgendaStatus, ServiceFieldStatus } from "@/lib/supabase/types";
import { Badge } from "@/components/ui/badge";

type BadgeVariant = React.ComponentProps<typeof Badge>["variant"];

const AGENDA_BADGE: Record<ServiceAgendaStatus, { label: string; variant: BadgeVariant }> = {
  propuesto: { label: "Propuesto", variant: "muted" },
  programado: { label: "Programado", variant: "secondary" },
  enviado: { label: "Enviado", variant: "secondary" },
  confirmado: { label: "Confirmado", variant: "success" },
  reprogramado: { label: "Reprogramado", variant: "warning" },
  cancelado: { label: "Cancelado", variant: "destructive" },
};

const FIELD_BADGE: Record<ServiceFieldStatus, { label: string; variant: BadgeVariant }> = {
  planificada: { label: "Planificada", variant: "muted" },
  asignada: { label: "Asignada", variant: "secondary" },
  en_proceso: { label: "En proceso", variant: "warning" },
  por_validar: { label: "Por validar", variant: "warning" },
  terminada: { label: "Terminada", variant: "success" },
};

export interface DayCol {
  date: string; // YYYY-MM-DD
  label: string;
  isToday: boolean;
}

export interface Card {
  id: string;
  date: string;
  time: string;
  clientName: string;
  typeName: string;
  branchName: string | null;
  agendaStatus: ServiceAgendaStatus;
  fieldStatus: ServiceFieldStatus;
  technicianId: string | null;
}

export function WeekGrid({
  days,
  cards,
  technicians,
}: {
  days: DayCol[];
  cards: Card[];
  technicians: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overDate, setOverDate] = useState<string | null>(null);

  const byDay = new Map<string, Card[]>();
  for (const c of cards) {
    const arr = byDay.get(c.date) ?? [];
    arr.push(c);
    byDay.set(c.date, arr);
  }

  function onDrop(date: string) {
    const id = draggingId;
    setDraggingId(null);
    setOverDate(null);
    if (!id) return;
    const card = cards.find((c) => c.id === id);
    if (!card || card.date === date) return;
    startTransition(async () => {
      await rescheduleService(id, date);
      router.refresh();
    });
  }

  function onAssign(serviceId: string, technicianId: string) {
    startTransition(async () => {
      await assignTechnician(serviceId, technicianId || null);
      router.refresh();
    });
  }

  return (
    <div
      className={
        "grid gap-3 transition-opacity md:grid-cols-7 " + (pending ? "pointer-events-none opacity-60" : "")
      }
    >
      {days.map((day) => {
        const items = (byDay.get(day.date) ?? []).sort((a, b) => a.time.localeCompare(b.time));
        const isOver = overDate === day.date;
        return (
          <div
            key={day.date}
            onDragOver={(e) => {
              e.preventDefault();
              if (overDate !== day.date) setOverDate(day.date);
            }}
            onDragLeave={(e) => {
              // Solo limpiar si realmente salimos de la columna (relatedTarget
              // puede ser null al salir de la ventana).
              const next = e.relatedTarget as Node | null;
              if (!next || !e.currentTarget.contains(next)) {
                setOverDate((d) => (d === day.date ? null : d));
              }
            }}
            onDrop={() => onDrop(day.date)}
            className={
              "bg-card flex min-h-32 flex-col rounded-lg border " +
              (day.isToday ? "border-primary ring-primary/30 ring-1 " : "") +
              (isOver ? "border-primary bg-primary/5 ring-primary ring-2" : "")
            }
          >
            <div
              className={
                "rounded-t-lg border-b px-2 py-1.5 text-center text-xs font-semibold capitalize " +
                (day.isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground")
              }
            >
              {day.label}
            </div>
            <div className="flex flex-col gap-2 p-2">
              {items.length === 0 ? (
                <p className="text-muted-foreground/60 py-2 text-center text-xs">—</p>
              ) : (
                items.map((s) => (
                  <div
                    key={s.id}
                    draggable
                    onDragStart={() => setDraggingId(s.id)}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setOverDate(null);
                    }}
                    className={
                      "bg-secondary/60 border-l-primary flex cursor-grab flex-col gap-1 rounded-md border-l-4 p-2 text-xs active:cursor-grabbing " +
                      (draggingId === s.id ? "opacity-40" : "")
                    }
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold">{s.time}</span>
                      <GripVertical className="text-muted-foreground/50 size-3" aria-hidden />
                    </div>
                    <p className="leading-tight font-medium">{s.clientName}</p>
                    <p className="text-muted-foreground leading-tight">
                      {s.typeName}
                      {s.branchName ? ` · ${s.branchName}` : ""}
                    </p>

                    {technicians.length > 0 ? (
                      <div className="flex items-center gap-1 pt-0.5">
                        <User className="text-muted-foreground size-3 shrink-0" aria-hidden />
                        <select
                          value={s.technicianId ?? ""}
                          onChange={(e) => onAssign(s.id, e.target.value)}
                          className="bg-background w-full rounded border px-1 py-0.5 text-[11px]"
                          aria-label="Técnico asignado"
                        >
                          <option value="">Sin asignar</option>
                          {technicians.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <p className="text-muted-foreground/70 pt-0.5 text-[10px]">
                        Agrega técnicos en “Técnicos” para asignar.
                      </p>
                    )}

                    <div className="flex flex-wrap gap-1 pt-0.5">
                      <Badge variant={AGENDA_BADGE[s.agendaStatus].variant}>
                        {AGENDA_BADGE[s.agendaStatus].label}
                      </Badge>
                      <Badge variant={FIELD_BADGE[s.fieldStatus].variant}>
                        {FIELD_BADGE[s.fieldStatus].label}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
