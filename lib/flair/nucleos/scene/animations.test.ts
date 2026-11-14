import { describe, expect, it } from "vitest";
import { NUCLEOS } from "@/lib/flair/nucleos/registry";
import { NUCLEO_CODIGOS, type NucleoCodigo, type NucleoResultado } from "@/lib/flair/nucleos/types";
import { amostraDeAmbiente } from "@/lib/flair/nucleos/scene/ambient";
import { ANIMACOES, ANIMACOES_COMUNS, poseDaVez } from "@/lib/flair/nucleos/scene/animations";
import { amostrar, clip, segura, voltaAoParado } from "@/lib/flair/nucleos/scene/clips";
import { reacaoPorEstrelas } from "@/lib/flair/nucleos/scene/clips/comuns";
import { CLIPS, clipDe } from "@/lib/flair/nucleos/scene/clips/index";
import { Diretor, duracaoDaSequencia, quadroParado, type Sequencia } from "@/lib/flair/nucleos/scene/director";
import { SALAS } from "@/lib/flair/nucleos/scene/registry";
import { placarDaCena, reacaoDaPlateia, sequenciaDoResultado } from "@/lib/flair/nucleos/scene/sequences-auto";
import { sequenciaDaPose, sequenciaDeIda, sequenciaDeVolta } from "@/lib/flair/nucleos/scene/sequences-manual";
import { golsDaPartida, roundsDaLuta, sequenciaDaLuta, sequenciaDaPartida } from "@/lib/flair/nucleos/scene/sequences-match";
import { ORCAMENTO } from "@/lib/flair/nucleos/scene/types";

/**
 * Avatares e animações de cada jogo (DESENHO_DA_TELA.md, seção 2): as comuns, as próprias da tabela, a duração de
 * até 4 s com volta à pose parada, as sequências automáticas a partir do resultado e o "reduzir movimento".
 */
const resultado = (over: Partial<NucleoResultado> = {}): NucleoResultado => ({ pontos: 80, estrelas: 2, resultado: "APROVADO", regras: [], eventos: [], ...over });
const round = (n: number, atributo: string, venceu: boolean) => ({ codigo: "ROUND", valor: { round: n, atributo, voce: venceu ? 60 : 20, oponente: 40, venceu } });
const LUTA = resultado({ pontos: 100, estrelas: 3, resultado: "VITORIA", eventos: [round(1, "VELOCIDADE", true), round(2, "ATAQUE", false), round(3, "DEFESA", true)] });
const clipsDe = (s: Sequencia, ator: string) => s.passos.filter((p) => p.ator === ator).map((p) => p.clip);

/** A tabela "Animações próprias", jogo a jogo. */
const TABELA: Record<NucleoCodigo, string[]> = {
  PASSARELA: ["CAMINHADA_DE_PASSARELA", "PARADA_NA_PONTA", "MEIA_VOLTA"],
  DRESS_FIGHTER: ["GUARDA", "SOCO", "CHUTE", "DEFESA", "ESQUIVA", "GOLPE_ESPECIAL", "QUEDA"],
  DRESS_THE_STAR: ["ENTRADA_NO_PALCO", "POSE_DE_ESTRELA", "REVERENCIA"],
  PERSONAGEM_FILME: ["POSE_DE_CENA_1", "POSE_DE_CENA_2", "POSE_DE_CENA_3", "ACAO", "CORTA"],
  ROAD_TO_GLORY: ["POSE_DE_ENSAIO_1", "POSE_DE_ENSAIO_2", "POSE_DE_ENSAIO_3", "POSE_DE_ENSAIO_4", "POSE_DE_ENSAIO_5", "VIRAR_O_ROSTO", "OLHAR_PARA_A_CAMERA"],
  FASHION_DETECTIVE: ["CAMINHAR", "MOSTRAR_O_LOOK", "EXAMINAR_A_PISTA"],
  BOUTIQUE_3D: ["ENTREGAR_A_PECA", "F_PROVA_E_GIRA", "F_COMEMORA", "F_DEVOLVE"],
  CLUBE_CORACAO: ["F_ACENA"],
  FAVORITE_SINGER: ["L_PALCO_DA_ERA"],
  LABIRINTO: ["CAMINHAR", "PARAR_DIANTE_DO_ESPELHO", "APRESENTAR_O_LOOK", "ATRAVESSAR_A_PORTA"],
  PILOTO_FAVORITO: ["POR_O_CAPACETE", "BAIXAR_A_VISEIRA", "BRACOS_CRUZADOS"],
  AROUND_THE_WORLD: ["CAMINHADA_DE_RUA", "OLHAR_A_VITRINE", "ACENAR"],
  SUPER_HEROI: ["POSE_DE_HEROI_1", "POSE_DE_HEROI_2", "POSE_DE_HEROI_3", "M_CAPA_AO_VENTO"],
  FASHION_SPORTS: ["CORRER", "PASSAR", "CHUTAR", "DEFENDER", "COMEMORAR", "PASSE_ERRADO"],
  BATALHA_LOOKS: ["ENTRADA_NO_PALCO", "POSE_LADO_A_LADO", "VENCEDOR_LEVANTA_O_BRACO"],
};

