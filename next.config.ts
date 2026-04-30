import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

/** Absolute path to this package (`webmaker/`), not the monorepo root (`hermes-agent/`). */
const webmakerRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  transpilePackages: ["@stackblitz/sdk"],
  /** Avoid webpack/RSC bundling glitches with Upstash’s ESM client (fixes intermittent `__webpack_exec__` / `.call` errors on API routes). */
  serverExternalPackages: ["@upstash/redis"],
  // Monorepo: lock Turbopack + PostCSS resolution to this app so `tailwindcss` resolves from
  // `webmaker/node_modules`, not the parent repo (which has package.json but no node_modules).
  turbopack: {
    root: webmakerRoot,
    resolveAlias: {
      tailwindcss: path.join(webmakerRoot, "node_modules/tailwindcss"),
      "@tailwindcss/postcss": path.join(
        webmakerRoot,
        "node_modules/@tailwindcss/postcss"
      ),
    },
  },
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "192.168.29.74",
  ],
};

export default nextConfig;
