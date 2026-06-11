/* eslint-disable jsx-a11y/alt-text -- el <Image> de react-pdf no es HTML y no admite alt */
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

import { fechaLarga, type CertificateView } from "@/lib/cert-view";
import { LOGO_DATA_URL } from "./logo";

/**
 * PDF del certificado — formato de la v1 (modulos/informes/templates_v2.js,
 * renderCertificadoHTML): encabezado con datos legales + logo, folio dentro de
 * "Identificación del inmueble", fechas servicio/inicio/vigencia, productos
 * con columna Concentración, observaciones por defecto de Configuración
 * SIEMPRE primero, pie con contacto + leyenda legal + QR "Verificar documento".
 * Colores configurables (tenant_settings.data: pdf_color_primario / acento).
 *
 * Nota de unidades: react-pdf usa puntos (pt); los px del HTML van ×0.75.
 */

const INK = "#1A1F2C";
const GRAY = "#4A5061";
const LABEL = "#8B8F9B";
const BEIGE = "#F7F5EF";
const BORDER = "#D9DCE3";

// Sub-etiquetas de la tabla de productos por tratamiento (v1).
const SUB_LABEL: Record<string, string> = {
  desratización: "Desratización — Rodenticidas / Cebos",
  desinsectación: "Desinsectación — Productos químicos",
  sanitización: "Sanitización — Productos",
  aromatización: "Aromatización — Productos",
};

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 8.5,
    color: INK,
    paddingTop: 24,
    paddingBottom: 88, // reserva el espacio del pie fijo
    paddingHorizontal: 24,
  },
  // Encabezado: empresa | título | logo (v1)
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 3,
    paddingBottom: 10,
    gap: 10,
  },
  legalName: { fontSize: 9.5, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  legalLine: { fontSize: 7.5, marginBottom: 1, color: GRAY },
  title: { fontSize: 17, fontFamily: "Helvetica-Bold", letterSpacing: 1, textAlign: "center" },
  subtitle: { fontSize: 8, color: GRAY, textAlign: "center", marginTop: 2 },
  logoBox: { width: 110, alignItems: "flex-end" },
  logoImg: { width: 100, objectFit: "contain" },
  // Secciones
  sectionHdr: {
    color: "#FFFFFF",
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingVertical: 2.5,
    paddingHorizontal: 8,
    borderRadius: 3,
    marginTop: 12,
    marginBottom: 6,
  },
  lbl: {
    fontSize: 7,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: LABEL,
    marginBottom: 1.5,
  },
  cols: { flexDirection: "row", gap: 16 },
  col: { flex: 1 },
  bold: { fontFamily: "Helvetica-Bold" },
  gray: { fontSize: 8.5, color: GRAY },
  body: { fontSize: 9 },
  // Celda del folio (fila de identificación, v1)
  folioCell: {
    width: 86,
    borderWidth: 1.5,
    borderRadius: 6,
    paddingVertical: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  folioNum: { fontSize: 15, fontFamily: "Helvetica-Bold" },
  // Fechas
  datesRow: { flexDirection: "row", gap: 6, marginTop: 12 },
  dateBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 6,
    paddingVertical: 5,
    alignItems: "center",
  },
  // Chips
  chipsRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  chip: {
    color: "#FFFFFF",
    fontSize: 8,
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 9,
    marginRight: 4,
    marginBottom: 4,
  },
  chipSoft: {
    backgroundColor: BEIGE,
    borderWidth: 1,
    borderColor: BORDER,
    color: INK,
    fontSize: 8,
    borderRadius: 3,
    paddingVertical: 1.5,
    paddingHorizontal: 6,
    marginRight: 4,
    marginBottom: 4,
  },
  // Tabla de productos (v1: incluye Concentración)
  subHdr: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: GRAY,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  th: { flexDirection: "row" },
  thCell: {
    color: "#FFFFFF",
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  tr: { flexDirection: "row", borderBottomWidth: 0.75, borderBottomColor: BORDER },
  td: { fontSize: 7, paddingVertical: 3, paddingHorizontal: 4 },
  cNombre: { width: "20%" },
  cIsp: { width: "12%" },
  cForm: { width: "13%" },
  cIngr: { width: "20%" },
  cConc: { width: "12%" },
  cDosis: { width: "12%" },
  cCant: { width: "11%" },
  // Observaciones
  obsBox: {
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: BEIGE,
    borderRadius: 6,
    padding: 8,
    fontSize: 8.5,
    lineHeight: 1.45,
  },
  // Firma
  signWrap: { alignItems: "center", marginTop: 18 },
  signBox: { width: 180, alignItems: "center" },
  signArea: {
    height: 58,
    width: 180,
    justifyContent: "flex-end",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: INK,
  },
  signImg: { maxHeight: 56, maxWidth: 170, objectFit: "contain" },
  // Pie (v1: texto izquierda, QR derecha) — FIJO al borde inferior de cada página
  footer: {
    position: "absolute",
    bottom: 22,
    left: 24,
    right: 24,
    borderTopWidth: 1.5,
    paddingTop: 8,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  footText: { flex: 1, textAlign: "center", fontSize: 7, color: GRAY, lineHeight: 1.4 },
  qrBox: { alignItems: "center", width: 64 },
  qrImg: { width: 52, height: 52 },
  qrCaption: { fontSize: 5.5, color: GRAY, marginTop: 2, textAlign: "center" },
});

function Lbl({ children }: { children: string }) {
  return <Text style={s.lbl}>{children}</Text>;
}

export interface CertificatePdfOptions {
  view: CertificateView;
  /** Código QR (data URL PNG) que apunta a la página pública de verificación. */
  qrDataUrl: string | null;
  /** URL pública de verificación (referencia; el QR la lleva embebida). */
  verifyUrl: string;
}

function CertificateDoc({ view: v, qrDataUrl }: CertificatePdfOptions) {
  const e = v.empresa;
  const P = e.colorPrimario; // color primario configurable (v1)

  // Observaciones: el texto por defecto de Configuración SIEMPRE primero (v1).
  const obsCfg = [e.obsDefault, e.recsDefault].filter(Boolean).join(" ").trim();
  const obsCert = v.observaciones.trim();
  const recsCert = v.recomendaciones.trim();

  // Productos: los de la v2 no traen vínculo a tratamiento → todos bajo el
  // primer tratamiento, con su sub-etiqueta v1.
  const primerServicio = (v.servicios[0] ?? "").toLowerCase().trim();
  const subLabel = v.servicios.length
    ? (SUB_LABEL[primerServicio] ?? `${v.servicios[0]} — Productos`)
    : "Productos utilizados";

  return (
    <Document
      title={`Certificado N° ${v.folio}`}
      author={e.nombreLegal}
      subject="Certificado de Control de Plagas e Higiene Ambiental"
    >
      <Page size="A4" style={s.page}>
        {/* Encabezado: empresa | CERTIFICADO | logo (v1) */}
        <View style={[s.header, { borderBottomColor: P }]}>
          <View style={{ width: 190 }}>
            <Text style={s.legalName}>{e.nombreLegal}</Text>
            <Text style={s.legalLine}>RUT: {e.rut}</Text>
            {e.tel ? <Text style={s.legalLine}>Tel: {e.tel}</Text> : null}
            <Text style={s.legalLine}>{e.direccion}</Text>
            <Text style={s.legalLine}>Res. Sanitaria {e.resSan} · SEREMI de Salud R.M.</Text>
            {e.repLegal ? <Text style={s.legalLine}>Representante: {e.repLegal}</Text> : null}
          </View>
          <View style={{ flex: 1, justifyContent: "center", paddingTop: 6 }}>
            <Text style={[s.title, { color: P }]}>CERTIFICADO</Text>
            <Text style={s.subtitle}>Control de Plagas e Higiene Ambiental</Text>
          </View>
          <View style={s.logoBox}>
            <Image src={LOGO_DATA_URL} style={s.logoImg} />
          </View>
        </View>

        {/* Identificación del inmueble (con celda de folio, v1) */}
        <Text style={[s.sectionHdr, { backgroundColor: P }]}>Identificación del inmueble</Text>
        <View style={s.cols}>
          <View style={s.col}>
            <Lbl>Cliente / Sucursal</Lbl>
            <Text style={[s.body, s.bold]}>{v.clienteNombre || "—"}</Text>
            {v.sucursalNombre ? <Text style={s.body}>{v.sucursalNombre}</Text> : null}
            {v.direccion ? <Text style={s.gray}>{v.direccion}</Text> : null}
          </View>
          <View style={s.col}>
            <Lbl>Diagnóstico previo</Lbl>
            <Text style={[s.body, s.bold]}>{v.plagas.length ? v.plagas.join(", ") : "Sin evidencia"}</Text>
            {v.grado ? <Text style={s.gray}>Grado de infestación: {v.grado}</Text> : null}
          </View>
          <View style={[s.folioCell, { borderColor: P }]}>
            <Lbl>Folio N°</Lbl>
            <Text style={[s.folioNum, { color: P }]}>{String(v.folio)}</Text>
          </View>
        </View>

        {/* Datos del servicio */}
        <Text style={[s.sectionHdr, { backgroundColor: P }]}>Datos del servicio</Text>
        <View style={s.cols}>
          <View style={s.col}>
            <Lbl>Persona que solicitó el trabajo</Lbl>
            <Text style={[s.body, s.bold]}>{v.titular || "—"}</Text>
            {v.rutFirmante ? <Text style={s.gray}>RUT: {v.rutFirmante}</Text> : null}
            {v.correoFirmante ? <Text style={s.gray}>{v.correoFirmante}</Text> : null}
          </View>
          <View style={s.col}>
            <Lbl>Identificación del propietario / empresa</Lbl>
            <Text style={[s.body, s.bold]}>{v.clienteNombre || "—"}</Text>
            {v.clienteRut ? <Text style={s.gray}>RUT: {v.clienteRut}</Text> : null}
            {v.direccion ? <Text style={s.gray}>Dirección: {v.direccion}</Text> : null}
          </View>
        </View>

        {/* Fechas (v1: servicio / inicio del tratamiento / vigencia) */}
        <View style={s.datesRow}>
          <View style={s.dateBox}>
            <Lbl>Fecha del servicio</Lbl>
            <Text style={[s.body, s.bold]}>{fechaLarga(v.serviceDate)}</Text>
          </View>
          <View style={s.dateBox}>
            <Lbl>Inicio del tratamiento</Lbl>
            <Text style={[s.body, s.bold]}>{fechaLarga(v.serviceDate)}</Text>
          </View>
          <View style={[s.dateBox, { borderWidth: 1.5, borderColor: P, backgroundColor: "#F0F3F8" }]}>
            <Lbl>Vigencia del certificado</Lbl>
            <Text style={[s.body, s.bold]}>{fechaLarga(v.fechaVigencia || null)}</Text>
          </View>
        </View>

        {/* Tratamientos */}
        <Text style={[s.sectionHdr, { backgroundColor: P }]}>Tratamientos realizados</Text>
        <View style={s.chipsRow}>
          <Text style={[s.lbl, { marginRight: 6, marginBottom: 4 }]}>Tipo:</Text>
          {(v.servicios.length ? v.servicios : ["Control de Plagas"]).map((t) => (
            <Text key={t} style={[s.chip, { backgroundColor: P }]}>
              {t}
            </Text>
          ))}
        </View>

        {/* Metodología y lugares */}
        <View style={[s.cols, { marginTop: 10 }]}>
          <View style={s.col}>
            <Lbl>Metodología aplicada</Lbl>
            <Text style={[s.body, s.bold]}>{v.metodologia}</Text>
            {v.insumos ? <Text style={s.gray}>Insumos: {v.insumos}</Text> : null}
          </View>
          <View style={s.col}>
            <Lbl>Lugares tratados</Lbl>
            {v.areas.length ? (
              <View style={s.chipsRow}>
                {v.areas.map((a) => (
                  <Text key={a} style={s.chipSoft}>
                    {a}
                  </Text>
                ))}
              </View>
            ) : (
              <Text style={s.body}>—</Text>
            )}
          </View>
        </View>

        {/* Productos utilizados (v1: con Concentración y sub-etiqueta por tratamiento) */}
        {v.productos.length > 0 ? (
          <View>
            <Text style={[s.sectionHdr, { backgroundColor: P }]}>Productos utilizados</Text>
            <Text style={s.subHdr}>{subLabel}</Text>
            <View style={[s.th, { backgroundColor: P }]}>
              <Text style={[s.thCell, s.cNombre]}>Nombre comercial</Text>
              <Text style={[s.thCell, s.cIsp]}>Reg. ISP</Text>
              <Text style={[s.thCell, s.cForm]}>Formulación</Text>
              <Text style={[s.thCell, s.cIngr]}>Ingrediente activo</Text>
              <Text style={[s.thCell, s.cConc]}>Concentración</Text>
              <Text style={[s.thCell, s.cDosis]}>Dosis</Text>
              <Text style={[s.thCell, s.cCant]}>Cant.</Text>
            </View>
            {v.productos.map((p, i) => (
              <View key={`${p.nombre}-${i}`} style={[s.tr, ...(i % 2 ? [{ backgroundColor: BEIGE }] : [])]}>
                <Text style={[s.td, s.cNombre, s.bold]}>{p.nombre}</Text>
                <Text style={[s.td, s.cIsp]}>{p.isp}</Text>
                <Text style={[s.td, s.cForm]}>{p.formulacion}</Text>
                <Text style={[s.td, s.cIngr]}>{p.ingrediente}</Text>
                <Text style={[s.td, s.cConc]}>{p.concentracion}</Text>
                <Text style={[s.td, s.cDosis]}>{p.dosis}</Text>
                <Text style={[s.td, s.cCant]}>{p.cantidad}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Observaciones y recomendaciones (v1: defaults de Configuración primero) */}
        {obsCfg || obsCert || recsCert ? (
          <View>
            <Text style={[s.sectionHdr, { backgroundColor: P }]}>Observaciones y recomendaciones</Text>
            <View style={s.obsBox}>
              {obsCfg ? <Text>{obsCfg}</Text> : null}
              {obsCert ? <Text style={{ marginTop: obsCfg ? 4 : 0 }}>{obsCert}</Text> : null}
              {recsCert ? <Text style={{ marginTop: obsCfg || obsCert ? 4 : 0 }}>{recsCert}</Text> : null}
            </View>
          </View>
        ) : null}

        {/* Firma del representante técnico */}
        <View style={s.signWrap} wrap={false}>
          <View style={s.signBox}>
            <View style={s.signArea}>
              {e.firma ? <Image src={e.firma} style={s.signImg} /> : null}
            </View>
            <Text style={[s.body, s.bold, { marginTop: 3 }]}>{e.repTecNombre}</Text>
            {e.repTecRut ? <Text style={s.gray}>{e.repTecRut}</Text> : null}
            <Text style={s.gray}>Representante Técnico</Text>
          </View>
        </View>

        {/* Pie (v1: contacto + leyenda legal + QR "Verificar documento") */}
        <View style={[s.footer, { borderTopColor: P }]} fixed>
          <View style={s.footText}>
            <Text style={{ fontFamily: "Helvetica-Bold", color: INK }}>{e.nombreLegal}</Text>
            <Text style={{ marginTop: 1 }}>
              {[e.direccion, e.tel ? `Tel: ${e.tel}` : "", e.correo].filter(Boolean).join(" · ")}
            </Text>
            <Text style={{ marginTop: 2 }}>{e.textoLegal}</Text>
          </View>
          {qrDataUrl ? (
            <View style={s.qrBox}>
              <Image src={qrDataUrl} style={s.qrImg} />
              <Text style={s.qrCaption}>Verificar documento</Text>
            </View>
          ) : null}
        </View>
      </Page>
    </Document>
  );
}

/** Genera el PDF y lo devuelve como buffer listo para Storage o adjunto de correo. */
export async function renderCertificatePdf(opts: CertificatePdfOptions): Promise<Buffer> {
  return await renderToBuffer(<CertificateDoc {...opts} />);
}
