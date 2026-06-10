// =============================================================================
// Serfuplagapp v2 — Transformación v1 → v2  ·  genera VISTA PREVIA (no carga nada)
// -----------------------------------------------------------------------------
// Reglas (acordadas con Carlos, 10-jun-2026):
//   · Agrupar por RUT; sucursal:true cuelga de la casa matriz del mismo RUT.
//   · Cada ficha de la v1 = una SUCURSAL (branch). El grupo = un CLIENTE (client).
//   · Nombre de sucursal = COMBINAR fantasía (empresa) + razón social.
//   · Extras (cartera, frecuencia, días de visita, dir. tributaria, saludo…) → Notas.
//   · 3 registros de prueba se excluyen (a rechazados.json).
//   · Coordenadas lat/lng se traen tal cual (mapa casi pre-hecho).
// Lee:  exports/<fecha>/raw/clientes.json
// Escribe (en exports/<fecha>/preview/):
//   clientes_v2.json, sucursales_v2.json, contactos_v2.json, rechazados.json,
//   RESUMEN.md  y  CSVs (clientes/sucursales/contactos) para abrir en Excel.
// =============================================================================
import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1"));

// --- Encontrar la carpeta de export más reciente con raw/clientes.json --------
const exportsDir = path.join(HERE, "exports");
const fechas = readdirSync(exportsDir)
  .filter((f) => existsSync(path.join(exportsDir, f, "raw", "clientes.json")))
  .sort()
  .reverse();
if (!fechas.length) {
  console.error("No encontré raw/clientes.json. Corre antes:  node migration/export.mjs");
  process.exit(1);
}
const fecha = fechas[0];
const rawPath = path.join(exportsDir, fecha, "raw", "clientes.json");
const outDir = path.join(exportsDir, fecha, "preview");
mkdirSync(outDir, { recursive: true });
const docs = JSON.parse(readFileSync(rawPath, "utf8"));
console.log(`Leídos ${docs.length} clientes de ${rawPath}\n`);

// -----------------------------------------------------------------------------
// Utilidades
// -----------------------------------------------------------------------------
const txt = (v) => (v === null || v === undefined ? "" : String(v).trim());
const isTrue = (v) => v === true || v === "true";

// Normaliza el RUT al formato v2 (76818360-0). Si en la v1 viene mal formado
// (sin dígito verificador, muy corto, sin guion), NO inventa el DV: lo marca con
// "-?" y devuelve ok:false para que Carlos lo revise.
function normalizeRut(raw) {
  const s = txt(raw);
  if (!s) return { rut: "", ok: true, missing: true };
  if (/^0+$/.test(s.replace(/[^0-9kK]/g, ""))) return { rut: "", ok: true, missing: true }; // RUT de relleno (puros ceros)
  const m = s.match(/^(.*?)-\s*([0-9kK])\s*$/); // guion + DV explícito al final
  if (m) {
    const body = m[1].replace(/[^0-9kK]/g, "");
    if (body.length >= 6) return { rut: `${body}-${m[2].toUpperCase()}`, ok: true };
  }
  const clean = s.replace(/[^0-9kK]/g, "");
  if (/-\s*$/.test(s)) return { rut: `${clean}-?`, ok: false, reason: "DV ausente en la v1" };
  if (clean.length < 7) return { rut: clean ? `${clean}-?` : "", ok: false, reason: "RUT muy corto" };
  return { rut: `${clean.slice(0, -1)}-${clean.slice(-1).toUpperCase()}`, ok: false, reason: "sin guion explícito" };
}
const rutKey = (raw) => txt(raw).replace(/[^0-9kK]/g, "").toLowerCase();

function combinePhones(cel, tel) {
  const c = txt(cel), t = txt(tel);
  if (c && t && c !== t) return `${c} / ${t}`;
  return c || t || "";
}

function combineName(d) {
  const fant = txt(d.empresa);
  const legal = txt(d.razon_social);
  if (fant && legal) {
    if (fant === legal) return fant;
    if (fant.includes(legal) || legal.includes(fant)) return fant.length >= legal.length ? fant : legal;
    return `${fant} — ${legal}`.slice(0, 140);
  }
  return fant || legal || "(sin nombre)";
}

