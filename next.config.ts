import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Os assets de /public (chrome, auras, peças padrão, ícones) são servidos como estáticos; o backend serve /media.
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
