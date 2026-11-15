import { describe, expect, it } from "vitest";
import ptBR from "@/lib/i18n/messages/pt-BR.json";
import { NUCLEOS } from "@/lib/flair/nucleos/registry";
import { figurantesDaCena } from "@/lib/flair/nucleos/scene/budget";
import { CLIPS } from "@/lib/flair/nucleos/scene/clips/index";
import { duracaoDaSequencia, quadroParado } from "@/lib/flair/nucleos/scene/director";
import { SALAS } from "@/lib/flair/nucleos/scene/registry";
import { EFEITOS_DE_COR, LUZ_DE_EFEITO, nomeDoEfeito, sequenciaDaCor } from "@/lib/flair/nucleos/scene/sequences-color";
import { ORCAMENTO } from "@/lib/flair/nucleos/scene/types";
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";

/**
 * A tabela do servidor (Flair3dCores.DE_CENA; docs/flair/flair-3d/CORES_E_ACOES.md, seção 2-A): os 9 jogos de cartas
 * além do esporte e do detetive, 6 efeitos cada, na ordem preto, verde, amarelo, azul, vermelho, branco.
 */
const DO_SERVIDOR: Partial<Record<NucleoCodigo, string[]>> = {
  PASSARELA: ["SILHUETA", "BRISA", "HOLOFOTE", "FLASHES", "APLAUSOS", "PASSARELA_ACESA"],
  DRESS_FIGHTER: ["GUARDA", "ESQUIVA", "GOLPE_RAPIDO", "FOLEGO", "GOLPE_FORTE", "FOCO"],
  DRESS_THE_STAR: ["ELEGANCIA", "FRESCOR", "BRILHO", "SERENIDADE", "TAPETE_VERMELHO", "FLASH_FOTOGRAFOS"],
  PERSONAGEM_FILME: ["SUSPENSE", "AVENTURA", "COMEDIA", "FICCAO", "ROMANCE", "CLAQUETE"],
  ROAD_TO_GLORY: ["CONTRASTE", "NATURAL", "LUZ_DOURADA", "LUZ_FRIA", "DESTAQUE", "REBATEDOR"],
  BOUTIQUE_3D: ["VITRINE_NOITE", "ETIQUETA", "PLACA_DESTAQUE", "CLIENTE_OLHA", "CLIENTE_SORRI", "VITRINE_ACESA"],
  LABIRINTO: ["SOMBRA", "TRILHA", "LANTERNA", "REFLEXO", "ALERTA", "CLARAO"],
  AROUND_THE_WORLD: ["NOITE_NA_CIDADE", "PARQUE", "SOL", "MAR", "FESTA_DE_RUA", "INVERNO"],
  BATALHA_LOOKS: ["IMPACTO", "VIBRACAO", "FAISCAS", "ONDA", "CHAMAS", "ESTROBO"],
};

const jogos = Object.keys(DO_SERVIDOR) as NucleoCodigo[];

describe("efeito de cena da cor da peça", () => {
  it.each(jogos)("%s: cada um dos 6 efeitos do servidor tem cena e texto", (codigo) => {
    expect(Object.keys(EFEITOS_DE_COR[codigo] ?? {}).sort()).toEqual([...(DO_SERVIDOR[codigo] ?? [])].sort());
    for (const nome of DO_SERVIDOR[codigo] ?? []) {
      expect(sequenciaDaCor(codigo, `COR_${nome}`)?.passos.length).toBeGreaterThan(0);
      expect(ptBR).toHaveProperty([`flair3d.ui.efeito.COR_${nome}`]);
    }
  });

  it.each(jogos)("%s: os atores existem na sala, os clipes existem e o efeito cabe em 4 segundos", (codigo) => {
    const sala = SALAS[codigo];
    const luzes = new Set([LUZ_DE_EFEITO, ...sala.luzes.proprias.map((l) => l.id)]);
    const moveis = new Set(sala.moveis.map((m) => m.id).filter(Boolean));
    const papeis = new Set(figurantesDaCena(sala, NUCLEOS[codigo].personagens).map((p) => p.papel));
    for (const nome of DO_SERVIDOR[codigo] ?? []) {
      const seq = sequenciaDaCor(codigo, `COR_${nome}`);
      if (!seq) throw new Error(`sem sequência: ${codigo} ${nome}`);
      expect(duracaoDaSequencia(seq)).toBeLessThanOrEqual(ORCAMENTO.clipSegundos);
      // toda sequência acende a luz de efeito, que fica atrás do avatar: a roupa nunca é coberta
      expect(seq.passos.some((p) => p.ator === `luz:${LUZ_DE_EFEITO}`)).toBe(true);
      for (const p of seq.passos) {
        expect(CLIPS[p.clip], `${codigo} ${nome}: clipe ${p.clip}`).toBeTruthy();
        const [tipo, id] = p.ator.split(":");
        if (tipo === "luz") expect(luzes.has(id), `${codigo} ${nome}: luz ${id}`).toBe(true);
        if (tipo === "movel") expect(moveis.has(id), `${codigo} ${nome}: móvel ${id}`).toBe(true);
        if (tipo === "fig") expect(papeis.has(id), `${codigo} ${nome}: figurante ${id}`).toBe(true);
        // ninguém anda no efeito de cor: o avatar e os figurantes ficam no lugar
        expect(p.mover).toBeUndefined();
      }
    }
  });

  it("com reduzir movimento, o efeito vira um quadro parado: um passo por ator, todos no instante zero", () => {
    const seq = sequenciaDaCor("PASSARELA", "COR_FLASHES");
    if (!seq) throw new Error("sem sequência");
    const parado = quadroParado(seq);
    expect(parado.passos.every((p) => p.inicio === 0)).toBe(true);
    expect(new Set(parado.passos.map((p) => p.ator)).size).toBe(parado.passos.length);
  });

  it("nenhum clipe de luz pisca mais de 3 vezes por segundo", () => {
    for (const id of ["L_FLASH", "L_ONDULA", "L_ACENDE", "L_RASTRO"]) {
      const trilha = CLIPS[id].trilhas[0];
      const picos = trilha.chaves.filter(([, v], i, todas) => i > 0 && i < todas.length - 1 && v > todas[i - 1][1] && v >= todas[i + 1][1]).length;
      expect(picos / CLIPS[id].duracao, id).toBeLessThanOrEqual(3);
    }
  });

  it("código que não é efeito de cena (ação do esporte, jogo sem tabela) não tem sequência", () => {
    expect(nomeDoEfeito("ACAO_CHUTE")).toBeNull();
    expect(sequenciaDaCor("PASSARELA", "ACAO_CHUTE")).toBeNull();
    expect(sequenciaDaCor("FASHION_SPORTS", "COR_FLASHES")).toBeNull();
    expect(sequenciaDaCor("PASSARELA", "COR_QUE_NAO_EXISTE")).toBeNull();
  });
});