function composeAddress(d) {
  const parts = [txt(d.direccion), txt(d.comuna), txt(d.ciudad)].filter(Boolean);
  // quitar duplicados consecutivos (a veces comuna ya viene en la dirección)
  const seen = new Set();
  const uniq = parts.filter((p) => {
    const k = p.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return uniq.join(", ");
}

const DAYS = { lu: "Lun", ma: "Mar", mi: "Mié", ju: "Jue", vi: "Vie", sa: "Sáb", do: "Dom" };
function diasVisita(obj) {
  if (!obj || typeof obj !== "object") return "";
  const on = Object.entries(DAYS).filter(([k]) => obj[k] === true).map(([, v]) => v);
  return on.length ? on.join(",") : "";
}

// Notas: junta los datos extra etiquetados, omitiendo los vacíos.
function buildNotes(d) {
  const bits = [];
  if (txt(d.cartera)) bits.push(`Cartera: ${txt(d.cartera)}`);
  if (txt(d.frecuencia)) bits.push(`Frecuencia: ${txt(d.frecuencia)}`);
  const dv = diasVisita(d.dias_visita);
  if (dv) bits.push(`Días de visita: ${dv}`);
  if (txt(d.direccion_tributaria)) bits.push(`Dir. tributaria: ${txt(d.direccion_tributaria)}`);
  if (txt(d.rubro)) bits.push(`Rubro: ${txt(d.rubro)}`);
  if (txt(d.giro)) bits.push(`Giro: ${txt(d.giro)}`);
  if (txt(d.saludo)) bits.push(`Saludo: ${txt(d.saludo)}`);
  if (txt(d.referido_por) && !txt(d.referido_por).includes("${")) bits.push(`Referido por: ${txt(d.referido_por)}`);
  if (d.activo === false) bits.push("Estado v1: INACTIVO");
  return bits.join(" · ");
}

function inferType(d) {
  const s = `${txt(d.razon_social)} ${txt(d.empresa)} ${txt(d.rubro)} ${txt(d.giro)}`.toLowerCase();
  if (/escuela|liceo|colegio|jard[ií]n|sala cuna|\bji\b|cesfam|sapu|cecosf|posta|hospital|cl[ií]nic|fundaci|corporaci|municipal|servicio de salud|servicio local|\bhogar\b|residencia|conapran|iglesia|ciudad del ni|centro educacional|centro cl[ií]nic|prevenci|seremi/.test(s))
    return "institucional";
  if (/casa particular|departamento|\bdepto\b|\bcasa\b|particular|\bsr[a]?\.|\bdon\b|do[ñn]a|vivienda|comunidad edificio|condominio/.test(s))
    return "residencial";
  return "empresa";
}

// -----------------------------------------------------------------------------
// 1) Excluir registros de prueba
// -----------------------------------------------------------------------------
const JUNK = new Set(["sda", "sin nombre", "na", "n/a", "-", ".", "xxx", "test"]);
const isJunk = (d) => {
  const a = txt(d.razon_social).toLowerCase();
  const b = txt(d.empresa).toLowerCase();
  if (/prueba/.test(a) || /prueba/.test(b)) return true;
  return JUNK.has(a) || JUNK.has(b);
};
const rechazados = [];
const limpios = [];
for (const d of docs) {
  if (isJunk(d)) {
    rechazados.push({ _v1_id: d._id, razon_social: txt(d.razon_social) || txt(d.empresa), motivo: "registro de prueba/basura" });
  } else {
    limpios.push(d);
  }
}

// -----------------------------------------------------------------------------
// 2) Agrupar por RUT (los sin RUT quedan como grupo individual por su _id)
// -----------------------------------------------------------------------------
const groups = new Map();
for (const d of limpios) {
  const k = rutKey(d.rut) || `__norut__${d._id}`;
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(d);
}

// -----------------------------------------------------------------------------
// 3) Construir clientes / sucursales / contactos
// -----------------------------------------------------------------------------
const clients = [];
const branches = [];
const contacts = [];
const notas = { sinMatriz: [], multiMatriz: [], sinRut: [], rutRevisar: [] };

// Punto 5 (Carlos): los pares de "matriz duplicada" se fusionan en una sola ficha;
// EXCEPCIÓN Educain (RUT 779017869): son dos locales reales → se dejan ambos.
const KEEP_BOTH_MATRICES = new Set(["779017869"]);

for (const [key, fichas] of groups) {
  const matrices = fichas.filter((d) => !isTrue(d.sucursal));
  const sucursales = fichas.filter((d) => isTrue(d.sucursal));

  // Elegir la ficha "cabeza" que define al CLIENTE
  let head;
  if (matrices.length === 1) head = matrices[0];
  else if (matrices.length === 0) {
    head = sucursales[0]; // grupo sin matriz: asciende una sucursal
    notas.sinMatriz.push({ rut: txt(head.rut), ejemplo: combineName(head), n: sucursales.length });
  } else {
    head = matrices.find((d) => isTrue(d.es_cabeza_grupo)) || matrices[0];
    notas.multiMatriz.push({ rut: txt(head.rut), matrices: matrices.map((m) => txt(m.razon_social)) });
  }
  if (key.startsWith("__norut__")) notas.sinRut.push(combineName(head));

  // Fusionar matrices duplicadas (mismo RUT): se conservan la cabeza y TODAS las
  // sucursales reales; se descartan las matrices repetidas (queda registro en rechazados).
  let fichasToEmit = fichas;
  if (matrices.length > 1 && !KEEP_BOTH_MATRICES.has(rutKey(head.rut))) {
    const dropped = matrices.filter((m) => m !== head);
    fichasToEmit = fichas.filter((d) => !dropped.includes(d));
    dropped.forEach((d) => rechazados.push({ _v1_id: d._id, razon_social: txt(d.razon_social), motivo: `matriz duplicada fusionada con la cabeza (${head._id})` }));
  }

  const clientKey = `cli_${key}`;
  const rn = normalizeRut(head.rut);
  if (!rn.ok) notas.rutRevisar.push({ name: txt(head.razon_social), raw: txt(head.rut), sugerido: rn.rut, motivo: rn.reason });
  clients.push({
    _key: clientKey,
    _v1_id: head._id,
    name: txt(head.razon_social) || combineName(head),
    rut: rn.rut,
    notes: "",
    _nSucursales: fichasToEmit.length,
  });

  // Cada ficha del grupo (cabeza + sucursales reales) = una sucursal
  const rawContacts = [];
  for (const d of fichasToEmit) {
    const branchKey = `br_${d._id}`;
    const hasGeo = typeof d.lat === "number" && typeof d.lng === "number";
    branches.push({
      _key: branchKey,
      _clientKey: clientKey,
      _v1_id: d._id,
      name: combineName(d),
      address: composeAddress(d),
      lat: hasGeo ? d.lat : null,
      lng: hasGeo ? d.lng : null,
      geocoded_at: hasGeo ? (txt(d.creado_en) || "v1") : null,
      notes: buildNotes(d),
    });

    // Contactos de esta ficha (se acumulan y luego se deduplican por cliente)
    if (txt(d.contacto_nombre)) {
      rawContacts.push({ branchKey, name: txt(d.contacto_nombre), role: "", phone: combinePhones(d.celular, d.telefono), email: txt(d.correo), principal: true, whatsapp: !!txt(d.celular) });
    }
    if (Array.isArray(d.contactos_adicionales)) {
      for (const c of d.contactos_adicionales) {
        if (!c || !txt(c.nombre)) continue;
        rawContacts.push({ branchKey, name: txt(c.nombre), role: txt(c.cargo), phone: combinePhones(c.celular, c.telefono), email: txt(c.correo), principal: false, whatsapp: false });
      }
    }
  }

  // Deduplicar contactos dentro del cliente: si el mismo contacto se repite en
  // varias sucursales (ej. el coordinador central), queda UNO a nivel cliente;
  // si es propio de una sola sucursal, queda a nivel de esa sucursal.
  const byKey = new Map();
  for (const c of rawContacts) {
    const k = `${c.name.toLowerCase()}|${txt(c.email).toLowerCase()}|${c.phone}`;
    if (!byKey.has(k)) byKey.set(k, { ...c, branches: new Set([c.branchKey]) });
    else {
      const e = byKey.get(k);
      e.branches.add(c.branchKey);
      e.principal = e.principal || c.principal;
      e.whatsapp = e.whatsapp || c.whatsapp;
      if (!e.role) e.role = c.role;
    }
  }
  let orden = 0;
  for (const e of byKey.values()) {
    const clientLevel = e.branches.size > 1;
    contacts.push({
      _clientKey: clientKey,
      _branchKey: clientLevel ? null : [...e.branches][0],
      name: e.name, role: e.role, phone: e.phone, email: e.email,
      es_destinatario: e.principal, es_cc: false, recibe_whatsapp: e.whatsapp,
      orden: orden++,
    });
  }
}

// -----------------------------------------------------------------------------
// 4) Escribir salidas (JSON + CSV + RESUMEN)
// -----------------------------------------------------------------------------
const W = (name, data) => writeFileSync(path.join(outDir, name), JSON.stringify(data, null, 2), "utf8");
W("clientes_v2.json", clients);
W("sucursales_v2.json", branches);
W("contactos_v2.json", contacts);
W("rechazados.json", rechazados);

function csv(rows, cols) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = cols.map((c) => esc(c.h)).join(",");
  const body = rows.map((r) => cols.map((c) => esc(c.f(r))).join(",")).join("\r\n");
  return "﻿" + head + "\r\n" + body; // BOM para que Excel lea acentos
}
const clientByKey = new Map(clients.map((c) => [c._key, c]));
const branchByKey = new Map(branches.map((b) => [b._key, b]));
writeFileSync(path.join(outDir, "clientes.csv"), csv(clients, [
  { h: "Cliente", f: (r) => r.name }, { h: "RUT", f: (r) => r.rut },
  { h: "N° sucursales", f: (r) => r._nSucursales },
]), "utf8");
writeFileSync(path.join(outDir, "sucursales.csv"), csv(branches, [
  { h: "Cliente", f: (r) => clientByKey.get(r._clientKey)?.name ?? "" },
  { h: "Sucursal", f: (r) => r.name }, { h: "Dirección", f: (r) => r.address },
  { h: "Lat", f: (r) => r.lat }, { h: "Lng", f: (r) => r.lng }, { h: "Notas", f: (r) => r.notes },
]), "utf8");
writeFileSync(path.join(outDir, "contactos.csv"), csv(contacts, [
  { h: "Cliente", f: (r) => clientByKey.get(r._clientKey)?.name ?? "" },
  { h: "Sucursal", f: (r) => (r._branchKey ? branchByKey.get(r._branchKey)?.name ?? "" : "(todas las sucursales)") },
  { h: "Contacto", f: (r) => r.name }, { h: "Cargo", f: (r) => r.role },
  { h: "Teléfono", f: (r) => r.phone }, { h: "Email", f: (r) => r.email },
  { h: "Principal", f: (r) => (r.es_destinatario ? "Sí" : "") },
]), "utf8");

// Ejemplo trabajado: el cliente con más sucursales
const ejemplo = [...clients].sort((a, b) => b._nSucursales - a._nSucursales)[0];
const ejemploBranches = branches.filter((b) => b._clientKey === ejemplo._key);

const resumen = `# Vista previa de importación — clientes/sucursales/contactos (${fecha})

## Conteos
- Fichas en la v1 .................. ${docs.length}
- Excluidas (prueba) .............. ${rechazados.length}
- **Clientes (v2)** ............... **${clients.length}**
- **Sucursales (v2)** ............. **${branches.length}**
- **Contactos (v2)** ............. **${contacts.length}**
- Cuadre: clientes-cubren-fichas = ${branches.length + rechazados.length} (debe ser ${docs.length}) ${
  branches.length + rechazados.length === docs.length ? "✅" : "❌ REVISAR"
}
- Sucursales con coordenadas ...... ${branches.filter((b) => b.lat !== null).length} / ${branches.length}

## Ejemplo trabajado: "${ejemplo.name}" (RUT ${ejemplo.rut})
Cliente con ${ejemplo._nSucursales} sucursales. Primeras 6:
${ejemploBranches.slice(0, 6).map((b) => `- ${b.name}  ·  ${b.address || "(sin dirección)"}${b.lat ? "  📍" : ""}`).join("\n")}

## Casos borde resueltos
- Sin RUT (clientes sueltos): ${notas.sinRut.length}${notas.sinRut.length ? " → " + notas.sinRut.join("; ") : ""}
- Grupos sin matriz (ascendí una sucursal): ${notas.sinMatriz.length}${
  notas.sinMatriz.length ? "\n" + notas.sinMatriz.map((g) => `   · ${g.ejemplo} (rut ${g.rut}, ${g.n} sucursal/es)`).join("\n") : ""
}
- Grupos con RUT repetido y varias matrices: ${notas.multiMatriz.length}${
  notas.multiMatriz.length ? "\n" + notas.multiMatriz.map((g) => `   · rut ${g.rut}: ${g.matrices.join(" / ")}`).join("\n") : ""
}
- RUT a revisar (formato/DV dudoso): ${notas.rutRevisar.length}${
  notas.rutRevisar.length ? "\n" + notas.rutRevisar.map((r) => `   · ${r.name}: v1="${r.raw}" → ${r.sugerido} (${r.motivo})`).join("\n") : ""
}

## Excluidos (registros de prueba o basura)
${rechazados.map((r) => `- ${r.razon_social}`).join("\n")}

> Archivos para revisar en Excel: clientes.csv, sucursales.csv, contactos.csv (en esta misma carpeta).
> Nada de esto se ha cargado todavía en Supabase.
`;
writeFileSync(path.join(outDir, "RESUMEN.md"), resumen, "utf8");

console.log(resumen);
console.log(`\n💾 Vista previa escrita en: migration/exports/${fecha}/preview/`);
console.log("   (clientes_v2.json, sucursales_v2.json, contactos_v2.json, rechazados.json, RESUMEN.md, *.csv)");
process.exit(0);
