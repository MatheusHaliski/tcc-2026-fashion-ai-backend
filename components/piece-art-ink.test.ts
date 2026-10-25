import { describe, expect, it } from "vitest";
import { readPieceArt } from "@/lib/piece-art";
import { artSurfaceProps } from "./piece-art";

/** Background Studio › Container › Cor dos textos: o card de peça usa a cor escolhida (como o look e o DNA). */
describe("cor dos textos do container no card de peça", () => {
  const style = (bg: Record<string, unknown>) => artSurfaceProps(bg, readPieceArt(bg), "compact").style as unknown as Record<string, string>;

  it("a cor escolhida vira a tinta do card, e os textos secundários seguem o mesmo tom", () => {
    const s = style({ container: { color: "#FFFFFF", ink: "#C8102E" } });
    expect(s["--card-ink"]).toBe("#C8102E");
    expect(s["--muted"]).toContain("#C8102E");
  });
  it("automática pelo contraste: container escuro escolhido → texto claro; claro → escuro", () => {
    expect(style({ container: { color: "#101010" } })["--card-ink"]).toBe("#F5F2EC");
    expect(style({ container: { color: "#FAFAFA" } })["--card-ink"]).toBe("#1A1714");
  });
  it("sem cor de container nem de texto escolhidas, o skin decide (nada é sobrescrito)", () => {
    expect(style({})["--card-ink"]).toBeUndefined();
    expect(style({ container: { ink: "vermelho" } })["--card-ink"]).toBeUndefined();
  });
});
