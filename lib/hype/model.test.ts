import { describe, expect, it } from "vitest";
import { deltaOf, dimensionsFor, displayScore, hypeViewState, levelTone, DIMENSION_ORDER } from "./model";
import { reasonText } from "./explain";
import { translate } from "@/lib/i18n/core";

const t = (key: string, vars?: Record<string, unknown>) => translate("pt-BR", key, vars as never);

describe("estados do Hype (nunca 0 para 'sem dados')", () => {
  it("carregando, erro e não calculado", () => {
    expect(hypeViewState(undefined, { loading: true }).kind).toBe("loading");
    expect(hypeViewState(undefined, { error: true }).kind).toBe("error");
    expect(hypeViewState({ status: "NOT_CALCULATED" }).kind).toBe("not_calculated");
    expect(hypeViewState(undefined).kind).toBe("not_calculated");
  });

  it("dados insuficientes não viram score", () => {
    const s = hypeViewState({ status: "INSUFFICIENT_DATA", score: null, stale: true });
    expect(s).toEqual({ kind: "insufficient", stale: true, calculatedAt: undefined });
  });

  it("score 0 é um valor válido (sinal baixo), diferente de sem dados", () => {
    const s = hypeViewState({ status: "AVAILABLE", score: 0, level: "LOW_SIGNAL" });
    expect(s.kind).toBe("available");
    if (s.kind === "available") expect(displayScore(s.score)).toBe(0);
  });

  it("desatualizado continua mostrando o último score", () => {
    const s = hypeViewState({ status: "AVAILABLE", score: 82.4, level: "TRENDING", stale: true, direction: "UP" });
    expect(s).toMatchObject({ kind: "available", score: 82.4, stale: true, direction: "UP" });
  });
});

describe("apresentação", () => {
  it("delta em % quando há base, em pontos quando não há; sem direção = sem seta", () => {
    expect(deltaOf({ direction: "UP", deltaPercent: 14.4, deltaPoints: 10 })).toEqual({ direction: "UP", percent: 14, points: 10 });
    expect(deltaOf({ direction: "DOWN", deltaPercent: null, deltaPoints: -3.2 })).toEqual({ direction: "DOWN", percent: undefined, points: -3 });
    expect(deltaOf({ direction: null })).toBeNull();
  });

  it("faixa vira classe de tom e influência só aparece em looks", () => {
    expect(levelTone("LOW_SIGNAL")).toBe("is-low-signal");
    expect(levelTone("VIRAL")).toBe("is-viral");
    expect(dimensionsFor("PIECE")).not.toContain("INFLUENCE");
    expect(dimensionsFor("SCHEME")).toEqual(DIMENSION_ORDER);
  });
});

describe("explicação humana dos motivos", () => {
  it("crescimento de um sinal vira frase com o número", () => {
    expect(reasonText(t, { code: "SAVES_GROWTH", tone: "POSITIVE", value: 43 })).toBe("43% mais salvamentos nos últimos 7 dias");
    expect(reasonText(t, { code: "SIMILAR_GROWTH", tone: "POSITIVE", value: 31 })).toBe("Peças semelhantes cresceram 31% em popularidade recentemente.");
  });

  it("trend não é popularidade", () => {
    expect(reasonText(t, { code: "POPULAR_NOT_GROWING", tone: "NEUTRAL" })).toMatch(/popularidade não é tendência/);
  });

  it("código desconhecido (algoritmo novo) cai num texto neutro", () => {
    expect(reasonText(t, { code: "SOMETHING_FROM_HYPE_V3", tone: "NEUTRAL" })).toBe("Outro sinal considerado no cálculo.");
  });
});
