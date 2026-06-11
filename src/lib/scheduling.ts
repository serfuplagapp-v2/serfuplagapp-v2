/**
 * Motor de agendamiento — periodicidades, modos de visita y feriados de Chile.
 *
 * Portado de la v1 (`core/periodicidades.js` + `data/feriados.js`), que estaba
 * muy bien resuelto. Son funciones PURAS (sin dependencias): calculan en qué
 * fechas cae cada visita de un contrato recurrente, respetando fin de semana y
 * feriados chilenos. Lo usa el generador de servicios propuestos desde contratos.
 */

// ════════════════════════════════════════════════════════════════════
// Periodicidades (cada cuánto se repite el servicio)
// ════════════════════════════════════════════════════════════════════
export type FrecuenciaId =
  | "Semanal"
  | "Quincenal"
  | "Mensual"
  | "Bimestral"
  | "Trimestral"
  | "Cuatrimestral"
  | "Semestral"
  | "Anual"
  | "Puntual";

export interface Periodicidad {
  id: FrecuenciaId;
  label: string;
  dias: number | null;
}

export const PERIODICIDADES: Periodicidad[] = [
  { id: "Semanal", label: "Semanal", dias: 7 },
  { id: "Quincenal", label: "Quincenal (2 veces al mes)", dias: 14 },
  { id: "Mensual", label: "Mensual", dias: 30 },
  { id: "Bimestral", label: "Bimestral", dias: 60 },
  { id: "Trimestral", label: "Trimestral", dias: 90 },
  { id: "Cuatrimestral", label: "Cuatrimestral", dias: 120 },
  { id: "Semestral", label: "Semestral", dias: 180 },
  { id: "Anual", label: "Anual", dias: 365 },
  { id: "Puntual", label: "Puntual", dias: null },
];

export const PERIO_A_DIAS: Record<string, number> = Object.fromEntries(
  PERIODICIDADES.filter((p) => p.dias !== null).map((p) => [p.id, p.dias as number]),
);

// ════════════════════════════════════════════════════════════════════
// Modos de visita (CUÁNDO cae la visita dentro del ciclo)
// ════════════════════════════════════════════════════════════════════
export const FRECS_MENSUAL_O_MAYOR: FrecuenciaId[] = [
  "Mensual",
  "Bimestral",
  "Trimestral",
  "Cuatrimestral",
  "Semestral",
  "Anual",
];

export type ModoVisitaId =
  | "primer_habil"
  | "dia_habil_mes"
  | "dow_x"
  | "dia_mes"
  | "doble_dow_1_3"
  | "doble_dow_2_4"
  | "doble_habil_1_3"
  | "doble_habil_2_4"
  | "dia_dia"
  | "todos_dow"
  | "cada_n_dias"
  | "puntual";

export interface ModoVisita {
  id: ModoVisitaId;
  label: string;
  frecs: FrecuenciaId[] | "*";
  params?: string[];
}

export const MODOS_VISITA: ModoVisita[] = [
  { id: "primer_habil", label: "1er día hábil del mes", frecs: FRECS_MENSUAL_O_MAYOR },
  { id: "dia_habil_mes", label: "N° día hábil del mes", frecs: FRECS_MENSUAL_O_MAYOR, params: ["n"] },
  { id: "dow_x", label: "X° {día} del mes", frecs: FRECS_MENSUAL_O_MAYOR, params: ["dow", "n"] },
  { id: "dia_mes", label: "Día N del mes", frecs: [...FRECS_MENSUAL_O_MAYOR, "Quincenal"], params: ["dia"] },
  { id: "doble_dow_1_3", label: "1° y 3° {día} del mes", frecs: ["Quincenal"], params: ["dow"] },
  { id: "doble_dow_2_4", label: "2° y 4° {día} del mes", frecs: ["Quincenal"], params: ["dow"] },
  { id: "doble_habil_1_3", label: "1° y 3° día hábil del mes", frecs: ["Quincenal"] },
  { id: "doble_habil_2_4", label: "2° y 4° día hábil del mes", frecs: ["Quincenal"] },
  { id: "dia_dia", label: "Días N1 y N2 del mes", frecs: ["Quincenal"], params: ["dia1", "dia2"] },
  { id: "todos_dow", label: "Todos los {día}", frecs: ["Semanal"], params: ["dow"] },
  { id: "cada_n_dias", label: "Cada N días desde inicio", frecs: "*", params: ["n"] },
  { id: "puntual", label: "Una sola vez", frecs: ["Puntual"] },
];

export function modosParaFrecuencia(frecuenciaId: FrecuenciaId): ModoVisita[] {
  return MODOS_VISITA.filter(
    (m) => m.frecs === "*" || (Array.isArray(m.frecs) && m.frecs.includes(frecuenciaId)),
  );
}

export interface VisitaParams {
  n?: number;
  dow?: number;
  dia?: number;
  dia1?: number;
  dia2?: number;
}

// ════════════════════════════════════════════════════════════════════
// Feriados de Chile
// ════════════════════════════════════════════════════════════════════
// Fijos (día, mes) válidos todos los años.
const FIJOS: [number, number][] = [
  [1, 1], [1, 5], [21, 5], [29, 6], [16, 7], [15, 8], [18, 9], [19, 9],
  [12, 10], [31, 10], [1, 11], [8, 12], [25, 12],
];

// Variables por año (Semana Santa + móviles). Ampliar cada año.
const VARIABLES: Record<number, string[]> = {
  2025: ["2025-04-18", "2025-04-19", "2025-10-31"],
  2026: ["2026-04-03", "2026-04-04", "2026-10-31"],
  2027: ["2027-03-26", "2027-03-27", "2027-10-31"],
};

