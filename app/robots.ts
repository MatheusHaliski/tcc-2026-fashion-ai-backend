import type { MetadataRoute } from "next";

/** Enquanto o gate de desenvolvedor estiver ligado, nenhum buscador indexa o app. */
export default function robots(): MetadataRoute.Robots {
  const gate = (process.env.DEV_GATE_ENABLED ?? "true").toLowerCase() !== "false";
  return gate ? { rules: [{ userAgent: "*", disallow: "/" }] } : { rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/settings", "/gate"] }] };
}
