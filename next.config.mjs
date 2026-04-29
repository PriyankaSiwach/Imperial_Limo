import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("./", import.meta.url));

/** @type {import("next").NextConfig} */
const nextConfig = {
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
