import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { boardInicial, boardReducer } from "@/lib/flair/nucleos/board";
import { abasVisiveis, abaVisivelAtual, itensDaFileira, vagasDaRegua } from "@/lib/flair/nucleos/deck-row";
import {
  classesDoQuadro,
  estiloDoQuadro,
  larguraDaFileira,
  porteDoViewport,
  quadroDoViewport,
  TAMANHOS,
  TOQUE_MIN,
  ZONA_ROUPA,
  type Porte,
} from "@/lib/flair/nucleos/quadro";
import { buildTabs } from "@/lib/flair/nucleos/selection";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";

/** Quadro da tela (seção 1 do desenho): porte, proporção, divisão palco/deck, tamanho das cartas e a fileira com a régua. */
const card = (id: string, position: string): FlairCollectionCard => ({
  id,
  originType: "PIECE",
  originId: `p-${id}`,
  season: "SPRING",
  tier: "PRATA",
  ovr: 70,
  rare: false,
  position,
  name: `Carta ${id}`,
  priceVerified: true,
  state: "AVAILABLE",
  tradeable: true,
  acquiredVia: "GENERATED",
});
const CARDS = [card("c1", "SUP"), card("c2", "INF"), card("c3", "CAL"), card("c4", "SUP")];
const TABS = buildTabs({ recursos: ["CARTAS", "RESPOSTA"], vagas: ["SUP", "INF", "CAL"], zonas: [], areas: [], opcoes: ["A", "B"] }, CARDS);

describe("quadro por porte", () => {
  it("celular em pé: largura inteira, palco 56% e deck 44%", () => {
    const q = quadroDoViewport(360, 780);
    expect(q).toMatchObject({ porte: "celular", quadro: "retrato", palco: 56, deck: 44 });
    expect(classesDoQuadro(q)).toBe("n3d-frame is-celular is-retrato");
  });

  it("tablet em pé fica em retrato; deitado vira o quadro 16:10 com palco 62% e deck 38%", () => {
    expect(quadroDoViewport(768, 1024)).toMatchObject({ porte: "tablet", quadro: "retrato", palco: 56, deck: 44 });
    const deitado = quadroDoViewport(1024, 768);
    expect(deitado).toMatchObject({ porte: "tablet", quadro: "paisagem", palco: 62, deck: 38 });
    expect(classesDoQuadro(deitado)).toBe("n3d-frame is-tablet is-paisagem");
  });

  it("computador: quadro deitado; celular deitado continua no quadro em pé", () => {
    expect(quadroDoViewport(1440, 900)).toMatchObject({ porte: "computador", quadro: "paisagem", palco: 62, deck: 38 });
    expect(classesDoQuadro(quadroDoViewport(1440, 900))).toBe("n3d-frame is-computador is-paisagem");
    expect(quadroDoViewport(800, 360)).toMatchObject({ porte: "celular", quadro: "retrato" });
    expect(porteDoViewport(1100, 700)).toBe("computador");
    expect(porteDoViewport(1099, 700)).toBe("tablet");
  });

  it("tamanho das cartas da tabela, sempre 5 por 7, com a área de toque mínima de 44 px", () => {
    expect(TAMANHOS.celular).toEqual({ carta: [76, 106], espaco: 8, visiveis: 4, miniatura: [44, 62], ampliada: [240, 336] });
    expect(TAMANHOS.tablet).toEqual({ carta: [92, 129], espaco: 10, visiveis: 6, miniatura: [52, 73], ampliada: [280, 392] });
    expect(TAMANHOS.computador).toEqual({ carta: [108, 151], espaco: 12, visiveis: 8, miniatura: [60, 84], ampliada: [300, 420] });
    for (const porte of Object.keys(TAMANHOS) as Porte[]) {
      const t = TAMANHOS[porte];
      for (const [w, h] of [t.carta, t.miniatura, t.ampliada]) {
        expect(Math.abs(w / h - 5 / 7)).toBeLessThan(0.01);
        expect(w).toBeGreaterThanOrEqual(TOQUE_MIN);
      }
    }
  });

  it("as cartas visíveis sem rolar cabem na largura do quadro de cada porte", () => {
    expect(larguraDaFileira(TAMANHOS.celular)).toBe(328);
    expect(larguraDaFileira(TAMANHOS.celular)).toBeLessThanOrEqual(360 - 24);
    expect(larguraDaFileira(TAMANHOS.tablet)).toBeLessThanOrEqual(768 - 24);
    expect(larguraDaFileira(TAMANHOS.computador)).toBeLessThanOrEqual(1280 - 24);
  });

  it("as medidas viram variáveis de CSS; a zona da roupa é a faixa central de 40%", () => {
    const estilo = estiloDoQuadro(quadroDoViewport(1024, 768)) as Record<string, string>;
    expect(estilo["--n3d-palco"]).toBe("62fr");
    expect(estilo["--n3d-deck"]).toBe("38fr");
    expect(estilo["--n3d-card-w"]).toBe("92px");
    expect(estilo["--n3d-card-h"]).toBe("129px");
    expect(estilo["--n3d-gap"]).toBe("10px");
    expect(estilo["--n3d-thumb-w"]).toBe("52px");
    expect(estilo["--n3d-big-h"]).toBe("392px");
    expect(ZONA_ROUPA).toEqual({ esquerda: 30, largura: 40 });
    expect(estilo["--n3d-zona-x"]).toBe("30%");
    expect(estilo["--n3d-zona-w"]).toBe("40%");
  });
});

