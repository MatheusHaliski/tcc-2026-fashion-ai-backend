import { describe, expect, it } from "vitest";
import { NUCLEOS } from "@/lib/flair/nucleos/registry";
import { NUCLEO_CODIGOS } from "@/lib/flair/nucleos/types";
import { estourosDoOrcamento, figurantesDaCena, orcamentoDaSala, partesDaSala } from "@/lib/flair/nucleos/scene/budget";
import { partesDoFigurante } from "@/lib/flair/nucleos/scene/figurantes";
import { partesNoLugar, triangulosDaParte } from "@/lib/flair/nucleos/scene/parts";
import { SALAS, VARIANTES, salaDe } from "@/lib/flair/nucleos/scene/registry";
import { cascaDaSala } from "@/lib/flair/nucleos/scene/shell";
import { ORCAMENTO } from "@/lib/flair/nucleos/scene/types";
import { cobreRoupa, limiteDaCamera, movelNaZona, partesQueCobremRoupa, personagemNaZona, zonaContem, zonaInvadeRoupa } from "@/lib/flair/nucleos/scene/zones";

/**
 * Cenário de cada jogo (DESENHO_DA_TELA.md, seção 3): sala delimitada, as três zonas, móveis da tabela, materiais
 * com textura e o orçamento de triângulos, materiais, texturas e luzes.
 */
const tipos = (codigo: (typeof NUCLEO_CODIGOS)[number]) => new Set(SALAS[codigo].moveis.map((m) => m.tipo));

