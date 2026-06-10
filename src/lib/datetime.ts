/**
 * Ayudantes de fecha/hora en zona de Chile (America/Santiago).
 * La base guarda timestamptz (UTC); aquí convertimos para mostrar/ingresar en
 * hora local chilena, respetando el horario de verano.
 */
const TZ = "America/Santiago";

/** Convierte un valor de <input type="datetime-local"> (hora de Santiago) a ISO UTC. */
export function santiagoLocalToISO(local: string): string | null {
  if (!local) return null;
  const asUTC = Date.parse(`${local}:00Z`);
  if (Number.isNaN(asUTC)) return null;
  const santiagoStr = new Date(asUTC).toLocaleString("en-US", { timeZone: TZ });
  const diff = asUTC - new Date(santiagoStr).getTime();
  return new Date(asUTC + diff).toISOString();
}

/** Fecha 'YYYY-MM-DD' de un instante, en hora de Santiago. */
export function santiagoDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

/** Hora 'HH:mm' de un instante, en hora de Santiago. */
export function santiagoTime(iso: string): string {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function todaySantiago(): string {
  return santiagoDate(new Date());
}

// --- Aritmética de fechas (usando mediodía UTC para evitar bordes de DST) ---
export function dayOfWeek(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay(); // 0=domingo … 6=sábado
}
export function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function mondayOf(dateStr: string): string {
  const diff = (dayOfWeek(dateStr) + 6) % 7; // días desde el lunes
  return addDays(dateStr, -diff);
}

/** Etiqueta corta de un día, ej: "lun 16 jun". */
export function dayLabel(dateStr: string): string {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${dateStr}T12:00:00Z`));
}