describe("tabela de animações", () => {
  it("comuns a todos: três poses e a reação por estrelas", () => {
    expect(ANIMACOES_COMUNS).toEqual(["POSE_1", "POSE_2", "POSE_3", "REACAO_3", "REACAO_1", "REACAO_0"]);
    for (const id of ANIMACOES_COMUNS) expect(CLIPS[id], id).toBeDefined();
    expect([3, 2, 1, 0].map(reacaoPorEstrelas)).toEqual(["REACAO_3", "REACAO_1", "REACAO_1", "REACAO_0"]);
    expect([3, 1, 0].map(reacaoDaPlateia)).toEqual(["F_COMEMORA", "F_APLAUSO", "F_LAMENTA"]);
  });

  it("cada jogo tem as animações próprias da tabela, todas com clipe", () => {
    for (const codigo of NUCLEO_CODIGOS) {
      expect(ANIMACOES[codigo].proprias, codigo).toEqual(TABELA[codigo]);
      for (const id of [...ANIMACOES[codigo].proprias, ...ANIMACOES[codigo].poses]) expect(CLIPS[id], `${codigo}: ${id}`).toBeDefined();
    }
  });

  it("todo clipe dura até 4 s, tem o auge dentro dele e volta à pose parada", () => {
    for (const c of Object.values(CLIPS)) {
      expect(c.duracao, c.id).toBeLessThanOrEqual(ORCAMENTO.clipSegundos);
      expect(c.duracao, c.id).toBeGreaterThan(0);
      expect(c.auge, c.id).toBeLessThanOrEqual(c.duracao);
      expect(voltaAoParado(c), c.id).toBe(true);
      for (const t of c.trilhas) {
        const tempos = t.chaves.map((k) => k[0]);
        expect([...tempos].sort((a, b) => a - b), `${c.id} ${t.alvo}.${t.canal}`).toEqual(tempos);
      }
      // a amostra do fim é a pose parada (um giro completo conta como parado)
      for (const [chave, v] of Object.entries(amostrar(c, c.duracao))) expect(chave.endsWith(".ry") ? v % 360 : v, `${c.id} ${chave}`).toBeCloseTo(0, 5);
    }
  });

  it("nenhuma luz pisca mais de 3 vezes por segundo", () => {
    for (const c of Object.values(CLIPS)) {
      for (const t of c.trilhas.filter((x) => x.alvo === "luz")) {
        const picos = t.chaves.filter((k, i) => i > 0 && i < t.chaves.length - 1 && k[1] > t.chaves[i - 1][1] && k[1] >= t.chaves[i + 1][1]).length;
        expect(picos / c.duracao, c.id).toBeLessThanOrEqual(3);
      }
    }
  });

  it("posar percorre as poses do jogo: 3 comuns, 3 de cena, 5 de ensaio, 3 de herói", () => {
    expect([1, 2, 3, 4].map((n) => poseDaVez("PASSARELA", n))).toEqual(["POSE_1", "POSE_2", "POSE_3", "POSE_1"]);
    expect(ANIMACOES.PERSONAGEM_FILME.poses).toHaveLength(3);
    expect(ANIMACOES.ROAD_TO_GLORY.poses).toHaveLength(5);
    expect(ANIMACOES.SUPER_HEROI.poses).toHaveLength(3);
    expect(sequenciaDaPose("PILOTO_FAVORITO", 2).passos).toEqual([{ ator: "avatar", clip: "BAIXAR_A_VISEIRA", inicio: 0 }]);
  });

  it("manual: desfilar e caminhar só onde a tabela de ações permite", () => {
    for (const codigo of NUCLEO_CODIGOS) {
      const temAcao = NUCLEOS[codigo].acoes.includes("DESFILAR");
      expect(ANIMACOES[codigo].manual !== null, codigo).toBe(temAcao);
      expect(sequenciaDeIda(codigo) !== null, codigo).toBe(temAcao);
      expect(sequenciaDeVolta(codigo) !== null, codigo).toBe(temAcao);
      expect(ANIMACOES[codigo].automatico, codigo).toBe(!!NUCLEOS[codigo].automatico);
    }
    expect(clipsDe(sequenciaDeIda("PASSARELA")!, "avatar")).toEqual(["CAMINHADA_DE_PASSARELA", "PARADA_NA_PONTA", "MEIA_VOLTA"]);
    expect(clipsDe(sequenciaDeIda("LABIRINTO")!, "avatar")).toEqual(["MEIA_VOLTA", "CAMINHAR", "PARAR_DIANTE_DO_ESPELHO", "APRESENTAR_O_LOOK"]);
  });

  it("ambiente: o manequim do ateliê gira devagar, a torcida acena, a capa voa; parado com reduzir movimento", () => {
    for (const codigo of ["CLUBE_CORACAO", "FAVORITE_SINGER"] as const) {
      expect(amostraDeAmbiente(codigo, "fig:MANEQUIM:0", 2, false)["raiz.ry"]).toBe(36);
      expect(amostraDeAmbiente(codigo, "fig:MANEQUIM:0", 2, true)).toEqual({});
    }
    expect(Object.keys(amostraDeAmbiente("CLUBE_CORACAO", "fig:TORCIDA:3", 1, false))).toContain("bracoD.rz");
    expect(Object.keys(amostraDeAmbiente("SUPER_HEROI", "movel:capa", 1, false))).toContain("movel.rx");
    expect(Object.keys(amostraDeAmbiente("FAVORITE_SINGER", "luz:era", 1, false))).toEqual(["luz.v"]);
    expect(SALAS.SUPER_HEROI.moveis.some((m) => m.id === "capa")).toBe(true);
    expect(SALAS.FAVORITE_SINGER.luzes.proprias.some((l) => l.id === "era")).toBe(true);
  });
});

