// Inspecciona la estructura de un Excel (hojas, encabezados, filas, muestra).
// Uso: node migration/peek-excel.mjs "<ruta.xlsx>"
import xlsx from "xlsx";

const file = process.argv[2];
const wb = xlsx.readFile(file, { cellDates: true });
console.log(`Archivo: ${file}`);
console.log(`Hojas: ${wb.SheetNames.join(" | ")}`);

for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
  console.log(`\n================ Hoja "${name}" — ${rows.length} filas ================`);
  const show = Math.min(rows.length, 8);
  for (let i = 0; i < show; i++) {
    const r = rows[i].map((c) => String(c)).slice(0, 25);
    console.log(`fila ${i}: ${JSON.stringify(r)}`);
  }
  // Ancho máximo de columnas (para ver cuántas columnas reales hay)
  const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 0);
  console.log(`(columnas máximas: ${maxCols})`);
}
