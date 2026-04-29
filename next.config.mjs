import path from "node:path";
import { fileURLToPath } from "node:url";

/** Directory containing this config (repo root for this app). */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import("next").NextConfig} */
const nextConfig = {
  // Pin workspace root so Next does not infer a parent folder when multiple lockfiles exist.
  turbopack: { root: projectRoot },
  outputFileTracingRoot: projectRoot,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