describe("sequências automáticas", () => {
  it("a luta roda em 3 rounds com os eventos do servidor e quem perde cai (e levanta)", () => {
    expect(roundsDaLuta(LUTA).map((r) => r.venceu)).toEqual([true, false, true]);
    const luta = sequenciaDaLuta(LUTA);
    expect(clipsDe(luta, "avatar")).toEqual(["MEIA_VOLTA", "GUARDA", "SOCO", "GUARDA", "DEFESA", "GUARDA", "GOLPE_ESPECIAL", "MEIA_VOLTA"]);
    expect(clipsDe(luta, "fig:OPONENTE:0")).toEqual(["F_GUARDA", "F_RECUO", "F_GUARDA", "F_SOCO", "F_GUARDA", "F_RECUO", "F_QUEDA"]);
    expect(clipsDe(luta, "luz:rastro")).toEqual(["L_RASTRO"]);
    const derrota = sequenciaDaLuta(resultado({ resultado: "DERROTA", estrelas: 0, eventos: [round(1, "VELOCIDADE", false), round(2, "ATAQUE", false), round(3, "DEFESA", false)] }));
    expect(clipsDe(derrota, "avatar")).toEqual(["MEIA_VOLTA", "GUARDA", "ESQUIVA", "GUARDA", "DEFESA", "GUARDA", "DEFESA", "QUEDA", "MEIA_VOLTA"]);
  });

  it("a partida mostra os gols do placar e o passe errado quando falta coesão", () => {
    const vitoria = resultado({ resultado: "VITORIA", eventos: [{ codigo: "PLACAR", valor: "2-1" }, { codigo: "COESAO", valor: 100 }] });
    expect(golsDaPartida(vitoria)).toEqual([2, 1]);
    const partida = sequenciaDaPartida(vitoria);
    expect(clipsDe(partida, "avatar").filter((c) => c === "CHUTAR")).toHaveLength(2);
    expect(clipsDe(partida, "avatar").filter((c) => c === "DEFENDER")).toHaveLength(1);
    expect(clipsDe(partida, "avatar")).not.toContain("PASSE_ERRADO");
    const semCoesao = sequenciaDaPartida(resultado({ eventos: [{ codigo: "PLACAR", valor: "0-2" }, { codigo: "COESAO", valor: 60 }] }));
    expect(clipsDe(semCoesao, "avatar")).toContain("PASSE_ERRADO");
    expect(placarDaCena("FASHION_SPORTS", vitoria)).toBe("2 × 1");
    expect(placarDaCena("BATALHA_LOOKS", resultado({ pontos: 100, eventos: [{ codigo: "ADVERSARIO", valor: 75 }] }))).toBe("100 × 75");
    expect(placarDaCena("LABIRINTO", vitoria)).toBeNull();
  });

  it("cada jogo termina na reação às estrelas; porta, espelho, claquete e cliente seguem o resultado", () => {
    for (const codigo of NUCLEO_CODIGOS) {
      const seq = sequenciaDoResultado(codigo, codigo === "DRESS_FIGHTER" ? LUTA : resultado({ estrelas: 0, pontos: 0, resultado: "REPROVADO" }));
      const ultimo = clipsDe(seq, "avatar").at(-1);
      expect(ultimo, codigo).toBe(codigo === "DRESS_FIGHTER" ? "REACAO_3" : "REACAO_0");
      for (const p of seq.passos) expect(() => clipDe(p.clip), `${codigo}: ${p.clip}`).not.toThrow();
    }
    const abre = sequenciaDoResultado("LABIRINTO", resultado({ resultado: "ABRE", estrelas: 3 }));
    expect(clipsDe(abre, "movel:porta")).toEqual(["M_PORTA_ABRE"]);
    expect(clipsDe(abre, "avatar").at(-1)).toBe("ATRAVESSAR_A_PORTA");
    expect(clipsDe(sequenciaDoResultado("LABIRINTO", resultado({ resultado: "NAO_ABRE", estrelas: 0 })), "luz:falha")).toEqual(["L_ONDULA"]);
    const gala = sequenciaDoResultado("FASHION_DETECTIVE", resultado({ resultado: "FAVORAVEL", estrelas: 3, regras: [{ codigo: "ACESSO", ok: true, pontos: 50 }] }));
    expect(clipsDe(gala, "movel:portaE")).toEqual(["M_PORTA_ABRE"]);
    expect(clipsDe(sequenciaDoResultado("FASHION_DETECTIVE", resultado({ resultado: "DESFAVORAVEL", estrelas: 0 })), "fig:SEGURANCA:0")).toEqual(["F_BARRA"]);
    expect(clipsDe(sequenciaDoResultado("BOUTIQUE_3D", resultado()), "fig:CLIENTE:0")).toEqual(["F_PROVA_E_GIRA", "F_COMEMORA"]);
    expect(clipsDe(sequenciaDoResultado("PERSONAGEM_FILME", resultado({ regras: [{ codigo: "TITULO", ok: true, pontos: 50 }] })), "movel:claquete")).toHaveLength(2);
    // os móveis e as luzes que as sequências animam existem na sala
    for (const codigo of NUCLEO_CODIGOS) {
      const seq = sequenciaDoResultado(codigo, codigo === "DRESS_FIGHTER" ? LUTA : resultado({ resultado: codigo === "LABIRINTO" ? "ABRE" : "FAVORAVEL", estrelas: 3, regras: [{ codigo: "ACESSO", ok: true, pontos: 50 }, { codigo: "TITULO", ok: true, pontos: 50 }], eventos: [{ codigo: "PLACAR", valor: "2-1" }] }));
      for (const p of seq.passos) {
        if (p.ator.startsWith("movel:")) expect(SALAS[codigo].moveis.some((m) => `movel:${m.id}` === p.ator), `${codigo}: ${p.ator}`).toBe(true);
        if (p.ator.startsWith("luz:")) expect(SALAS[codigo].luzes.proprias.some((l) => `luz:${l.id}` === p.ator), `${codigo}: ${p.ator}`).toBe(true);
      }
    }
  });
});

