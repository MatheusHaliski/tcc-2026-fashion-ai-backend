import { describe, expect, it } from "vitest";
import { ARMARIO_1, ARMARIO_2, ARVORE, movel, compartimento } from "@/test-utils/acervo";
import { iniciarArrasto, lerArrasto, temArrasto } from "./arrasto";
import { acharCompartimento, caminhoDe, comPecasMovidas, destinos, filtrar, marcadoresPorCompartimento, ordenar, pecasDoLocal } from "./arvore";
import { encaixeDaRoupa, encaixeDoPuxador, glbDoEncaixe, lerManifestoDoAcervo } from "./cena/assets";
import { enquadrar } from "./cena/camera";
import { materiaisDoMovel } from "./cena/materiais";
import { cursoDaGaveta, modeloDoMovel, volumeDaCelula } from "./cena/modelo";
import { roupasDaCelula } from "./cena/roupas";
import { movelPadrao } from "./opcoes";
import { ladoALado, larguraTotal, plantaDoMovel } from "./planta";

describe("árvore do acervo", () => {
  it("acha o compartimento, monta o caminho e lista as peças de cada lugar", () => {
    expect(acharCompartimento(ARVORE, "c-gav1")?.movel.nome).toBe("Armário 01");
    expect(caminhoDe(ARVORE, "c-gav1")).toBe("Closet principal / Armário 01 / Gaveta 01");
    expect(caminhoDe(ARVORE, "nao-existe")).toBeNull();
    expect(pecasDoLocal(ARVORE, { tipo: "COMPARTIMENTO", id: "c-gav1" }).map((p) => p.id)).toEqual(["p2", "p3"]);
    expect(pecasDoLocal(ARVORE, { tipo: "SEM_LUGAR" }).map((p) => p.id)).toEqual(["p4"]);
    expect(pecasDoLocal(ARVORE, { tipo: "TODAS" })).toHaveLength(4);
    expect(destinos(ARVORE)).toHaveLength(5);
  });

  it("filtra favoritas e em uso e ordena por nome e por preço", () => {
    expect(filtrar(ARVORE.pecas, "FAVORITAS").map((p) => p.id)).toEqual(["p1"]);
    expect(filtrar(ARVORE.pecas, "EM_USO").map((p) => p.id)).toEqual(["p1"]);
    expect(ordenar(ARVORE.pecas, "NOME", "pt-BR").map((p) => p.id)).toEqual(["p4", "p2", "p3", "p1"]);
    expect(ordenar(ARVORE.pecas, "PRECO", "pt-BR").map((p) => p.id)).toEqual(["p1", "p3", "p2", "p4"]);
    expect(ordenar(ARVORE.pecas, "RECENTES", "pt-BR")).toBe(ARVORE.pecas);
  });

  it("mover uma peça refaz as contagens do compartimento, do móvel, do ambiente e das sem lugar", () => {
    const depois = comPecasMovidas(ARVORE, ["p4", "p2"], "c-gav2");
    const armario = depois.ambientes[0].moveis[0];
    expect(armario.compartimentos.map((c) => `${c.id}:${c.pecas}`)).toEqual(["c-cab:1", "c-pra:0", "c-gav1:1", "c-gav2:2"]);
    expect(armario.pecas).toBe(4);
    expect(depois.ambientes[0].pecas).toBe(4);
    expect(depois.semLugar).toBe(0);
    expect(depois.pecas.find((p) => p.id === "p4")?.caminho).toBe("Closet principal / Armário 01 / Gaveta 02");
    expect(comPecasMovidas(depois, ["p4"], null).semLugar).toBe(1);
    expect(ARVORE.semLugar).toBe(1);
  });

  it("os marcadores numeram as peças marcadas e caem no compartimento de cada uma", () => {
    const porCompartimento = marcadoresPorCompartimento(ARVORE, ["p3", "p1", "p4", "p2"]);
    expect(porCompartimento.get("c-gav1")).toEqual([1, 4]);
    expect(porCompartimento.get("c-cab")).toEqual([2]);
    expect(porCompartimento.size).toBe(2);
  });
});

