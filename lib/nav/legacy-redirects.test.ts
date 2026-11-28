import { describe, expect, it } from "vitest";
import { LEGACY_REDIRECTS } from "@/lib/nav/legacy-redirects";

/** Casa um caminho com as regras na ordem do Next (a primeira que casa vale; `:path*` pega o resto). */
function target(path: string, query = ""): string | null {
  const sp = new URLSearchParams(query);
  for (const r of LEGACY_REDIRECTS) {
    const prefix = r.source.replace("/:path*", "");
    const hit = r.source.endsWith("/:path*") ? (path === prefix || path.startsWith(`${prefix}/`)) : path === r.source;
    if (hit && (r.has ?? []).every((h) => sp.get(h.key) === h.value)) return r.destination;
  }
  return null;
}

describe("endereços antigos", () => {
  it("endereços dos jogos levam ao Marketplace e endereços de lojas ficam disponíveis", () => {
    expect(target("/flair/jogos")).toBe("/flair");
    expect(target("/flair/jogos/b31-prova-com-a-estrela")).toBe("/flair");
    expect(target("/flair/3d")).toBe("/flair");
    expect(target("/flair/desafios/mosaico")).toBe("/flair");
    expect(target("/flair/lojas/loja")).toBeNull();
    expect(target("/photos")).toBe("/atelier");
  });

  it("a aba Quarto do Atelier (o Quarto 3D saiu) leva ao ACERVO; as outras abas e o Atelier sem aba ficam", () => {
    expect(target("/atelier", "tab=room")).toBe("/acervo");
    expect(target("/atelier", "tab=room&quarto=3d")).toBe("/acervo");
    expect(target("/atelier", "tab=room&quarto=3d&modulo=door%3A1")).toBe("/acervo");
    expect(target("/atelier", "tab=rewards")).toBeNull();
    expect(target("/atelier", "tab=trends")).toBeNull();
    expect(target("/atelier")).toBeNull();
    expect(target("/acervo")).toBeNull();
  });

  it("nenhum redirecionamento é permanente (os navegadores não guardam)", () => {
    expect(LEGACY_REDIRECTS.every((r) => r.permanent === false)).toBe(true);
  });
});