describe("diretor de cena e reduzir movimento", () => {
  const origem = { x: 0, z: 0, giro: 0 };

  it("toca a sequência no tempo: transição suave, lugar interpolado e volta à pose parada", () => {
    const d = new Diretor();
    const ida = sequenciaDeIda("PASSARELA")!;
    d.tocar(ida, 10);
    expect(d.ativo(10.1)).toBe(true);
    expect(d.lugar("avatar", 11.2, origem).z).toBeCloseTo(1, 5);
    expect(d.lugar("avatar", 12.4, origem)).toEqual({ x: 0, z: 2, giro: 0 });
    const meio = d.amostra("avatar", 10.15)["LeftUpLeg.rx"];
    expect(meio).toBeLessThan(0);
    expect(meio).toBeGreaterThan(-26);
    const fim = 10 + duracaoDaSequencia(ida);
    expect(d.ativo(fim + 0.01)).toBe(false);
    expect(d.amostra("avatar", fim + 0.01)).toEqual({});
    expect(d.lugar("avatar", fim + 1, origem)).toEqual({ x: 0, z: 2, giro: 180 });
    // a volta parte de onde a ida deixou
    d.tocar(sequenciaDeVolta("PASSARELA")!, fim + 1);
    expect(d.lugar("avatar", fim + 100, origem)).toEqual({ x: 0, z: 0, giro: 0 });
    d.limpar();
    expect(d.lugar("avatar", fim + 100, origem)).toEqual(origem);
  });

  it("reduzir movimento: a pose troca sem transição (a do auge, do começo ao fim do clipe)", () => {
    const c = clip("T", 2, 1, [segura("Head", "ry", 30, 2)]);
    expect(amostrar(c, 0.1)["Head.ry"]).toBeLessThan(30);
    expect(amostrar(c, 0.1, true)["Head.ry"]).toBe(30);
    expect(amostrar(c, 1.9, true)["Head.ry"]).toBe(30);
    expect(amostrar(c, 2.1, true)).toEqual({});
    const d = new Diretor();
    d.tocar(sequenciaDaPose("PASSARELA", 1), 5, true);
    expect(d.amostra("avatar", 5.01)["RightArm.rz"]).toBe(-38);
    expect(d.amostra("avatar", 5 + 2.5)["RightArm.rz"]).toBe(-38);
    expect(d.amostra("avatar", 5 + 2.7)).toEqual({});
  });

  it("reduzir movimento: a partida automática vira um quadro parado (ninguém anda, cada ator na pose final)", () => {
    const seq = sequenciaDoResultado("DRESS_FIGHTER", LUTA);
    expect(duracaoDaSequencia(seq)).toBeGreaterThan(10);
    const parado = quadroParado(seq);
    expect(parado.passos.every((p) => p.inicio === 0 && !p.mover)).toBe(true);
    expect(clipsDe(parado, "avatar")).toEqual(["REACAO_3"]);
    expect(clipsDe(parado, "fig:OPONENTE:0")).toEqual(["F_QUEDA"]);
    expect(duracaoDaSequencia(parado)).toBeLessThanOrEqual(ORCAMENTO.clipSegundos);
    const d = new Diretor();
    d.tocar(seq, 0, true);
    expect(d.lugar("avatar", 0, origem)).toEqual(origem);
    expect(d.amostra("avatar", 0.01)["LeftArm.rz"]).toBe(155);
    expect(d.amostra("avatar", 0.01)["LeftUpLeg.rx"]).toBeUndefined();
    // quem atravessa a porta já aparece do outro lado, sem caminhar
    const porta = new Diretor();
    porta.tocar(sequenciaDoResultado("LABIRINTO", resultado({ resultado: "ABRE", estrelas: 3 })), 0, true);
    expect(porta.lugar("avatar", 0, origem).z).toBeLessThan(-4);
    expect(porta.amostra("movel:porta", 30)["movel.ry"]).toBe(96);
  });

  it("o que a sequência mantém (porta aberta, luz acesa) fica depois do fim", () => {
    const d = new Diretor();
    const seq = sequenciaDoResultado("FASHION_DETECTIVE", resultado({ resultado: "FAVORAVEL", estrelas: 3, regras: [{ codigo: "ACESSO", ok: true, pontos: 50 }] }));
    d.tocar(seq, 0);
    const fim = duracaoDaSequencia(seq) + 5;
    expect(d.amostra("movel:portaE", fim)["movel.ry"]).toBe(96);
    expect(d.amostra("movel:portaD", fim)["movel.ry"]).toBe(-96);
    expect(d.amostra("luz:porta", fim)["luz.v"]).toBe(1);
    d.tocar(sequenciaDaPose("FASHION_DETECTIVE", 1), fim + 1);
    expect(d.amostra("movel:portaE", fim + 2)["movel.ry"]).toBe(96);
  });
});