describe("planta e móvel procedural", () => {
  it("gavetas ficam embaixo, cabideiro à esquerda e prateleiras à direita, tudo dentro do móvel", () => {
    const planta = plantaDoMovel(ARMARIO_1);
    const por = Object.fromEntries(planta.celulas.map((c) => [c.id, c]));
    expect(por["c-gav2"].y).toBeLessThan(por["c-gav1"].y);
    expect(por["c-gav1"].y + por["c-gav1"].h).toBeCloseTo(por["c-cab"].y);
    expect(por["c-cab"].x + por["c-cab"].w).toBeCloseTo(por["c-pra"].x);
    for (const c of planta.celulas) {
      expect(c.x).toBeGreaterThanOrEqual(planta.chapa);
      expect(c.x + c.w).toBeLessThanOrEqual(planta.largura - planta.chapa + 0.001);
      expect(c.y + c.h).toBeLessThanOrEqual(planta.altura - planta.chapa + 0.001);
    }
    expect(plantaDoMovel(movel("vazio", "Vazio", [])).celulas).toEqual([]);
  });

  it("móveis lado a lado não se sobrepõem", () => {
    const lado = ladoALado([ARMARIO_1, ARMARIO_2]);
    expect(lado[1].x).toBe(124);
    expect(larguraTotal([ARMARIO_1, ARMARIO_2])).toBe(244);
  });

  it("o modelo tem carcaça, cabideiro, gavetas com puxador e luz; a configuração muda as partes", () => {
    const modelo = modeloDoMovel(ARMARIO_1);
    const papeis = (m = modelo) => m.partes.map((p) => p.papel);
    expect(papeis().filter((p) => p === "carcaca")).toHaveLength(4);
    expect(papeis()).toContain("rodape");
    expect(modelo.partes.filter((p) => p.papel === "cabideiro" && p.forma === "cilindro")).toHaveLength(1);
    expect(modelo.partes.filter((p) => p.id.startsWith("gaveta-")).map((p) => p.compartimentoId)).toEqual(["c-gav1", "c-gav2"]);
    expect(modelo.partes.filter((p) => p.papel === "puxador")).toHaveLength(2);
    expect(papeis()).not.toContain("porta");
    expect(modelo.elevacao).toBe(0);

    const comPorta = modeloDoMovel({ ...ARMARIO_1, porta: "CORRER", puxador: "SEM_PUXADOR" });
    expect(comPorta.partes.filter((p) => p.papel === "porta")).toHaveLength(2);
    expect(papeis(comPorta)).not.toContain("puxador");

    const dream = modeloDoMovel({ ...ARMARIO_1, modo: "DREAM_SPACE" });
    expect(dream.elevacao).toBeGreaterThan(0);
    expect(papeis(dream)).not.toContain("rodape");
    expect(dream.partes.filter((p) => p.papel === "luz").length).toBeGreaterThan(modelo.partes.filter((p) => p.papel === "luz").length);

    const mais = modeloDoMovel({ ...ARMARIO_1, larguraCm: 240, compartimentos: [...ARMARIO_1.compartimentos, compartimento("c-gav3", "m1", "GAVETA", "Gaveta 03", 4)] });
    expect(mais.partes.filter((p) => p.id.startsWith("gaveta-"))).toHaveLength(3);
    expect(mais.partes.find((p) => p.id === "tampo")?.tam[0]).toBeCloseTo(2.34);
  });

  it("o alvo de cada compartimento cabe no vão e a gaveta abre para a frente", () => {
    const planta = plantaDoMovel(ARMARIO_1);
    const volume = volumeDaCelula(planta, planta.celulas[0]);
    expect(volume.tam[0]).toBeCloseTo(planta.celulas[0].w / 100);
    expect(volume.pos[2]).toBeLessThan(0);
    expect(cursoDaGaveta(planta)).toBeCloseTo(0.42);
  });

  it("materiais: madeira com veio, vidro translúcido, Raio-X deixa a porta quase invisível", () => {
    const madeira = materiaisDoMovel(ARMARIO_1, false);
    expect(madeira.corpo).toMatchObject({ textura: "madeira", cor: "#7A5236", cor2: "#5A3A24" });
    expect(madeira.puxador.cor).toBe("#B8914A");
    expect(materiaisDoMovel({ ...ARMARIO_1, material: "VIDRO" }, false).corpo.opacidade).toBeLessThan(0.5);
    expect(materiaisDoMovel({ ...ARMARIO_1, material: "LACA", cor: "BRANCO" }, false).corpo).toMatchObject({ textura: "laca", cor: "#F6F5F1" });
    expect(materiaisDoMovel({ ...ARMARIO_2 }, false).porta.opacidade).toBeUndefined();
    expect(materiaisDoMovel({ ...ARMARIO_2 }, true).porta.opacidade).toBeCloseTo(0.12);
    expect(materiaisDoMovel({ ...ARMARIO_1, modo: "DREAM_SPACE" }, false).luz.emissiva).toBeGreaterThan(madeira.luz.emissiva ?? 0);
  });
});

