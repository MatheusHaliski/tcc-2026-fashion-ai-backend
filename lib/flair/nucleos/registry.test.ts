import { describe, expect, it } from "vitest";
import { avataresDoNucleo, protagonistaEfetiva } from "@/lib/flair/nucleos/avatares";
import { boardInicial, boardReducer, type BoardAcao } from "@/lib/flair/nucleos/board";
import { comandoDaTecla, lerGamepad, PAD_INICIAL } from "@/lib/flair/nucleos/controls";
import { alternarCarta, conferirDeck, posicoesDaRegra } from "@/lib/flair/nucleos/deck";
import { codigoDaRota, mesclarDefinicao, NUCLEO_LISTA, NUCLEOS, rotaDoNucleo } from "@/lib/flair/nucleos/registry";
import { buildTabs } from "@/lib/flair/nucleos/selection";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";

/** Contrato: docs/flair/flair-3d/BASE_NUCLEOS.md (códigos, recursos, ações, deck e avatares). */
const CONTRATO = [
  "PASSARELA", "DRESS_FIGHTER", "DRESS_THE_STAR", "PERSONAGEM_FILME", "ROAD_TO_GLORY", "FASHION_DETECTIVE", "BOUTIQUE_3D",
  "CLUBE_CORACAO", "FAVORITE_SINGER", "LABIRINTO", "PILOTO_FAVORITO", "AROUND_THE_WORLD", "SUPER_HEROI", "FASHION_SPORTS", "BATALHA_LOOKS",
];
const DESFILE = ["PASSARELA", "BATALHA_LOOKS", "AROUND_THE_WORLD", "LABIRINTO", "DRESS_THE_STAR"];
const EDITOR = ["CLUBE_CORACAO", "FAVORITE_SINGER", "PILOTO_FAVORITO", "SUPER_HEROI"];
const card = (id: string, position: string): FlairCollectionCard => ({
  id, originType: "PIECE", originId: `p-${id}`, season: "SPRING", tier: "PRATA", ovr: 70, rare: false, position, name: id,
  priceVerified: true, state: "AVAILABLE", tradeable: true, acquiredVia: "GENERATED",
});

