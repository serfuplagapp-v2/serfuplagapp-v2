/**
 * Utilidades de ruteo (puras), portadas de la v1 (`data/geocoder.js` +
 * `core/googlemaps.js`): distancia entre dos puntos, orden por vecino más
 * cercano (TSP greedy) y decodificación de polilíneas de Google.
 */

export interface Punto {
  lat: number;
  lng: number;
}

/** Distancia aproximada en km entre dos coordenadas (haversine). */
export function distanciaKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Ordena puntos con vecino más cercano (nearest-neighbor). Devuelve los índices
 * en el orden optimizado. Si se pasa `origen`, parte del punto más cercano a él;
 * si no, parte del primero. Es instantáneo y no usa la red (sin costo de API).
 */
export function optimizarRutaVecinoCercano(puntos: Punto[], origen?: Punto): number[] {
  const n = puntos.length;
  if (n <= 1) return puntos.map((_, i) => i);

  const visitado = new Array(n).fill(false);
  const orden: number[] = [];

  // Punto de partida: el más cercano al origen (o el índice 0).
  let actual = 0;
  if (origen) {
    let min = Infinity;
    for (let i = 0; i < n; i++) {
      const p = puntos[i]!;
      const d = distanciaKm(origen.lat, origen.lng, p.lat, p.lng);
      if (d < min) {
        min = d;
        actual = i;
      }
    }
  }
  visitado[actual] = true;
  orden.push(actual);

  for (let paso = 1; paso < n; paso++) {
    let min = Infinity;
    let sig = -1;
    const act = puntos[actual]!;
    for (let j = 0; j < n; j++) {
      if (visitado[j]) continue;
      const p = puntos[j]!;
      const d = distanciaKm(act.lat, act.lng, p.lat, p.lng);
      if (d < min) {
        min = d;
        sig = j;
      }
    }
    if (sig === -1) break;
    visitado[sig] = true;
    orden.push(sig);
    actual = sig;
  }
  return orden;
}

/** Largo total (km) de una ruta en el orden dado. */
export function largoRutaKm(puntos: Punto[], orden: number[]): number {
  let total = 0;
  for (let i = 1; i < orden.length; i++) {
    const a = puntos[orden[i - 1]!];
    const b = puntos[orden[i]!];
    if (a && b) total += distanciaKm(a.lat, a.lng, b.lat, b.lng);
  }
  return total;
}

/** Decodifica una polilínea codificada de Google a un arreglo de {lat,lng}. */
export function decodificarPolyline(encoded: string): Punto[] {
  const coords: Punto[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    coords.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return coords;
}

/** Enlace de Google Maps con todos los puntos en orden (para navegar en el celular). */
export function linkGoogleMapsRuta(puntos: Punto[]): string {
  if (puntos.length === 0) return "https://www.google.com/maps";
  const coords = puntos.map((p) => `${p.lat},${p.lng}`);
  return "https://www.google.com/maps/dir/" + coords.join("/");
}
