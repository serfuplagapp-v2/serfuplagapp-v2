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

/**
 * PDF del certificado — réplica de la hoja imprimible de /terreno/[id]
 * (que a su vez replica la plantilla v1). Se genera EN EL SERVIDOR con
 * @react-pdf/renderer (sin navegador), por eso sirve para guardarlo en
 * Storage y adjuntarlo a correos.
 *
 * Nota de unidades: react-pdf usa puntos (pt). Los tamaños del HTML (px) se
 * convirtieron con ×0.75 para que la hoja A4 se vea igual que impresa.
 */

const NAVY = "#1B3A6B";
const INK = "#1A1F2C";
const GRAY = "#4A5061";
const LABEL = "#8B8F9B";
const BEIGE = "#F7F5EF";
const BORDER = "#D9DCE3";

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 8.5,
    color: INK,
    paddingTop: 24,
    paddingBottom: 28,
    paddingHorizontal: 24,
  },
  // Encabezado
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 3,
    borderBottomColor: NAVY,
    paddingBottom: 10,
  },
  legalName: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  legalLine: { fontSize: 8, marginBottom: 1 },
  resSan: { fontSize: 8, marginTop: 3, fontFamily: "Helvetica-Bold" },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", color: NAVY, textAlign: "right", letterSpacing: 1 },
  subtitle: { fontSize: 8, color: GRAY, textAlign: "right", marginTop: 1 },
  folioBox: {
    marginTop: 6,
    alignSelf: "flex-end",
    borderWidth: 1.5,
    borderColor: NAVY,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  folioLabel: { fontSize: 7, color: GRAY, textTransform: "uppercase", letterSpacing: 0.5 },
  folioNum: { fontSize: 15, fontFamily: "Helvetica-Bold", color: NAVY },
  // Secciones
  sectionHdr: {
    backgroundColor: NAVY,
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
  twoCols: { flexDirection: "row", gap: 16 },
  col: { flex: 1 },
  bold: { fontFamily: "Helvetica-Bold" },
  gray: { fontSize: 8.5, color: GRAY },
  body: { fontSize: 9 },
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
  dateBoxMain: { borderWidth: 1.5, borderColor: NAVY, backgroundColor: "#F0F3F8" },
  // Chips
  chipsRow: { flexDirection: "row", flexWrap: "wrap" },
  chip: {
    backgroundColor: NAVY,
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
  // Tabla de productos
  th: {
    flexDirection: "row",
    backgroundColor: NAVY,
  },
  thCell: {
    color: "#FFFFFF",
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    paddingVertical: 3,
    paddingHorizontal: 5,
  },
  tr: { flexDirection: "row", borderBottomWidth: 0.75, borderBottomColor: BORDER },
  td: { fontSize: 7.5, paddingVertical: 3, paddingHorizontal: 5 },
  cNombre: { width: "24%" },
  cIsp: { width: "14%" },
  cForm: { width: "14%" },
  cIngr: { width: "22%" },
  cDosis: { width: "13%" },
  cCant: { width: "13%" },
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
  signWrap: { alignItems: "center", marginTop: 22 },
  signBox: { width: 190, alignItems: "center" },
  signArea: {
    height: 58,
    width: 190,
    justifyContent: "flex-end",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: INK,
  },
  signImg: { maxHeight: 56, maxWidth: 180, objectFit: "contain" },
  // Pie
  footer: {
    marginTop: 20,
    borderTopWidth: 1.5,
    borderTopColor: NAVY,
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
  /** URL pública de verificación (se imprime también como texto). */
  verifyUrl: string;
}

function CertificateDoc({ view: v, qrDataUrl, verifyUrl }: CertificatePdfOptions) {
  const e = v.empresa;
  return (
    <Document
      title={`Certificado N° ${v.folio}`}
      author={e.nombreLegal}
      subject="Certificado de Control de Plagas e Higiene Ambiental"
    >
      <Page size="A4" style={s.page}>
        {/* Encabezado */}
        <View style={s.header}>
          <View style={{ maxWidth: 300 }}>
            <Text style={s.legalName}>{e.nombreLegal}</Text>
            <Text style={s.legalLine}>RUT: {e.rut}</Text>
            <Text style={s.legalLine}>{e.direccion}</Text>
            <Text style={s.legalLine}>{e.correo}</Text>
            <Text style={s.resSan}>Res. Sanitaria {e.resSan} · SEREMI de Salud R.M.</Text>
            {e.repLegal ? <Text style={s.legalLine}>Representante: {e.repLegal}</Text> : null}
          </View>
          <View>
            <Text style={s.title}>CERTIFICADO</Text>
            <Text style={s.subtitle}>Control de Plagas e Higiene Ambiental</Text>
            <View style={s.folioBox}>
              <Text style={s.folioLabel}>Folio N°</Text>
              <Text style={s.folioNum}>{String(v.folio)}</Text>
            </View>
          </View>
        </View>

        {/* Identificación del inmueble */}
        <Text style={s.sectionHdr}>Identificación del inmueble</Text>
        <View style={s.twoCols}>
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
        </View>

        {/* Datos del servicio */}
        <Text style={s.sectionHdr}>Datos del servicio</Text>
        <View style={s.twoCols}>
          <View style={s.col}>
            <Lbl>Persona que recibe el servicio</Lbl>
            <Text style={[s.body, s.bold]}>{v.titular || "—"}</Text>
            {v.rutFirmante ? <Text style={s.gray}>RUT: {v.rutFirmante}</Text> : null}
            {v.correoFirmante ? <Text style={s.gray}>{v.correoFirmante}</Text> : null}
          </View>
          <View style={s.col}>
            <Lbl>Identificación del propietario / empresa</Lbl>
            <Text style={[s.body, s.bold]}>{v.clienteNombre || "—"}</Text>
            {v.clienteRut ? <Text style={s.gray}>RUT: {v.clienteRut}</Text> : null}
          </View>
        </View>

        {/* Fechas */}
        <View style={s.datesRow}>
          <View style={s.dateBox}>
            <Lbl>Fecha del servicio</Lbl>
            <Text style={[s.body, s.bold]}>{fechaLarga(v.serviceDate)}</Text>
          </View>
          <View style={s.dateBox}>
            <Lbl>Emisión del certificado</Lbl>
            <Text style={[s.body, s.bold]}>{fechaLarga(v.issuedAt)}</Text>
          </View>
          <View style={[s.dateBox, s.dateBoxMain]}>
            <Lbl>Vigencia del certificado</Lbl>
            <Text style={[s.body, s.bold]}>{fechaLarga(v.fechaVigencia || null)}</Text>
          </View>
        </View>

        {/* Tratamientos */}
        <Text style={s.sectionHdr}>Tratamientos realizados</Text>
        <View style={s.chipsRow}>
          {(v.servicios.length ? v.servicios : ["Control de Plagas"]).map((t) => (
            <Text key={t} style={s.chip}>
              {t}
            </Text>
          ))}
        </View>

        {/* Metodología y lugares */}
        <View style={[s.twoCols, { marginTop: 12 }]}>
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

        {/* Productos */}
        {v.productos.length > 0 ? (
          <View>
            <Text style={s.sectionHdr}>Productos utilizados</Text>
            <View style={s.th}>
              <Text style={[s.thCell, s.cNombre]}>Nombre comercial</Text>
              <Text style={[s.thCell, s.cIsp]}>Reg. ISP</Text>
              <Text style={[s.thCell, s.cForm]}>Formulación</Text>
              <Text style={[s.thCell, s.cIngr]}>Ingrediente activo</Text>
              <Text style={[s.thCell, s.cDosis]}>Dosis</Text>
              <Text style={[s.thCell, s.cCant]}>Cant.</Text>
            </View>
            {v.productos.map((p, i) => (
              <View key={`${p.nombre}-${i}`} style={[s.tr, ...(i % 2 ? [{ backgroundColor: BEIGE }] : [])]}>
                <Text style={[s.td, s.cNombre, s.bold]}>{p.nombre}</Text>
                <Text style={[s.td, s.cIsp]}>{p.isp}</Text>
                <Text style={[s.td, s.cForm]}>{p.formulacion}</Text>
                <Text style={[s.td, s.cIngr]}>{p.ingrediente}</Text>
                <Text style={[s.td, s.cDosis]}>{p.dosis}</Text>
                <Text style={[s.td, s.cCant]}>{p.cantidad}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Observaciones */}
        {v.trabajoRealizado || v.observaciones || v.recomendaciones ? (
          <View>
            <Text style={s.sectionHdr}>Observaciones y recomendaciones</Text>
            <View style={s.obsBox}>
              {v.trabajoRealizado ? (
                <Text>
                  <Text style={s.bold}>Trabajo realizado: </Text>
                  {v.trabajoRealizado}
                </Text>
              ) : null}
              {v.observaciones ? (
                <Text>
                  <Text style={s.bold}>Observaciones: </Text>
                  {v.observaciones}
                </Text>
              ) : null}
              {v.recomendaciones ? (
                <Text>
                  <Text style={s.bold}>Recomendaciones: </Text>
                  {v.recomendaciones}
                </Text>
              ) : null}
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

        {/* Pie con leyenda penal y QR de verificación */}
        <View style={s.footer} wrap={false}>
          {qrDataUrl ? (
            <View style={s.qrBox}>
              <Image src={qrDataUrl} style={s.qrImg} />
              <Text style={s.qrCaption}>Escanee para verificar</Text>
            </View>
          ) : null}
          <View style={s.footText}>
            <Text style={{ fontFamily: "Helvetica-Bold", color: INK }}>
              {e.nombreLegal} · {e.direccion} · {e.correo}
            </Text>
            <Text style={{ marginTop: 2 }}>
              La adulteración o falsificación de este certificado y el uso de un certificado falso es un
              delito penado por la ley, descrito en los artículos 193, 197 y 198 del Código Penal chileno.
            </Text>
            <Text style={{ marginTop: 2 }}>
              Certificado folio {String(v.folio)} · Verifique su autenticidad en {verifyUrl}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

/** Genera el PDF y lo devuelve como buffer listo para Storage o adjunto de correo. */
export async function renderCertificatePdf(opts: CertificatePdfOptions): Promise<Buffer> {
  return await renderToBuffer(<CertificateDoc {...opts} />);
}
