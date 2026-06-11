/**
 * Generador de servicios PROPUESTOS desde los contratos vigentes.
 *
 * Usa el motor puro `scheduling.ts` para calcular las fechas de visita de cada
 * contrato y propone SOLO lo que falta hacia adelante (política "roll-forward":
 * después del último servicio existente de ese contrato; el programa completo si
 * el contrato aún no tiene ningún servicio). Así nunca duplica la operación real
 * ya cargada (1.238 servicios importados de la v1).
 *
 * El mismo cálculo lo usan la VISTA PREVIA (página) y la INSERCIÓN (server
 * action), para que lo que se muestra sea exactamente lo que se crea.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";
import { santiagoDate, santiagoLocalToISO } from "@/lib/datetime";
import { generarVisitas, type ContractSchedule, type VisitaParams } from "@/lib/scheduling";

type DB = SupabaseClient<Database>;

export interface Proposal {
  contractId: string;
  clientId: string;
  clientName: string;
  branchId: string | null;
  branchName: string | null;
  serviceTypeId: string;
  serviceTypeName: string;
  date: string; // "YYYY-MM-DD" (Chile)
  time: string; // "HH:mm"
  scheduledAtISO: string; // UTC para guardar
}

export interface ProposalResult {
  proposals: Proposal[];
  contractsConsidered: number;
  contractsSinSucursal: number; // contratos con propuestas pero sin sucursal clara
  truncated: boolean; // true si se alcanzó MAX_PROPOSALS y quedaron contratos sin evaluar
}

/** Tope de seguridad: no generar ventanas absurdamente largas. */
const MAX_PROPOSALS = 5000;

/**
 * `visit_params` es jsonb heredado de la v1: puede traer claves extra o valores
 * no numéricos. Se conservan solo las claves que el motor entiende y que sean
 * números de verdad.
 */
function parseVisitParams(raw: unknown): VisitaParams {
  if (typeof raw !== "object" || raw === null) return {};
  const src = raw as Record<string, unknown>;
  const out: VisitaParams = {};
  for (const key of ["n", "dow", "dia", "dia1", "dia2"] as const) {
    const v = src[key];
    if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
  }
  return out;
}

