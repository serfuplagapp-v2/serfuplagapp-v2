// Recupera los secretos GRAPH_* del proyecto Firebase v1 (Secret Manager)
// usando la llave de servicio. NO imprime los valores: los guarda en
// Secretos/graph.txt (carpeta ignorada por git) para copiarlos a Vercel.
// Uso: node migration/get-graph-secrets.mjs
import { writeFileSync } from "node:fs";
import { GoogleAuth } from "google-auth-library";

const auth = new GoogleAuth({
  keyFile: "Secretos/serfuplagapp-e436d-firebase-adminsdk-fbsvc-f0a3ca49f0.json",
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});
const client = await auth.getClient();
const token = (await client.getAccessToken()).token;
const names = ["GRAPH_TENANT_ID", "GRAPH_CLIENT_ID", "GRAPH_CLIENT_SECRET", "GRAPH_SENDER_EMAIL"];
let out = "";
for (const n of names) {
  const r = await fetch(
    `https://secretmanager.googleapis.com/v1/projects/serfuplagapp-e436d/secrets/${n}/versions/latest:access`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!r.ok) {
    console.log(`${n}: ERROR ${r.status} ${(await r.text()).slice(0, 160)}`);
    continue;
  }
  const data = await r.json();
  const value = Buffer.from(data.payload.data, "base64").toString("utf8");
  out += `${n}=${value}\n`;
  console.log(`${n}: OK (${value.length} caracteres)`);
}
if (out) {
  writeFileSync("Secretos/graph.txt", out);
  console.log("Guardado en Secretos/graph.txt (NO se sube a git)");
}
