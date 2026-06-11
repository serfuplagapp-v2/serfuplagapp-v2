/**
 * Tipos compartidos de la ruta del día. Viven fuera de `actions.ts` porque los
 * archivos "use server" solo deben exportar funciones async (los tipos se
 * borran en runtime y un import desde un componente cliente fallaría).
 */
export interface RouteStop {
  serviceId: string;
  lat: number;
  lng: number;
}

export interface OptimizeResult {
  ok: boolean;
  order?: string[]; // serviceIds en el orden óptimo por calles
  polyline?: string;
  distanceKm?: number;
  durationMin?: number;
  error?: string;
}
