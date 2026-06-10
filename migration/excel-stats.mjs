// Estadísticas del Informe Diario (para la importación de movements).
import xlsx from "xlsx";
const wb = xlsx.readFile(process.argv[2], { cellDates: true });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true });
const body = rows.slice(1).filter((r) => r.some((c) => String(c).trim() !== ""));

// Precio = col 16 (" Precio "), Año = col 1, Nombre Cliente = col 7, ID_Cliente = col 8, Fecha = col 0
const num = (v) => {
  if (typeof v === "number") return Math.round(v);
  let s = String(v).trim();
  if (!s) return 0;
  s = s.replace(/\s/g, "").replace(/,/g, ""); // coma = separador de miles
  const f = parseFloat(s);
  return isNaN(f) ? 0 : Math.round(f);
};
let total = 0, neg = 0, zero = 0, sinPrecio = 0;
const byYear = {};
const conId = new Set();
const clientes = new Set();
let minF = null, maxF = null;
for (const r of body) {
  const p = num(r[16]);
  total += p;
  if (p < 0) neg++;
  if (p === 0) zero++;
  if (String(r[16]).trim() === "") sinPrecio++;
  const y = String(r[1]).trim() || "?";
  byYear[y] = (byYear[y] || 0) + p;
  if (String(r[8]).trim()) conId.add(String(r[8]).trim());
  const cli = String(r[7]).trim() || String(r[6]).trim();
  if (cli) clientes.add(cli.toLowerCase());
  const f = String(r[0]).trim();
  if (f) { if (!minF || f < minF) minF = f; if (!maxF || f > maxF) maxF = f; }
}
console.log(`Filas con datos: ${body.length}`);
console.log(`SUMA TOTAL Precio: $${total.toLocaleString("es-CL")}`);
console.log(`Precios negativos (¿NC?): ${neg} · en cero: ${zero} · sin precio: ${sinPrecio}`);
console.log(`Clientes distintos (por nombre): ${clientes.size}`);
console.log(`Filas con ID_Cliente: ${conId.size} ids distintos`);
console.log(`\nPor año:`);
for (const [y, v] of Object.entries(byYear).sort()) console.log(`  ${y}: $${v.toLocaleString("es-CL")}`);
