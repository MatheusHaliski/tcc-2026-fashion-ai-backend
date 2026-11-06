// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, renderApp, screen } from "@/test-utils/render";
import { PhotoSceneArt, type PhotoPin } from "@/components/flair/games/photo-scene";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import type { GlassSlot } from "@/lib/flair/games";

afterEach(() => cleanup());

const card = (id: string, tier: FlairCollectionCard["tier"], imageUrl: string | null = "/assets_pecas/01_Parte_superior/01_camiseta_referencia.png"): FlairCollectionCard => ({
  id, originType: "PIECE", originId: `p-${id}`, season: "SPRING", tier, ovr: 80, rare: false, position: "SUP", name: `Peça ${id}`, brandName: null, imageUrl,
  hype: null, stats: null, priceVerified: true, state: "AVAILABLE", tradeable: true, acquiredVia: "GENERATED",
});
const pins: PhotoPin[] = [
  { key: "palco", n: 1, x: 50, y: 60, label: "Centro do palco", fx: "spot", size: 14 },
  { key: "imprensa", n: 2, x: 20, y: 40, label: "Parede de imprensa", fx: "flash", size: 10 },
  { key: "espelho", n: 3, x: 80, y: 50, label: "Espelho do camarim", fx: "mirror", size: 9 },
];
const glass = (slot: string, kind: GlassSlot["effect"]["kind"], hypeBand: GlassSlot["hypeBand"], matchBand: GlassSlot["matchBand"]): GlassSlot =>
  ({ slot, cardId: slot, hypeBand, hypeBonus: 1, effect: { kind, bonus: kind === "COMUM" ? 0 : 2, text: `Texto do efeito em ${slot}` }, matchBand, matchDelta: 1 });

describe("PhotoSceneArt · a foto do ambiente reage às cartas", () => {
  it("cada carta usa a luz do lugar (fx), a Aura Hype da faixa de partida e o efeito do servidor", () => {
    const { container, rerender } = renderApp(<PhotoSceneArt photo="/flair/games/scenes/palco-show.webp" pins={pins} placed={{ palco: card("a", "OURO") }}
      glass={[glass("palco", "METAMORFOSE", "RELEVANT", "VIRAL")]} />);
    const hit = container.querySelector(".gep-hit")!;
    expect(hit.className).toContain("fx-spot");
    expect(hit.className).toContain("is-metamorfose");
    expect(hit.className).toContain("band-5");                                   // Viral: anéis, raios e partículas
    expect(container.querySelectorAll(".gfx-beam").length).toBe(3);             // a Aura Hype soma canhões no palco
    expect(container.querySelector(".gfx-gobo")).toBeTruthy();                  // Metamorfose projeta gobo na cor do nível
    expect(container.querySelector(".gep-rays")).toBeTruthy();
    expect(container.querySelector(".gep-callout")!.textContent).toContain("Metamorfose");
    expect(container.querySelector(".gep-callout")!.textContent).toContain("Texto do efeito em palco");
    expect(screen.getByRole("status").textContent).toContain("Centro do palco");
    rerender(<PhotoSceneArt photo="/flair/games/scenes/palco-show.webp" pins={pins} placed={{ palco: card("a", "OURO"), imprensa: card("b", "PRATA") }}
      glass={[glass("palco", "METAMORFOSE", "RELEVANT", "VIRAL"), glass("imprensa", "COMUM", "NICHE", "NICHE")]} />);
    expect(container.querySelectorAll(".gfx-burst").length).toBe(3);            // flashes de imprensa: 2 + faixa (Nicho = 1)
    expect(container.querySelector(".gep-hit.is-latest")!.className).toContain("fx-flash");   // a última inserção abre a legenda
  });

  it("Impersonation põe a peça no reflexo do espelho; sem carta, nada acende", () => {
    const { container } = renderApp(<PhotoSceneArt photo="/flair/games/scenes/camarim.webp" pins={pins} placed={{ espelho: card("c", "ESPECIAL") }}
      glass={[glass("espelho", "IMPERSONATION", "HOT", "HOT")]} />);
    expect(container.querySelectorAll(".gep-hit").length).toBe(1);
    expect(container.querySelector(".gfx-piece-reflected img.gfx-cutout")).toBeTruthy();
    expect(container.querySelectorAll(".gfx-bulb").length).toBe(6 + 3 * 2);  // lâmpadas de camarim pela faixa (Em alta)
    expect(container.querySelector(".gep-pin.is-lit")!.textContent).toBe("3");
  });

  it("a cena acorda com o preenchimento, acende a luz dourada na montagem perfeita e credita a foto", () => {
    const { container } = renderApp(<PhotoSceneArt photo="/flair/games/scenes/boate.webp" pins={pins} perfect
      placed={{ palco: card("a", "BRONZE"), imprensa: card("b", "PRATA"), espelho: card("c", "OURO") }}
      credit={{ title: "LAX Nightclub", creator: "MIXEvent", license: "CC BY 2.0", source: "https://commons.wikimedia.org/wiki/File:LAX_Nightclub_Las_Vegas_Interior_2.jpg" }} />);
    const root = container.querySelector(".gep") as HTMLElement;
    expect(root.style.getPropertyValue("--gep-life")).toBe("1.000");
    expect(root.className).toContain("is-perfect");
    expect(container.querySelector(".gep-flare")).toBeTruthy();
    expect(screen.getByText(/LAX Nightclub · MIXEvent · CC BY 2.0/)).toBeTruthy();
    expect(screen.getByRole("link").getAttribute("href")).toContain("commons.wikimedia.org");
  });

  it("cartas vizinhas em harmonia ganham um fio de luz; com Metamorfose, um circuito com pulso; sem harmonia, nada liga", () => {
    const r = (slot: string, neighbor: boolean) => ({ slot, position: "SUP", cardId: slot, positionOk: true, neighbor, theme: false, sintonia: neighbor ? 2 : 1 });
    const placed = { palco: card("a", "OURO"), imprensa: card("b", "PRATA"), espelho: card("c", "BRONZE") };
    const { container, rerender } = renderApp(<PhotoSceneArt photo="/x.webp" pins={pins} placed={placed} results={[r("palco", true), r("imprensa", true), r("espelho", false)]}
      glass={[glass("palco", "COMUM", "RELEVANT", "RELEVANT"), glass("imprensa", "COMUM", "NICHE", "NICHE"), glass("espelho", "COMUM", "NICHE", "NICHE")]} />);
    expect(container.querySelectorAll(".gep-link").length).toBe(1);            // palco–imprensa; imprensa–espelho não harmoniza
    expect(container.querySelector(".gep-link.is-circuit")).toBeNull();
    rerender(<PhotoSceneArt photo="/x.webp" pins={pins} placed={placed} results={[r("palco", true), r("imprensa", true), r("espelho", true)]}
      glass={[glass("palco", "METAMORFOSE", "RELEVANT", "TRENDING"), glass("imprensa", "COMUM", "NICHE", "NICHE"), glass("espelho", "COMUM", "NICHE", "NICHE")]} />);
    expect(container.querySelectorAll(".gep-link").length).toBe(2);
    expect(container.querySelectorAll(".gep-link.is-circuit .gep-link-pulse").length).toBe(1);
  });
});