describe("salas", () => {
  it("há uma sala para cada um dos 15 jogos, com o próprio código", () => {
    expect(Object.keys(SALAS).sort()).toEqual([...NUCLEO_CODIGOS].sort());
    for (const codigo of NUCLEO_CODIGOS) expect(SALAS[codigo].codigo).toBe(codigo);
  });

  it("sala delimitada: piso, três paredes (quatro no labirinto) e teto ou céu, até atrás da câmera", () => {
    for (const codigo of NUCLEO_CODIGOS) {
      const sala = SALAS[codigo];
      const casca = cascaDaSala(sala);
      const planos = casca.filter((p) => p.forma === "plano");
      expect(planos.length).toBe(sala.fechamento === "quatro_paredes" ? 6 : 5);
      for (const p of casca) expect(sala.materiais[p.mat], `${codigo}: ${p.mat}`).toBeDefined();
      // a câmera fica dentro da casca: o piso, as laterais e a cobertura passam dela
      expect(sala.dim.frente).toBeGreaterThan(limiteDaCamera(sala));
      expect(sala.dim.altura).toBeGreaterThanOrEqual(3);
    }
    expect(SALAS.LABIRINTO.fechamento).toBe("quatro_paredes");
    expect(SALAS.LABIRINTO.dim.largura).toBe(SALAS.LABIRINTO.dim.fundo + SALAS.LABIRINTO.dim.frente);
    for (const codigo of ["DRESS_FIGHTER", "AROUND_THE_WORLD", "SUPER_HEROI"] as const) expect(SALAS[codigo].cobertura).toBe("ceu");
  });

  it("zonas: avatar, personagens e decoração existem; as duas últimas nunca invadem a zona da roupa", () => {
    for (const codigo of NUCLEO_CODIGOS) {
      const sala = SALAS[codigo];
      const ate = limiteDaCamera(sala);
      expect(zonaContem(sala.zonas.avatar, 0, 0), codigo).toBe(true);
      expect(sala.zonas.personagens.length, codigo).toBeGreaterThan(0);
      expect(sala.zonas.decoracao.length, codigo).toBeGreaterThan(0);
      for (const z of [...sala.zonas.personagens, ...sala.zonas.decoracao]) expect(zonaInvadeRoupa(z, ate), `${codigo} ${JSON.stringify(z)}`).toBe(false);
      // a zona do avatar tem marca no piso (tablado, tapete, marca ou passarela)
      expect(sala.moveis.some((m) => m.zona === "avatar"), codigo).toBe(true);
    }
  });

  it("cada móvel fica na zona dele e nenhuma parte alta cobre a roupa", () => {
    for (const codigo of NUCLEO_CODIGOS) {
      const sala = SALAS[codigo];
      for (const m of sala.moveis) {
        expect(movelNaZona(sala, m), `${codigo}: ${m.tipo} em ${m.pos}`).toBe(true);
        if (m.zona !== "avatar") expect(partesQueCobremRoupa(m, limiteDaCamera(sala)), `${codigo}: ${m.tipo}`).toBe(0);
      }
    }
  });

  it("figurantes ficam na zona dos personagens, atrás ou ao lado do avatar", () => {
    for (const codigo of NUCLEO_CODIGOS) {
      const sala = SALAS[codigo];
      for (const p of figurantesDaCena(sala, NUCLEOS[codigo].personagens)) {
        expect(personagemNaZona(sala, p), `${codigo}: ${p.papel} em ${p.pos}`).toBe(true);
        expect(cobreRoupa(p.pos[0], p.pos[2], 0.2, 0.2, limiteDaCamera(sala)), `${codigo}: ${p.papel}`).toBe(false);
      }
    }
  });

  it("móveis e objetos da tabela de cada jogo", () => {
    const esperado: Record<string, string[]> = {
      PASSARELA: ["passarela", "cadeira", "painelLed", "trilhoSpots"],
      DRESS_FIGHTER: ["ringue", "calcada", "neon", "grade", "caixote"],
      DRESS_THE_STAR: ["passarela", "marcaNoPiso", "telao", "cortina", "canhaoLuz"],
      PERSONAGEM_FILME: ["cenarioDeTresParedes", "cameraTripe", "refletor", "cadeiraDiretor", "claquete"],
      ROAD_TO_GLORY: ["espelho", "bancoEstofado", "arara", "logo"],
      FASHION_DETECTIVE: ["portal", "folhaPorta", "cordao", "tapete", "vasoAlto", "lustre"],
      BOUTIQUE_3D: ["arara", "balcao", "espelho", "poltrona", "cabineProvador", "vitrine"],
      LABIRINTO: ["espelho", "portal", "folhaPorta", "marcaNoPiso"],
      AROUND_THE_WORLD: ["faixa", "bancoRua", "poste", "fachadaVitrine", "placaRegiao", "mapa"],
      FASHION_SPORTS: ["linhasDaQuadra", "trave", "painelLed", "redeProtecao", "arquibancada", "bancoReservas"],
      BATALHA_LOOKS: ["passarelaEmY", "pontoDePose", "painelLed", "trilhoSpots", "cadeira"],
      CLUBE_CORACAO: ["arquibancada"],
      FAVORITE_SINGER: ["palcoPequeno"],
      PILOTO_FAVORITO: ["pilhaDePneus", "armarioFerramentas", "capaceteNoSuporte"],
      SUPER_HEROI: ["parapeito", "predio", "capa"],
    };
    for (const [codigo, moveis] of Object.entries(esperado)) {
      for (const m of moveis) expect(tipos(codigo as (typeof NUCLEO_CODIGOS)[number]).has(m), `${codigo}: ${m}`).toBe(true);
    }
    // os quatro modos do editor dividem o ateliê: bancada, rolos, luminária e o tablado giratório
    for (const codigo of ["CLUBE_CORACAO", "FAVORITE_SINGER", "PILOTO_FAVORITO", "SUPER_HEROI"] as const) {
      for (const m of ["bancada", "rolosDeTecido", "luminaria", "tablado"]) expect(tipos(codigo).has(m), `${codigo}: ${m}`).toBe(true);
      expect(SALAS[codigo].zonas.avatar.marca).toBe("tablado");
    }
    expect(SALAS.LABIRINTO.moveis.filter((m) => m.tipo === "espelho")).toHaveLength(4);
    expect(SALAS.LABIRINTO.moveis.filter((m) => m.tipo === "folhaPorta")).toHaveLength(4);
    expect(SALAS.BATALHA_LOOKS.moveis.filter((m) => m.tipo === "pontoDePose")).toHaveLength(2);
  });

  it("materiais: nenhum sem textura a não ser vidro, espelho, luz e tinta; texturas de até 1024 px", () => {
    for (const codigo of NUCLEO_CODIGOS) {
      const sala = SALAS[codigo];
      const usados = new Set(partesDaSala(sala).map((p) => p.mat));
      for (const id of usados) {
        const m = sala.materiais[id];
        expect(m, `${codigo}: material ${id}`).toBeDefined();
        expect(m.px).toBeLessThanOrEqual(ORCAMENTO.texturaPx);
        if (m.px === 0) expect(m.textura).toBe("liso");
        else expect(m.textura).not.toBe("liso");
        expect(m.rugosidade).toBeGreaterThan(0);
      }
      // nada de material declarado e não usado
      for (const id of Object.keys(sala.materiais)) expect(usados.has(id), `${codigo}: ${id} sem uso`).toBe(true);
      // piso e parede sempre com textura
      expect(sala.materiais[sala.casca.piso].px).toBeGreaterThan(0);
      expect(sala.materiais[sala.casca.parede].px).toBeGreaterThan(0);
    }
  });

  it("luz: principal de frente, recorte por trás e a luz própria do lugar", () => {
    for (const codigo of NUCLEO_CODIGOS) {
      const { principal, recorte, proprias } = SALAS[codigo].luzes;
      expect(principal.pos[2], codigo).toBeGreaterThan(0);
      expect(recorte.pos[2], codigo).toBeLessThan(0);
      expect(proprias.some((l) => !l.apagada), codigo).toBe(true);
      expect(new Set(proprias.map((l) => l.id)).size).toBe(proprias.length);
    }
  });
});

