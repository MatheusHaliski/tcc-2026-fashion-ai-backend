import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Os assets de /public (chrome, auras, peças padrão, ícones) são servidos como estáticos; o backend serve /media.
  images: { unoptimized: true },
  poweredByHeader: false,
  // Next 16 gera AGENTS.md/CLAUDE.md na raiz a cada `next dev`; o projeto não versiona esses arquivos gerados
  agentRules: false,
  // OWASP A05 — cabeçalhos em todas as respostas (a CSP com nonce vem do middleware.ts, por requisição)
  async headers() {
    const gate = (process.env.DEV_GATE_ENABLED ?? "true").toLowerCase() !== "false";
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ...(gate ? [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }] : []),
      ],
    }];
  },
};

export default nextConfig;
