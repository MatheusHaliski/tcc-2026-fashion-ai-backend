/** Variantes das cenas: outra luz e espelho, sem mexer na original, e nenhum uso (elenco ou cenário) repetido. */
import { describe, expect, it } from "vitest";
import { amostrar, pontoEm } from "@/lib/flair/cenas/caminho";
import { CENA_DO_CENARIO, CENA_DO_ELENCO } from "@/lib/flair/cenas/catalogo";
import { TUNEIS_DE_COR } from "@/lib/flair/cenas/cenas/tuneis-de-cor";
import { RELOJOARIA } from "@/lib/flair/cenas/cenas/relojoaria";
import { viajantesEm, preparar } from "@/lib/flair/cenas/motor";
import { espelharCaminho, girarMatiz, variar } from "@/lib/flair/cenas/variante";

describe("girarMatiz", () => {
  it("gira o matiz e mantém cinza, branco e preto", () => {
    expect(girarMatiz("#ff0000", 120)).toBe("#00ff00");
    expect(girarMatiz("#ff0000", -120)).toBe("#0000ff");
    expect(girarMatiz("#808080", 90)).toBe("#808080");
    expect(girarMatiz("#ffffff", 45)).toBe("#ffffff");
    expect(girarMatiz("#3a7bd5", 0)).toBe("#3a7bd5");
    expect(girarMatiz("#3a7bd5", 360)).toBe("#3a7bd5");
  });
});

describe("espelharCaminho", () => {
  it("espelha x em M, L, C, Q e H e deixa V como está", () => {
    expect(espelharCaminho("M10 20L30 40")).toBe("M150 20L130 40");
    expect(espelharCaminho("M0 0H40V10")).toBe("M160 0H120V10");
    expect(espelharCaminho("M0 0C10 1 20 2 30 3Q40 4 50 5Z")).toBe("M160 0C150 1 140 2 130 3Q120 4 110 5Z");
  });

  it("o caminho espelhado tem o mesmo comprimento e o ponto em u é o reflexo", () => {
    const d = "M-16 30C20 10 60 70 90 40C120 10 140 20 176 60";
    const a = amostrar(d);
    const b = amostrar(espelharCaminho(d));
    expect(b.total).toBeCloseTo(a.total, 3);
    for (const u of [0, 0.3, 0.75, 1]) {
      expect(pontoEm(b, u).x).toBeCloseTo(160 - pontoEm(a, u).x, 3);
      expect(pontoEm(b, u).y).toBeCloseTo(pontoEm(a, u).y, 3);
    }
  });
});

describe("variar", () => {
  it("não muda a cena original e guarda o nome do uso", () => {
    const antes = JSON.stringify(TUNEIS_DE_COR);
    const v = variar(TUNEIS_DE_COR, { nome: "teste", matiz: 90, espelho: true });
    expect(JSON.stringify(TUNEIS_DE_COR)).toBe(antes);
    expect(v.id).toBe(TUNEIS_DE_COR.id);
    expect(v.variante).toBe("teste");
    expect(v.paleta.acentos).not.toEqual(TUNEIS_DE_COR.paleta.acentos);
  });

  it("espelhada, o elenco anda no reflexo da original no mesmo instante (mesma base de tempo)", () => {
    const original = viajantesEm(preparar(RELOJOARIA), 4.2);
    const espelhada = viajantesEm(preparar(variar(RELOJOARIA, { nome: "x", espelho: true })), 4.2);
    expect(espelhada).toHaveLength(original.length);
    espelhada.forEach((v, i) => {
      expect(v.x).toBeCloseTo(160 - original[i].x, 2);
      expect(v.y).toBeCloseTo(original[i].y, 2);
    });
    const giros = variar(RELOJOARIA, { nome: "x", espelho: true }).giros ?? [];
    (RELOJOARIA.giros ?? []).forEach((g, i) => expect(giros[i].sentido ?? 1).toBe(-(g.sentido ?? 1)));
  });
});

describe("usos", () => {
  it("nenhum elenco ou cenário repete o desenho de outro", () => {
    const usos = Object.entries({ ...CENA_DO_ELENCO, ...CENA_DO_CENARIO });
    expect(usos).toHaveLength(20);
    const desenhos = new Set(usos.map(([, c]) => JSON.stringify(c)));
    expect(desenhos.size).toBe(usos.length);
    const chaves = new Set(usos.map(([, c]) => `${c.id}/${c.variante ?? ""}`));
    expect(chaves.size).toBe(usos.length);
  });
});