describe("registro dos 15 núcleos", () => {
  it("tem os 15 códigos do contrato, numerados de 1 a 15 na ordem", () => {
    expect(NUCLEO_LISTA.map((n) => n.codigo)).toEqual(CONTRATO);
    expect(NUCLEO_LISTA.map((n) => n.numero)).toEqual(CONTRATO.map((_, i) => i + 1));
  });

  it("recursos, ações e deck seguem as tabelas do contrato", () => {
    for (const n of NUCLEO_LISTA) {
      expect(n.acoes).toEqual(expect.arrayContaining(["NAVEGAR", "TROCAR_ABA", "APLICAR", "GIRAR", "ZOOM", "POSAR", "ENTREGAR", "OBJETIVO"]));
      expect(n.acoes.includes("DESFILAR")).toBe(DESFILE.includes(n.codigo));
      expect(n.acoes.includes("TIRAR")).toBe(n.recursos.includes("CARTAS"));
      expect(n.recursos.includes("ZONAS")).toBe(EDITOR.includes(n.codigo));
      expect(n.deck.semDeck).toBe(EDITOR.includes(n.codigo) || n.codigo === "ROAD_TO_GLORY");
    }
    expect(NUCLEOS.ROAD_TO_GLORY.recursos).toEqual(["CARTAS", "MAQUIAGEM"]);
    expect(NUCLEOS.PERSONAGEM_FILME.recursos).toContain("RESPOSTA");
    expect(NUCLEOS.PERSONAGEM_FILME.opcoes).toHaveLength(4);
    expect(NUCLEOS.DRESS_FIGHTER.automatico && NUCLEOS.FASHION_SPORTS.automatico).toBe(true);
    expect(NUCLEOS.PASSARELA.deck).toEqual({ tamanhoMax: 8, obrigatorias: [{ posicao: "SUP", quantidade: 1 }, { posicao: "INF", quantidade: 1 }, { posicao: "CAL", quantidade: 1 }], semDeck: false });
    expect(NUCLEOS.DRESS_FIGHTER.deck.tamanhoMax).toBe(6);
    expect(NUCLEOS.LABIRINTO.deck.obrigatorias).toEqual([{ posicao: "QUALQUER", quantidade: 3 }]);
  });

  it("personagens nunca ficam na frente da roupa: atrás (z ≤ 0) ou ao lado (|x| ≥ 1)", () => {
    for (const n of NUCLEO_LISTA) {
      for (const p of n.personagens) expect(p.pos[2] <= 0 || Math.abs(p.pos[0]) >= 1).toBe(true);
    }
    expect(NUCLEOS.FASHION_SPORTS.personagens.filter((p) => p.papel === "colega")).toHaveLength(4);
    expect(NUCLEOS.FASHION_SPORTS.personagens.filter((p) => p.papel === "adversario")).toHaveLength(5);
    expect(NUCLEOS.CLUBE_CORACAO.personagens).toHaveLength(0);
  });

  it("avatares: protagonista e figurantes por papel; online só como dado", () => {
    const a = avataresDoNucleo(NUCLEOS.FASHION_SPORTS);
    expect(a.solo).toEqual([{ tipo: "PROPRIO", papel: "protagonista", quantidade: 1 }, { tipo: "FIGURANTE", papel: "colega", quantidade: 4 }, { tipo: "FIGURANTE", papel: "adversario", quantidade: 5 }]);
    expect(a.online).toEqual({ min: 2, max: 10, porTime: 5 });
    expect(protagonistaEfetiva(["PROPRIO"], null, false)).toBe("MODELO_CASA");
    expect(protagonistaEfetiva(["PROPRIO"], null, true)).toBe("PROPRIO");
    expect(protagonistaEfetiva(["PROPRIO", "MODELO_CASA"], "MODELO_CASA", true)).toBe("MODELO_CASA");
    expect(protagonistaEfetiva(["MODELO_CASA", "PROPRIO"], null, true)).toBe("MODELO_CASA");
  });

  it("rotas e definição: código da URL, mescla com a API e listas vazias caindo no arquivo local", () => {
    expect(codigoDaRota("dress-fighter")).toBe("DRESS_FIGHTER");
    expect(codigoDaRota("../etc")).toBeNull();
    expect(rotaDoNucleo("BOUTIQUE_3D")).toBe("/flair/3d/boutique-3d");
    const d = mesclarDefinicao("PASSARELA", { vagas: [], objetivo: { codigo: "BRASIL", regras: [{ codigo: "MARCA_BR", pontos: 10 }] } });
    expect(d.vagas).toEqual(["SUP", "INF", "CAL", "ACE", "VES"]);
    expect(d.objetivo.codigo).toBe("BRASIL");
  });
});

