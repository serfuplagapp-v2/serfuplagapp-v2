/**
 * Ayudantes de fecha/hora en zona de Chile (America/Santiago).
 * La base guarda timestamptz (UTC); aquí convertimos para mostrar/ingresar en
 * hora local chilena, respetando el horario de verano.
 */
const TZ = "America/Santiago";

const OFFSET_DTF = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** Offset de Santiago vs UTC (ms) en un instante dado: utc − reloj de Santiago. */
function santiagoOffsetMs(utcMs: number): number {
  const p: Record<string, string> = {};
  for (const part of OFFSET_DTF.formatToParts(new Date(utcMs))) p[part.type] = part.value;
  const hour = p.hour === "24" ? "00" : p.hour; // algunos motores devuelven "24" a medianoche
  const wallAsUTC = Date.parse(`${p.year}-${p.month}-${p.day}T${hour}:${p.minute}:${p.second}Z`);
  return utcMs - wallAsUTC;
}

/**
 * Convierte un valor de <input type="datetime-local"> (hora de Santiago) a ISO UTC.
 * No depende de la zona horaria del servidor (la versión anterior solo era
 * correcta en servidores UTC; en una máquina en hora de Chile quedaba 3–4 h
 * corrida). Se itera dos veces para acertar también en los bordes del cambio
 * de hora (horario de verano chileno).
 */
export function santiagoLocalToISO(local: string): string | null {
  if (!local) return null;
  const asUTC = Date.parse(`${local}:00Z`);
  if (Number.isNaN(asUTC)) return null;
  let result = asUTC + santiagoOffsetMs(asUTC);
  result = asUTC + santiagoOffsetMs(result);
  return new Date(result).toISOString();
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
/** Suma `n` meses a 'YYYY-MM-DD' (recorta el día si el mes destino es más corto). */
export function addMonths(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.toISOString().slice(0, 10);
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