describe("fileira do deck e régua de vagas", () => {
  it("as vagas de roupa viram a aba Roupas; a resposta continua uma aba; a régua tem uma casa por vaga", () => {
    const visiveis = abasVisiveis(TABS, true);
    expect(visiveis.map((a) => a.id)).toEqual(["ROUPAS", "RESPOSTA"]);
    expect(visiveis[0].indices).toEqual([0, 1, 2]);
    expect(abasVisiveis(TABS, false).map((a) => a.id)).toEqual(["SUP", "INF", "CAL", "RESPOSTA"]);
    expect(abasVisiveis(TABS, true, (t) => t.tipo === "vaga").map((a) => a.id)).toEqual(["ROUPAS"]);
    expect(vagasDaRegua(TABS).map((v) => v.tab.id)).toEqual(["SUP", "INF", "CAL"]);
  });

  it("sem filtro, a fileira traz todas as cartas; com a vaga escolhida, as que cabem vêm primeiro e as outras ficam marcadas", () => {
    const roupas = abaVisivelAtual(abasVisiveis(TABS, true), 0);
    const todas = itensDaFileira(TABS, roupas, null);
    expect(todas.map((x) => x.it.key)).toEqual(["c1", "c4", "c2", "c3"]);
    expect(todas.every((x) => x.cabe)).toBe(true);
    const filtrada = itensDaFileira(TABS, roupas, "CAL");
    expect(filtrada.map((x) => [x.it.key, x.cabe])).toEqual([["c3", true], ["c1", false], ["c4", false], ["c2", false]]);
    expect(itensDaFileira(TABS, null, "CAL")).toEqual([]);
    const resposta = abaVisivelAtual(abasVisiveis(TABS, true), 3);
    expect(itensDaFileira(TABS, resposta, "CAL").every((x) => x.cabe)).toBe(true);
  });

  it("tocar numa casa filtra e leva o foco para a vaga; tocar de novo tira o filtro; trocar de aba acompanha", () => {
    let s = boardReducer(boardInicial(), { type: "vaga", id: "CAL", tabs: TABS });
    expect(s).toMatchObject({ vaga: "CAL", aba: 2, item: 0 });
    s = boardReducer(s, { type: "comando", comando: { acao: "TROCAR_ABA", dir: -1 }, tabs: TABS });
    expect(s).toMatchObject({ vaga: "INF", aba: 1 });
    s = boardReducer(s, { type: "vaga", id: "INF", tabs: TABS });
    expect(s.vaga).toBeNull();
    s = boardReducer(boardReducer(s, { type: "vaga", id: "SUP", tabs: TABS }), { type: "comando", comando: { acao: "TROCAR_ABA", dir: -1 }, tabs: TABS });
    expect(s).toMatchObject({ vaga: null, aba: 3 });
    expect(boardReducer(boardInicial(), { type: "vaga", id: "XXX", tabs: TABS }).vaga).toBeNull();
    expect(boardReducer({ ...boardInicial(), vaga: "SUP" }, { type: "aba", index: 3 }).vaga).toBeNull();
  });
});

/**
 * Regressão da auditoria (1440×900 com o menu lateral): o quadro deitado ficava baixo, a faixa de baixo não comportava
 * a régua de vagas + uma carta inteira e as cartas do deck apareciam cortadas. A folha de estilo garante essa altura.
 */
describe("quadro — a faixa do deck comporta uma carta inteira", () => {
  const css = readFileSync(join(process.cwd(), "app/(site)/_styles/33-flair3d-quadro.css"), "utf8");
  const regra = (seletor: string) => css.slice(css.indexOf(`${seletor} {`), css.indexOf("}", css.indexOf(`${seletor} {`)));

  it("a linha de baixo do quadro tem altura mínima de miniatura + carta + abas", () => {
    expect(regra(".n3d-frame")).toMatch(/minmax\(calc\(var\(--n3d-thumb-h, 62px\) \+ var\(--n3d-card-h, 106px\) \+ 90px\), var\(--n3d-deck, 44fr\)\)/);
  });

  it("o quadro deitado usa a altura livre da tela quando a largura é pouca", () => {
    expect(regra(".n3d-frame.is-paisagem")).toMatch(/min-height: min\(calc\(100dvh - var\(--header-h\) - 64px\), 780px\)/);
  });

  it("em todo porte a altura mínima cabe na parte de baixo de uma tela comum", () => {
    for (const [porte, alturaDoQuadro] of [["celular", 844 - 56], ["tablet", 1024 - 56], ["computador", 780]] as const) {
      const t = TAMANHOS[porte];
      const minimo = t.miniatura[1] + t.carta[1] + 90;
      expect(minimo).toBeLessThanOrEqual(alturaDoQuadro * 0.5);
    }
  });
});

/** Regressão da auditoria: "Atributos na horizontal" cortava os números no card estreito (só POP, ENG, TEN e meio VEL). */
describe("painel de Hype — atributos na horizontal", () => {
  it("quebra em mais linhas em vez de esconder atributos atrás de rolagem", () => {
    const css = readFileSync(join(process.cwd(), "app/(site)/_styles/24-metamorfoses-layouts.css"), "utf8");
    const linha = css.split("\n").find((l) => l.startsWith('.fashion-hype-matrix[data-layout="static-horizontal"] {'))!;
    expect(linha).toContain("flex-wrap: wrap");
    expect(linha).not.toContain("overflow-x");
  });
});