describe("deck, abas, estado e comandos", () => {
  it("deck: obrigatórias, alternativas e tamanho máximo", () => {
    expect(posicoesDaRegra("SUP|VES")).toEqual(["SUP", "VES"]);
    expect(posicoesDaRegra("QUALQUER")).toEqual([]);
    const regras = NUCLEOS.PASSARELA.deck;
    expect(conferirDeck(regras, [card("a", "SUP"), card("b", "INF")]).valido).toBe(false);
    expect(conferirDeck(regras, [card("a", "SUP"), card("b", "INF")]).obrigatorias[2].falta).toBe(1);
    expect(conferirDeck(regras, [card("a", "SUP"), card("b", "INF"), card("c", "CAL")]).valido).toBe(true);
    expect(alternarCarta(["a", "b"], "c", 2)).toEqual(["a", "b"]);
    expect(alternarCarta(["a", "b"], "a", 2)).toEqual(["b"]);
  });

  it("abas: vagas com as cartas da posição, zonas com cores e acabamentos, áreas com a paleta", () => {
    const cartas = buildTabs(mesclarDefinicao("BOUTIQUE_3D"), [card("a", "SUP"), card("b", "INF")]);
    expect(cartas.map((t) => t.id)).toEqual(["SUP", "INF", "CAL"]);
    expect(cartas[0].items).toHaveLength(1);
    const zonas = buildTabs(mesclarDefinicao("PILOTO_FAVORITO"), []);
    expect(zonas.map((t) => t.id)).toEqual(["TOPO", "LATERAIS", "FAIXA_VISEIRA", "VISEIRA"]);
    expect(zonas[0].items.filter((i) => i.kind === "acabamento").map((i) => i.kind === "acabamento" && i.codigo)).toEqual(["FOSCO", "BRILHANTE", "METALICO", "ESPELHADO"]);
    const maq = buildTabs(mesclarDefinicao("ROAD_TO_GLORY"), []);
    expect(maq.map((t) => t.id)).toEqual(["SUP", "INF", "CAL", "ACE", "LABIOS", "OLHOS", "BOCHECHAS"]);
  });

  it("estado: navegar, trocar aba, aplicar, tirar, girar, zoom limitado, posar, desfilar e objetivo", () => {
    const tabs = buildTabs(mesclarDefinicao("CLUBE_CORACAO"), []);
    let s = boardInicial(2, -1);
    const cmd = (c: BoardAcao) => (s = boardReducer(s, c));
    cmd({ type: "comando", comando: { acao: "NAVEGAR", dir: 1, eixo: "x" }, tabs });
    cmd({ type: "comando", comando: { acao: "APLICAR" }, tabs });
    expect(s.sel.zonas.CORPO).toEqual({ cor: "#F5F4F0" });
    cmd({ type: "comando", comando: { acao: "NAVEGAR", dir: 1, eixo: "y" }, tabs });
    expect(s.item).toBe(5);
    cmd({ type: "comando", comando: { acao: "TROCAR_ABA", dir: -1 }, tabs });
    expect(s.aba).toBe(3);
    cmd({ type: "comando", comando: { acao: "TIRAR" }, tabs });
    cmd({ type: "comando", comando: { acao: "GIRAR", dir: -1 }, tabs });
    expect(s.avatar.giro).toBe(330);
    for (let i = 0; i < 5; i++) cmd({ type: "comando", comando: { acao: "ZOOM", dir: 1 }, tabs });
    expect(s.avatar.zoom).toBe(2);
    cmd({ type: "comando", comando: { acao: "POSAR" }, tabs });
    cmd({ type: "comando", comando: { acao: "DESFILAR" }, tabs });
    cmd({ type: "comando", comando: { acao: "OBJETIVO" }, tabs });
    expect(s.avatar).toMatchObject({ poses: 1, desfilando: true });
    expect(s.objetivo).toBe(true);
  });

  it("teclado e gamepad (layout padrão) viram as ações do contrato", () => {
    expect(comandoDaTecla("Q")).toEqual({ acao: "TROCAR_ABA", dir: -1 });
    expect(comandoDaTecla(" ")).toEqual({ acao: "APLICAR" });
    expect(comandoDaTecla("Enter")).toEqual({ acao: "ENTREGAR" });
    expect(comandoDaTecla("x")).toBeNull();
    const pad = (pressed: number[], axes = [0, 0, 0, 0]) => ({ buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })), axes });
    const r1 = lerGamepad(pad([0, 9]), PAD_INICIAL, 0);
    expect(r1.comandos.map((c) => c.acao)).toEqual(["APLICAR", "ENTREGAR"]);
    expect(lerGamepad(pad([0, 9]), r1.estado, 16).comandos).toEqual([]);
    const giro = lerGamepad(pad([], [0, 0, 0.9, 0]), PAD_INICIAL, 1000);
    expect(giro.comandos).toEqual([{ acao: "GIRAR", dir: 1 }]);
    expect(lerGamepad(pad([], [0, 0, 0.9, 0]), giro.estado, 1050).comandos).toEqual([]);
  });
});
