// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, mockApi, renderApp, screen } from "@/test-utils/render";
import { PIECE, SCHEME } from "@/test-utils/fixtures";
import { PieceCard } from "./piece-card";
import { SchemeCard, toSealBadges } from "./scheme-card";

/*
 * Selos emitidos por marcas e celebridades chegam aos cards com a arte desenhada pelo emissor:
 * - selo de perfil (tier PERFIL): o item entra na vitrine do emissor pela política de perfil;
 * - selo Hype emitido: o vínculo pedido no painel Hype da peça ou do look.
 */
afterEach(cleanup);
const design = { mode: "TEMPLATE" as const, template: "fai/03" };
const perfil = toSealBadges([{ tier: "PERFIL", owner: "adidas", premium: false, name: "Vitrine Adidas", iconUrl: null, design }]);
const hypeEmitido = toSealBadges([{ tier: "PECA", owner: "shakira", premium: true, name: "Shakira em alta", iconUrl: null, design }]);

describe("selo de perfil", () => {
  it("é rotulado como perfil e não como look", () => {
    expect(perfil[0]).toMatchObject({ label: "Perfil", tier: "PERFIL", kind: "BRAND", design });
  });
  it("no card de peça da vitrine, é a célula Selo da lista Info, com o medalhão do emissor", () => {
    mockApi({});
    renderApp(<PieceCard piece={PIECE} seals={perfil} flip={false} />);
    const medal = screen.getByTitle("Vitrine Adidas · @adidas · PERFIL");
    expect(medal.closest(".pc-info-seal")?.parentElement?.previousElementSibling?.textContent).toBe("Selo");
  });
  it("no card de look da vitrine, aparece no espaço de selos do look", () => {
    mockApi({});
    renderApp(<SchemeCard scheme={SCHEME} seals={perfil} />);
    expect(screen.getAllByTitle(/^Vitrine Adidas/).length).toBeGreaterThan(0);
  });
});

describe("selo Hype emitido por celebridade", () => {
  it("na peça, entra na lista Info com o medalhão premium do emissor", () => {
    mockApi({});
    renderApp(<PieceCard piece={PIECE} seals={hypeEmitido} flip={false} />);
    const medal = screen.getByTitle("Shakira em alta · @shakira · PECA");
    expect(medal.closest(".pc-info-seal")?.textContent).toContain("Shakira em alta");
  });
  it("no look, aparece no espaço de selos do look", () => {
    mockApi({});
    renderApp(<SchemeCard scheme={SCHEME} seals={toSealBadges([{ tier: "LOOK", owner: "shakira", premium: true, name: "Look em alta", iconUrl: null, design }])} />);
    expect(screen.getAllByTitle(/^Look em alta/).length).toBeGreaterThan(0);
  });
});