export function esFeriado(date: Date): boolean {
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  if (FIJOS.some(([fd, fm]) => fd === d && fm === m)) return true;
  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return (VARIABLES[y] ?? []).includes(iso);
}

export function esDiaNoHabil(date: Date): boolean {
  const dow = date.getDay(); // 0=dom, 6=sab
  return dow === 0 || dow === 6 || esFeriado(date);
}

/**
 * Mueve la fecha al siguiente (o anterior) día hábil, o al siguiente día que
 * esté en `diasPermitidos` (dow 0=dom..6=sab; [] = cualquier hábil).
 */
export function ajustarADiaHabil(
  fecha: Date,
  diasPermitidos: number[] = [],
  direccion: "siguiente" | "anterior" = "siguiente",
): Date {
  const f = new Date(fecha);
  const paso = direccion === "anterior" ? -1 : 1;
  let intentos = 0;
  while (intentos < 60) {
    const dow = f.getDay();
    const esPermitido =
      diasPermitidos.length === 0
        ? !esDiaNoHabil(f)
        : diasPermitidos.includes(dow) && !esFeriado(f);
    if (esPermitido) return f;
    f.setDate(f.getDate() + paso);
    intentos++;
  }
  return f;
}

// ════════════════════════════════════════════════════════════════════
// Cálculo de las fechas de visita en un mes
// ════════════════════════════════════════════════════════════════════
const _esFinDeSemana = (d: Date) => {
  const dow = d.getDay();
  return dow === 0 || dow === 6;
};

/**
 * Devuelve las fechas (1 o 2) en que cae la visita de un modo dentro de un mes.
 * @param month0 mes 0-indexado (0=enero)
 * @param esFeriadoFn por defecto usa el calendario chileno; pasar null para solo saltar fines de semana.
 */
export function fechasModoEnMes(
  year: number,
  month0: number,
  modo: ModoVisitaId,
  parametros: VisitaParams = {},
  esFeriadoFn: ((d: Date) => boolean) | null = esFeriado,
): Date[] {
  const noHabil = (d: Date) => _esFinDeSemana(d) || (esFeriadoFn ? esFeriadoFn(d) : false);
  const ultimoDia = new Date(year, month0 + 1, 0).getDate();
  const fechas: Date[] = [];

  if (modo === "primer_habil") {
    const d = new Date(year, month0, 1);
    while (noHabil(d)) d.setDate(d.getDate() + 1);
    fechas.push(d);
  } else if (modo === "dia_habil_mes") {
    const N = parametros.n || 1;
    const d = new Date(year, month0, 1);
    while (noHabil(d)) d.setDate(d.getDate() + 1);
    for (let i = 1; i < N; i++) {
      d.setDate(d.getDate() + 1);
      while (noHabil(d)) d.setDate(d.getDate() + 1);
    }
    fechas.push(d);
  } else if (modo === "dow_x") {
    const dow = parametros.dow ?? 5;
    const N = parametros.n || 1;
    const d = new Date(year, month0, 1);
    let count = 0;
    while (count < N && d.getMonth() === month0) {
      if (d.getDay() === dow) count++;
      if (count < N) d.setDate(d.getDate() + 1);
    }
    if (count === N) fechas.push(d);
  } else if (modo === "dia_mes") {
    const dia = Math.min(parametros.dia || 1, ultimoDia);
    fechas.push(new Date(year, month0, dia));
  } else if (modo === "doble_dow_1_3" || modo === "doble_dow_2_4") {
    const dow = parametros.dow ?? 5;
    const posiciones = modo === "doble_dow_1_3" ? [1, 3] : [2, 4];
    for (const pos of posiciones) {
      const d = new Date(year, month0, 1);
      let count = 0;
      while (count < pos && d.getMonth() === month0) {
        if (d.getDay() === dow) count++;
        if (count < pos) d.setDate(d.getDate() + 1);
      }
      if (count === pos) fechas.push(d);
    }
  } else if (modo === "doble_habil_1_3" || modo === "doble_habil_2_4") {
    const posiciones = modo === "doble_habil_1_3" ? [1, 3] : [2, 4];
    for (const pos of posiciones) {
      const d = new Date(year, month0, 1);
      while (noHabil(d)) d.setDate(d.getDate() + 1);
      for (let i = 1; i < pos; i++) {
        d.setDate(d.getDate() + 1);
        while (noHabil(d)) d.setDate(d.getDate() + 1);
      }
      fechas.push(d);
    }
  } else if (modo === "dia_dia") {
    const d1 = Math.min(parametros.dia1 || 1, ultimoDia);
    const d2 = Math.min(parametros.dia2 || 15, ultimoDia);
    fechas.push(new Date(year, month0, d1));
    if (d2 !== d1) fechas.push(new Date(year, month0, d2));
  } else if (modo === "todos_dow") {
    const dow = parametros.dow ?? 5;
    for (let d = new Date(year, month0, 1); d.getMonth() === month0; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === dow) fechas.push(new Date(d));
    }
  }

  return fechas;
}

/** Cuántos meses avanza un ciclo según la frecuencia. */
export function mesesPorCiclo(frecuenciaId: FrecuenciaId): number {
  const map: Partial<Record<FrecuenciaId, number>> = {
    Mensual: 1,
    Bimestral: 2,
    Trimestral: 3,
    Cuatrimestral: 4,
    Semestral: 6,
    Anual: 12,
  };
  return map[frecuenciaId] ?? 1;
}