describe("peças na cena", () => {
  const planta = plantaDoMovel(ARMARIO_1);
  const celula = (id: string) => planta.celulas.find((c) => c.id === id)!;
  const itens = (n: number, categoria = "upper_piece") => Array.from({ length: n }, (_, i) => ({ id: `x${i}`, categoria, cor: "#123456" }));

  it("penduradas ficam abaixo do cabideiro, lado a lado, dentro do vão", () => {
    const c = celula("c-cab");
    const roupas = roupasDaCelula(planta, c, itens(4));
    expect(roupas).toHaveLength(4);
    expect(roupas[1].pos[0]).toBeGreaterThan(roupas[0].pos[0]);
    for (const r of roupas) {
      expect(r.pos[1] + r.tam[1] / 2).toBeLessThan((c.y + c.h) / 100);
      expect(r.pos[1] - r.tam[1] / 2).toBeGreaterThan(c.y / 100);
      expect(r.pos[0]).toBeGreaterThan(c.x / 100);
      expect(r.pos[0]).toBeLessThan((c.x + c.w) / 100);
    }
    expect(roupasDaCelula(planta, c, itens(200)).length).toBeLessThan(200);
  });

  it("dobradas empilham na prateleira; na gaveta ficam em fileiras baixas; fantasma mantém a marca", () => {
    const pilha = roupasDaCelula(planta, celula("c-pra"), itens(3));
    expect(new Set(pilha.map((r) => r.pos[1])).size).toBeGreaterThan(1);
    const gaveta = roupasDaCelula(planta, celula("c-gav1"), [...itens(2), { id: "d1", categoria: "shoes_piece", cor: "#DDF247", fantasma: true }]);
    expect(gaveta.map((r) => r.fantasma)).toEqual([false, false, true]);
    expect(gaveta.every((r) => r.pos[1] < (celula("c-gav1").y + celula("c-gav1").h) / 100)).toBe(true);
    expect(roupasDaCelula(planta, celula("c-pra"), [])).toEqual([]);
  });
});

describe("câmera, GLB e arrasto", () => {
  it("a vista frontal fica de frente para o centro e a perspectiva vem de lado e de cima", () => {
    const frontal = enquadrar(2.4, 2.2, "FRONTAL", 16 / 9);
    const perspectiva = enquadrar(2.4, 2.2, "PERSPECTIVA", 16 / 9);
    expect(frontal.posicao[0]).toBeCloseTo(1.2);
    expect(perspectiva.posicao[0]).toBeGreaterThan(frontal.posicao[0]);
    expect(perspectiva.posicao[1]).toBeGreaterThan(frontal.posicao[1]);
    expect(enquadrar(2.4, 2.2, "FRONTAL", 0.46).posicao[2]).toBeGreaterThan(frontal.posicao[2]);
  });

  it("sem manifesto tudo é procedural; com um GLB no encaixe, ele é o escolhido", () => {
    expect(glbDoEncaixe("roupa-pendurada", [])).toBeNull();
    const manifesto = lerManifestoDoAcervo([{ slug: "cabide-camisa", movel: "roupa-pendurada", triangles: 900 }, { slug: "sofa", triangles: 10 }]);
    expect(manifesto).toHaveLength(1);
    expect(glbDoEncaixe("roupa-pendurada", manifesto)?.slug).toBe("cabide-camisa");
    expect(glbDoEncaixe("calcado", manifesto)).toBeNull();
    expect(encaixeDaRoupa("shoes_piece", false)).toBe("calcado");
    expect(encaixeDaRoupa("upper_piece", true)).toBe("roupa-pendurada");
    expect(encaixeDoPuxador("SEM_PUXADOR")).toBeNull();
  });

  it("o arrasto leva os ids das peças e ignora o que não veio do acervo", () => {
    const dados = new Map<string, string>();
    const dataTransfer = { setData: (k: string, v: string) => { dados.set(k, v); }, getData: (k: string) => dados.get(k) ?? "", get types() { return [...dados.keys()]; }, effectAllowed: "", dropEffect: "" };
    expect(temArrasto({ dataTransfer })).toBe(false);
    iniciarArrasto({ dataTransfer }, ["p1", "p2"]);
    expect(temArrasto({ dataTransfer })).toBe(true);
    expect(lerArrasto({ dataTransfer })).toEqual(["p1", "p2"]);
    expect(lerArrasto({ dataTransfer: null })).toEqual([]);
  });

  it("o móvel novo do Dream Space nasce de vidro, com porta de vidro", () => {
    expect(movelPadrao("DREAM_SPACE", "Módulo 1")).toMatchObject({ modo: "DREAM_SPACE", material: "VIDRO", porta: "VIDRO" });
    expect(movelPadrao("MEU_ESPACO", "Armário 01")).toMatchObject({ material: "MADEIRA", cor: "NOGUEIRA", puxadorAcabamento: "LATAO" });
  });
});