describe("salas que mudam dentro do jogo", () => {
  const variantes = Object.entries(VARIANTES).flatMap(([codigo, salas]) => Object.entries(salas ?? {}).map(([v, sala]) => ({ codigo: codigo as (typeof NUCLEO_CODIGOS)[number], v, sala })));

  it("salaDe devolve a sala da variante e, sem variante conhecida, a do registro", () => {
    expect(salaDe("FASHION_DETECTIVE", "CAMARIM")).not.toBe(SALAS.FASHION_DETECTIVE);
    expect(salaDe("FASHION_DETECTIVE", "ENTRADA_DA_GALA")).toBe(SALAS.FASHION_DETECTIVE);
    expect(salaDe("FASHION_DETECTIVE", "PORAO")).toBe(SALAS.FASHION_DETECTIVE);
    expect(salaDe("PASSARELA", "CAMARIM")).toBe(SALAS.PASSARELA);
    expect(salaDe("FASHION_SPORTS", "FUTEBOL")).toBe(SALAS.FASHION_SPORTS);
    expect(salaDe("FASHION_SPORTS", "VOLEI").moveis.some((m) => m.tipo === "trave")).toBe(false);
    expect(salaDe("FASHION_SPORTS", null).moveis.filter((m) => m.tipo === "trave")).toHaveLength(2);
    expect(Object.keys(VARIANTES.FASHION_SPORTS ?? {})).toEqual(["FUTEBOL", "BASQUETE", "VOLEI", "TENIS", "CORRIDA", "SKATE"]);
    expect(Object.keys(VARIANTES.FASHION_DETECTIVE ?? {})).toEqual(["ENTRADA_DA_GALA", "SALAO_PRINCIPAL", "CAMARIM", "CLUBE_UNDERGROUND", "ATELIE", "ARQUIVO"]);
  });

  it("cada variante segue as regras das salas: zonas, materiais com uso e textura, orçamento e objetos com id", () => {
    expect(variantes.length).toBeGreaterThan(5);
    for (const { codigo, v, sala } of variantes) {
      const nome = `${codigo}/${v}`;
      const base = SALAS[codigo];
      expect(sala.codigo).toBe(codigo);
      expect(sala.zonas).toEqual(base.zonas);
      expect(sala.moveis.some((m) => m.zona === "avatar"), nome).toBe(true);
      for (const m of sala.moveis) {
        expect(movelNaZona(sala, m), `${nome}: ${m.tipo} em ${m.pos}`).toBe(true);
        if (m.zona !== "avatar") expect(partesQueCobremRoupa(m, limiteDaCamera(sala)), `${nome}: ${m.tipo}`).toBe(0);
      }
      const usados = new Set(partesDaSala(sala).map((p) => p.mat));
      for (const id of usados) expect(sala.materiais[id], `${nome}: material ${id}`).toBeDefined();
      for (const id of Object.keys(sala.materiais)) expect(usados.has(id), `${nome}: ${id} sem uso`).toBe(true);
      expect(sala.materiais[sala.casca.piso].px).toBeGreaterThan(0);
      expect(estourosDoOrcamento(orcamentoDaSala(sala, NUCLEOS[codigo].personagens)), nome).toEqual([]);
      // os objetos que a animação procura pelo id continuam na sala
      expect(sala.placar).toEqual(base.placar);
      const ids = (s: typeof sala) => s.moveis.map((m) => m.id).filter(Boolean).sort();
      expect(ids(sala), nome).toEqual(ids(base));
      expect(sala.luzes.proprias.map((l) => l.id)).toEqual(base.luzes.proprias.map((l) => l.id));
    }
  });
});

describe("orçamento", () => {
  it("conta de triângulos por forma", () => {
    const partes = partesNoLugar(SALAS.PASSARELA.moveis[0]);
    expect(partes.map(triangulosDaParte)).toEqual([44, 12, 12, 12]);
    expect(partesDoFigurante("busto").length).toBeLessThan(partesDoFigurante("em_pe").length);
  });

  it("cada sala cabe em 60 mil triângulos, 12 materiais, texturas de 1024 px e 3 luzes próprias", () => {
    const tabela: Record<string, string> = {};
    for (const codigo of NUCLEO_CODIGOS) {
      const o = orcamentoDaSala(SALAS[codigo], NUCLEOS[codigo].personagens);
      tabela[codigo] = `${o.triangulos} tri, ${o.materiais} mat, ${o.texturaPx} px, ${o.luzesProprias} luzes`;
      expect(estourosDoOrcamento(o), `${codigo}: ${tabela[codigo]}`).toEqual([]);
      expect(o.triangulos).toBeGreaterThan(500);
    }
    console.info(tabela);
  });

  it("estouros aparecem pelo nome", () => {
    expect(estourosDoOrcamento({ triangulos: 60001, materiais: 13, texturaPx: 2048, luzesProprias: 4 })).toEqual(["triangulos", "materiais", "textura", "luzes"]);
  });
});