export async function computeProposals(
  supabase: DB,
  opts: { from: string; to: string; clientId?: string | null },
): Promise<ProposalResult> {
  // 1) Contratos vigentes (la RLS ya filtra por empresa).
  let cq = supabase
    .from("contracts")
    .select(
      "id, client_id, service_type_id, frequency, visit_mode, visit_params, allowed_days, preferred_time, start_date, end_date",
    )
    .eq("status", "vigente");
  if (opts.clientId) cq = cq.eq("client_id", opts.clientId);
  const { data: contracts } = await cq;
  const contractList = contracts ?? [];
  if (contractList.length === 0) {
    return { proposals: [], contractsConsidered: 0, contractsSinSucursal: 0, truncated: false };
  }

  const contractIds = contractList.map((c) => c.id);
  const clientIds = [...new Set(contractList.map((c) => c.client_id))];
  const typeIds = [...new Set(contractList.map((c) => c.service_type_id))];

  // 2) Servicios existentes de esos contratos (para no duplicar + fijar la fase).
  const existingDates = new Map<string, Set<string>>(); // contractId -> set de fechas Chile
  const lastExisting = new Map<string, string>(); // contractId -> última fecha Chile
  const firstExisting = new Map<string, string>(); // contractId -> primera fecha Chile (ancla)
  const branchByContract = new Map<string, Set<string>>(); // contractId -> sucursales tocadas
  {
    const { data: svc } = await supabase
      .from("services")
      .select("contract_id, branch_id, scheduled_at")
      .in("contract_id", contractIds)
      .not("scheduled_at", "is", null);
    for (const s of svc ?? []) {
      if (!s.contract_id || !s.scheduled_at) continue;
      const d = santiagoDate(s.scheduled_at);
      if (!existingDates.has(s.contract_id)) existingDates.set(s.contract_id, new Set());
      existingDates.get(s.contract_id)!.add(d);
      if (!lastExisting.has(s.contract_id) || d > lastExisting.get(s.contract_id)!)
        lastExisting.set(s.contract_id, d);
      if (!firstExisting.has(s.contract_id) || d < firstExisting.get(s.contract_id)!)
        firstExisting.set(s.contract_id, d);
      if (s.branch_id) {
        if (!branchByContract.has(s.contract_id)) branchByContract.set(s.contract_id, new Set());
        branchByContract.get(s.contract_id)!.add(s.branch_id);
      }
    }
  }

  // 3) Nombres + sucursales por cliente (para contratos sin servicios previos).
  const clientName = new Map<string, string>();
  const typeName = new Map<string, string>();
  const branchName = new Map<string, string>();
  const branchesByClient = new Map<string, string[]>();
  {
    const [cRes, tRes, bRes] = await Promise.all([
      supabase.from("clients").select("id, name").in("id", clientIds),
      supabase.from("service_types").select("id, name").in("id", typeIds),
      supabase.from("branches").select("id, name, client_id").in("client_id", clientIds),
    ]);
    for (const c of cRes.data ?? []) clientName.set(c.id, c.name);
    for (const t of tRes.data ?? []) typeName.set(t.id, t.name);
    for (const b of bRes.data ?? []) {
      branchName.set(b.id, b.name);
      if (!branchesByClient.has(b.client_id)) branchesByClient.set(b.client_id, []);
      branchesByClient.get(b.client_id)!.push(b.id);
    }
  }

  // 4) Calcular propuestas por contrato (roll-forward + dedupe exacto).
  const proposals: Proposal[] = [];
  const contractsSinSucursal = new Set<string>();

  for (const ct of contractList) {
    const sched: ContractSchedule = {
      frequency: ct.frequency,
      visitMode: ct.visit_mode,
      visitParams: parseVisitParams(ct.visit_params),
      allowedDays: ct.allowed_days,
      preferredTime: ct.preferred_time,
      startDate: ct.start_date,
      endDate: ct.end_date,
    };
    const anchor = firstExisting.get(ct.id) ?? ct.start_date ?? opts.from;
    const visits = generarVisitas(sched, { from: opts.from, to: opts.to, anchorDate: anchor });
    const existing = existingDates.get(ct.id);
    const last = lastExisting.get(ct.id) ?? null;

    // Resolver la sucursal: la que ya atiende este contrato; si no hay, la única
    // del cliente. Si es ambiguo, se deja sin sucursal (Carlos la asigna luego).
    const tocadas = branchByContract.get(ct.id);
    let branchId: string | null = null;
    if (tocadas && tocadas.size === 1) {
      branchId = [...tocadas][0] ?? null;
    } else {
      const cb = branchesByClient.get(ct.client_id) ?? [];
      if (cb.length === 1) branchId = cb[0] ?? null;
    }

    let added = 0;
    for (const v of visits) {
      if (last && v.date <= last) continue; // roll-forward
      if (existing?.has(v.date)) continue; // dedupe exacto (seguridad)
      const iso = santiagoLocalToISO(`${v.date}T${v.time}`);
      if (!iso) continue;
      proposals.push({
        contractId: ct.id,
        clientId: ct.client_id,
        clientName: clientName.get(ct.client_id) ?? "Cliente",
        branchId,
        branchName: branchId ? (branchName.get(branchId) ?? null) : null,
        serviceTypeId: ct.service_type_id,
        serviceTypeName: typeName.get(ct.service_type_id) ?? "",
        date: v.date,
        time: v.time,
        scheduledAtISO: iso,
      });
      added++;
      if (proposals.length >= MAX_PROPOSALS) break;
    }
    if (added > 0 && !branchId) contractsSinSucursal.add(ct.id);
    if (proposals.length >= MAX_PROPOSALS) break;
  }

  proposals.sort((a, b) => a.scheduledAtISO.localeCompare(b.scheduledAtISO));
  return {
    proposals,
    contractsConsidered: contractList.length,
    contractsSinSucursal: contractsSinSucursal.size,
    truncated: proposals.length >= MAX_PROPOSALS,
  };
}
