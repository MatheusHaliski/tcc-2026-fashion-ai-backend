import { describe, expect, it } from "vitest";
import { DEV_MEDIA_ROUTE, STATIC_MEDIA_PREFIXES, staticMediaOrigin, staticMediaRelativePath, staticMediaRewrites } from "./static-media";

describe("staticMediaOrigin", () => {
  it("prefere STATIC_MEDIA_ORIGIN, sem barra final", () => {
    expect(staticMediaOrigin({ STATIC_MEDIA_ORIGIN: "https://cdn.exemplo.com/media/", VERCEL_GIT_COMMIT_SHA: "abc" })).toBe("https://cdn.exemplo.com/media");
  });
  it("na Vercel usa o jsDelivr no commit exato do deploy", () => {
    expect(staticMediaOrigin({ VERCEL: "1", VERCEL_GIT_COMMIT_SHA: "a43b45d", VERCEL_GIT_REPO_OWNER: "Org", VERCEL_GIT_REPO_SLUG: "repo" }))
      .toBe("https://cdn.jsdelivr.net/gh/Org/repo@a43b45d/media");
    expect(staticMediaOrigin({ VERCEL_GIT_COMMIT_SHA: "a43b45d" })).toBe("https://cdn.jsdelivr.net/gh/MatheusHaliski/tcc-2026-fashion-ai-backend@a43b45d/media");
  });
  it("sem origem (dev, CI) devolve undefined", () => {
    expect(staticMediaOrigin({})).toBeUndefined();
    expect(staticMediaOrigin({ STATIC_MEDIA_ORIGIN: "  " })).toBeUndefined();
  });
});

describe("staticMediaRewrites", () => {
  it("um rewrite por prefixo, para a origem externa", () => {
    const rules = staticMediaRewrites({ STATIC_MEDIA_ORIGIN: "https://cdn.exemplo.com" });
    expect(rules).toHaveLength(STATIC_MEDIA_PREFIXES.length);
    expect(rules).toContainEqual({ source: "/aura/:path*", destination: "https://cdn.exemplo.com/aura/:path*" });
    expect(rules).toContainEqual({ source: "/flair/demos/:path*", destination: "https://cdn.exemplo.com/flair/demos/:path*" });
  });
  it("sem origem aponta para a rota de disco", () => {
    expect(staticMediaRewrites({})).toContainEqual({ source: "/assets_pecas/:path*", destination: `${DEV_MEDIA_ROUTE}/assets_pecas/:path*` });
  });
  it("na Vercel sem origem falha o build em vez de servir 404 em produção", () => {
    expect(() => staticMediaRewrites({ VERCEL: "1" })).toThrow(/STATIC_MEDIA_ORIGIN/);
  });
});

describe("staticMediaRelativePath", () => {
  it("aceita caminhos sob um prefixo conhecido, inclusive nomes com espaço e acento", () => {
    expect(staticMediaRelativePath(["aura", "splash", "catalogo.json"])).toBe("aura/splash/catalogo.json");
    expect(staticMediaRelativePath(["bg_chrome", "ChatGPT Image 22 de set. de 2026, 21_44_46.png"])).toBe("bg_chrome/ChatGPT Image 22 de set. de 2026, 21_44_46.png");
    expect(staticMediaRelativePath(["flair", "demos", "cbc.webm"])).toBe("flair/demos/cbc.webm");
  });
  it("recusa sair da árvore ou prefixos desconhecidos", () => {
    expect(staticMediaRelativePath(["aura", "..", "..", "package.json"])).toBeNull();
    expect(staticMediaRelativePath(["aura", "x\\..\\y.png"])).toBeNull();
    expect(staticMediaRelativePath(["aura", ""])).toBeNull();
    expect(staticMediaRelativePath(["flair", "icons", "a.svg"])).toBeNull();   // icons ficam em public/
    expect(staticMediaRelativePath(["_derived", "x.webp"])).toBeNull();
    expect(staticMediaRelativePath([])).toBeNull();
  });
});
