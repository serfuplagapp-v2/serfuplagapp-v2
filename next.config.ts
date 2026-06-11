import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @react-pdf/renderer (PDF del certificado) se carga desde node_modules en el
  // servidor en vez de empaquetarse: evita problemas con sus binarios internos.
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
