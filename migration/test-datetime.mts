// Prueba de santiagoLocalToISO: debe dar el mismo resultado sin importar la
// zona horaria del servidor. Uso: node migration/test-datetime.mts
import { santiagoLocalToISO, santiagoTime, santiagoDate } from "../src/lib/datetime.ts";

const casos: [string, string][] = [
  ["2026-06-15T15:30", "2026-06-15T19:30:00.000Z"], // invierno chileno (UTC-4)
  ["2026-01-15T15:30", "2026-01-15T18:30:00.000Z"], // verano chileno (UTC-3)
  ["2026-12-25T09:00", "2026-12-25T12:00:00.000Z"], // verano (UTC-3)
  ["2026-04-04T23:00", "2026-04-05T02:00:00.000Z"], // víspera del fin del verano
  ["2026-09-06T09:00", "2026-09-06T12:00:00.000Z"], // tras inicio del verano
];

console.log("TZ del proceso:", Intl.DateTimeFormat().resolvedOptions().timeZone);
let fallas = 0;
for (const [local, esperado] of casos) {
  const got = santiagoLocalToISO(local);
  const ok = got === esperado;
  if (!ok) fallas++;
  console.log(`${ok ? "✅" : "❌"} ${local} -> ${got}  (esperado ${esperado})`);
  // Round-trip: la hora mostrada debe ser la ingresada.
  const rt = got ? `${santiagoDate(got)}T${santiagoTime(got)}` : null;
  if (rt !== local) {
    fallas++;
    console.log(`   ❌ round-trip: ${rt} ≠ ${local}`);
  }
}
process.exit(fallas ? 1 : 0);
