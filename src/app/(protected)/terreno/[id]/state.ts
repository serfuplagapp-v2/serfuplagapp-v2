/** Estado de las acciones de PDF/envío del certificado (error o confirmación). */
export type CertActionState = { error: string | null; ok: string | null };
export const initialCertState: CertActionState = { error: null, ok: null };
