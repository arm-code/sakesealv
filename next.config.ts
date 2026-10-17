import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Salida autocontenida para la imagen Docker (server.js + node_modules trazados).
  output: "standalone",
};

export default nextConfig;
