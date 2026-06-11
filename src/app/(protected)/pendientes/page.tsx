import { AlertTriangle, CheckSquare, ChevronDown, Trash2 } from "lucide-react";

import { requireEnabledProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDays, todaySantiago } from "@/lib/datetime";
import type { TaskPriority } from "@/lib/supabase/types";
import { Badge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { TaskForm } from "./task-form";
import { toggleTask, deleteTask } from "./actions";

export const dynamic = "force-dynamic";

interface TaskRow {
  id: string;
  title: string;
  due_date: string | null;
  priority: TaskPriority;
  client_id: string | null;
  notes: string | null;
}

function fechaCorta(d: string): string {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
  }).format(new Date(`${d}T12:00:00Z`));
}

function Tarea({
  t,
  clientName,
  done,
}: {
  t: TaskRow;
  clientName: string | null;
  done: boolean;
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-2.5">
      <form action={toggleTask} className="pt-0.5">
        <input type="hidden" name="id" value={t.id} />
        <input type="hidden" name="done" value={done ? "false" : "true"} />
        <button
          type="submit"
          title={done ? "Reabrir tarea" : "Marcar como hecha"}
          className={
            "flex size-4.5 items-center justify-center rounded border transition-colors " +
            (done
              ? "bg-success border-success text-white"
              : "border-input hover:border-primary bg-white")
          }
        >
          {done && <span className="text-[10px] leading-none">✓</span>}
        </button>
      </form>
      <div className="min-w-0 flex-1">
        <p className={"text-sm font-medium " + (done ? "text-muted-foreground line-through" : "")}>
          {t.priority === "alta" && !done && (
            <Badge variant="destructive" className="mr-1.5 align-middle">
              Importante
            </Badge>
          )}
          {t.title}
        </p>
        <p className="text-muted-foreground text-xs">
          {t.due_date ? `📅 ${fechaCorta(t.due_date)}` : ""}
          {t.due_date && clientName ? " · " : ""}
          {clientName ? `🔗 ${clientName}` : ""}
        </p>
        {t.notes && <p className="text-muted-foreground mt-0.5 text-xs">{t.notes}</p>}
      </div>
      <form action={deleteTask}>
        <input type="hidden" name="id" value={t.id} />
        <ConfirmSubmit
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive size-7 p-0"
          message={`¿Eliminar la tarea “${t.title}”?`}
        >
          <Trash2 className="size-3.5" />
        </ConfirmSubmit>
      </form>
    </li>
  );
}

function Seccion({
  titulo,
  tone,
  tareas,
  clientNames,
}: {
  titulo: string;
  tone: "destructive" | "primary" | "muted";
  tareas: TaskRow[];
  clientNames: Map<string, string>;
}) {
  if (tareas.length === 0) return null;
  const toneClass =
    tone === "destructive" ? "text-destructive" : tone === "primary" ? "text-primary" : "text-muted-foreground";
  return (
    <section className="bg-card overflow-hidden rounded-xl border">
      <h2 className={`flex items-center gap-1.5 border-b px-4 py-2 text-sm font-semibold ${toneClass}`}>
        {tone === "destructive" && <AlertTriangle className="size-4" aria-hidden />}
        {titulo} ({tareas.length})
      </h2>
      <ul className="divide-y">
        {tareas.map((t) => (
          <Tarea key={t.id} t={t} clientName={t.client_id ? (clientNames.get(t.client_id) ?? null) : null} done={false} />
        ))}
      </ul>
    </section>
  );
}

export default async function PendientesPage() {
  await requireEnabledProfile();
  const supabase = await createClient();

  const [{ data: pendientes }, { data: hechas }, { data: clients }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, due_date, priority, client_id, notes")
      .eq("status", "pendiente")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(200),
    supabase
      .from("tasks")
      .select("id, title, due_date, priority, client_id, notes")
      .eq("status", "hecha")
      .order("done_at", { ascending: false })
      .limit(50),
    supabase.from("clients").select("id, name").order("name"),
  ]);

  const clientNames = new Map((clients ?? []).map((c) => [c.id, c.name]));

  // Buckets de la v1: vencidas / hoy / esta semana / más adelante / sin fecha.
  const hoy = todaySantiago();
  const en7 = addDays(hoy, 7);
  const vencidas: TaskRow[] = [];
  const deHoy: TaskRow[] = [];
  const semana: TaskRow[] = [];
  const adelante: TaskRow[] = [];
  const sinFecha: TaskRow[] = [];
  for (const t of pendientes ?? []) {
    if (!t.due_date) sinFecha.push(t);
    else if (t.due_date < hoy) vencidas.push(t);
    else if (t.due_date === hoy) deHoy.push(t);
    else if (t.due_date <= en7) semana.push(t);
    else adelante.push(t);
  }
  const totalPend = (pendientes ?? []).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="modulo-sticky-top">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <CheckSquare className="text-primary size-6" aria-hidden />
          Pendientes
        </h1>
        <p className="text-muted-foreground text-sm">
          {totalPend === 0
            ? "Sin tareas pendientes."
            : `${totalPend} ${totalPend === 1 ? "tarea pendiente" : "tareas pendientes"}.`}
        </p>
      </div>

      <TaskForm clients={(clients ?? []).map((c) => ({ id: c.id, name: c.name }))} />

      <Seccion titulo="Vencidas" tone="destructive" tareas={vencidas} clientNames={clientNames} />
      <Seccion titulo="Hoy" tone="primary" tareas={deHoy} clientNames={clientNames} />
      <Seccion titulo="Esta semana" tone="primary" tareas={semana} clientNames={clientNames} />
      <Seccion titulo="Más adelante" tone="muted" tareas={adelante} clientNames={clientNames} />
      <Seccion titulo="Sin fecha" tone="muted" tareas={sinFecha} clientNames={clientNames} />

      {(hechas ?? []).length > 0 && (
        <details className="bg-card overflow-hidden rounded-xl border opacity-75">
          <summary className="text-muted-foreground flex cursor-pointer items-center gap-1.5 px-4 py-2 text-sm font-semibold select-none">
            <ChevronDown className="size-4" aria-hidden />
            Completadas ({(hechas ?? []).length})
          </summary>
          <ul className="divide-y border-t">
            {(hechas ?? []).map((t) => (
              <Tarea
                key={t.id}
                t={t}
                clientName={t.client_id ? (clientNames.get(t.client_id) ?? null) : null}
                done
              />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
