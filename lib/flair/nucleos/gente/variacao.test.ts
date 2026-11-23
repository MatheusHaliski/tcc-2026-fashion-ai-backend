/**
 * Pessoas de cena (auditoria dos jogos, mudança 5): em todo jogo elas fazem o que a legenda diz e reagem ao desfecho de
 * verdade, cada uma no próprio instante e com a própria força. Aqui: a variação, a reação de quem está de corpo leve,
 * os papéis que faltavam (vendedora e outra cliente da Boutique, jurados da Batalha, torcida do beco, banco de reservas)
 * e a torcida do estádio.
 */
import { describe, expect, it } from "vitest";
import { humorDaTorcida, humorDoLado } from "@/lib/flair/esporte/torcida";
import type { Jogada } from "@/lib/flair/esporte/types";
import type { AtorDeCena } from "@/lib/flair/nucleos/gente/ator";
import { atoresDosFigurantes, pessoasDosFigurantes } from "@/lib/flair/nucleos/gente/figurantes";
import { BRACOS, poseLeveAnimada, poseLeveDoAtor } from "@/lib/flair/nucleos/gente/leve";
import { atorNoMomento } from "@/lib/flair/nucleos/gente/reacoes";
import { poseDaTorcida, reservasNoBanco, torcidaEmDegraus, variacaoDaTorcida } from "@/lib/flair/nucleos/gente/torcida";
import { ATRASO_MAXIMO, FORCA_PARA_COMEMORAR, INTENSIDADE_MINIMA, variacaoDoAtor } from "@/lib/flair/nucleos/gente/variacao";
import { NUCLEOS } from "@/lib/flair/nucleos/registry";
import { figurantesDaCena } from "@/lib/flair/nucleos/scene/budget";
import { Diretor, passoDoAtor } from "@/lib/flair/nucleos/scene/director";
import { SALAS } from "@/lib/flair/nucleos/scene/registry";
import { plateiaDaBatalha, sequenciaDoResultado } from "@/lib/flair/nucleos/scene/sequences-auto";
import { reacaoDaArena } from "@/lib/flair/nucleos/scene/sequences-match";
import type { NucleoCodigo, NucleoResultado } from "@/lib/flair/nucleos/types";

const plateia = Array.from({ length: 14 }, (_, i) => `fig:PLATEIA:${i}`);
const sentada = (id: string): AtorDeCena => ({ id, x: 1, z: 2, giro: 0, anim: "sit", velocidade: 0 });
const res = (resultado: string, estrelas: number, eventos: NucleoResultado["eventos"] = []): NucleoResultado => ({ pontos: estrelas * 33, estrelas, resultado, regras: [], eventos });

/** O clipe que o roteiro do resultado dá a um ator (o último passo dele). */
function clipes(codigo: NucleoCodigo, r: NucleoResultado, ator: string): string[] {
  return sequenciaDoResultado(codigo, r).passos.filter((p) => passoDoAtor(p, ator)).map((p) => p.clip);
}

describe("variação entre as pessoas de cena", () => {
  it("cada pessoa tem atraso, força e ritmo próprios, sempre os mesmos para o mesmo id e a mesma partida", () => {
    const v = plateia.map((id) => variacaoDoAtor(id, 41));
    expect(v).toEqual(plateia.map((id) => variacaoDoAtor(id, 41)));
    expect(v).not.toEqual(plateia.map((id) => variacaoDoAtor(id, 42)));
    for (const x of v) {
      expect(x.atraso).toBeGreaterThanOrEqual(0);
      expect(x.atraso).toBeLessThanOrEqual(ATRASO_MAXIMO);
      expect(x.intensidade).toBeGreaterThanOrEqual(INTENSIDADE_MINIMA);
      expect(x.intensidade).toBeLessThanOrEqual(1);
      expect(x.ritmo).toBeGreaterThanOrEqual(0.85);
      expect(x.ritmo).toBeLessThanOrEqual(1.15);
    }
    // a plateia não é um bloco: os atrasos se espalham por mais de meio segundo e as forças variam
    const atrasos = v.map((x) => x.atraso);
    expect(Math.max(...atrasos) - Math.min(...atrasos)).toBeGreaterThan(0.5);
    expect(new Set(atrasos).size).toBeGreaterThan(10);
    expect(new Set(v.map((x) => x.intensidade)).size).toBeGreaterThan(8);
  });

  it("na reação de grupo cada um começa no próprio instante; quem reage sozinho por roteiro não atrasa", () => {
    const v = { atraso: 0.6, intensidade: 0.9, ritmo: 1.1 };
    const m = (agora: number, grupo: boolean) => ({ clip: "F_APLAUSO", desde: 10, x: 1, z: 2, giro: 0, velocidade: 0, agora, grupo, variacao: v });
    expect(atorNoMomento(sentada("fig:PLATEIA:0"), m(10.3, true))).toMatchObject({ anim: "sit", gesto: undefined });
    expect(atorNoMomento(sentada("fig:PLATEIA:0"), m(10.7, true))).toMatchObject({ anim: "sit", gesto: "aplaudir", gestoDesde: 10.6, intensidade: 0.9, ritmo: 1.1 });
    expect(atorNoMomento(sentada("fig:CLIENTE:0"), m(10.1, false))).toMatchObject({ gesto: "aplaudir", gestoDesde: 10, naJogada: true });
  });

  it("a plateia se levanta, mas nem todos pulam: quem tem pouca força aplaude de pé", () => {
    const m = (intensidade: number) => ({ clip: "F_COMEMORA", desde: 0, x: 1, z: 2, giro: 0, velocidade: 0, agora: 5, grupo: true, variacao: { atraso: 0, intensidade, ritmo: 1 } });
    expect(atorNoMomento(sentada("a"), m(0.95))).toMatchObject({ anim: "cheer", gesto: undefined });
    expect(atorNoMomento(sentada("a"), m(FORCA_PARA_COMEMORAR - 0.05))).toMatchObject({ anim: "idle", gesto: "aplaudir" });
    // em qualquer partida há dos dois na plateia de 14
    const quem = plateia.map((id) => variacaoDoAtor(id, 7).intensidade < FORCA_PARA_COMEMORAR);
    expect(quem.some(Boolean)).toBe(true);
    expect(quem.some((x) => !x)).toBe(true);
  });

  it("a reação de grupo não puxa a plateia inteira para o corpo inteiro (era o pico de carga no resultado)", () => {
    const m = { clip: "F_APLAUSO", desde: 0, x: 1, z: 2, giro: 0, velocidade: 0, agora: 5, grupo: true, variacao: variacaoDoAtor("fig:PLATEIA:3") };
    expect(atorNoMomento(sentada("fig:PLATEIA:3"), m).naJogada).toBe(false);
    const d = new Diretor();
    d.tocar({ id: "s", passos: [{ ator: "fig:PLATEIA:*", clip: "F_APLAUSO", inicio: 0 }, { ator: "fig:CLIENTE:0", clip: "F_COMEMORA", inicio: 0 }] }, 100);
    expect(d.clipeDoAtor("fig:PLATEIA:3", 101)?.grupo).toBe(true);
    expect(d.clipeDoAtor("fig:CLIENTE:0", 101)?.grupo).toBe(false);
  });
});

describe("a pessoa de corpo leve também reage (antes ficava parada)", () => {
  const a = (extra: Partial<AtorDeCena>): AtorDeCena => ({ ...sentada("fig:PLATEIA:9"), ...extra });
  it("aplaude sentada, levanta de braços para cima, lamenta de corpo inclinado e volta ao repouso", () => {
    expect(poseLeveDoAtor(a({}), 3)).toEqual({ bracos: 0, inclina: 0, pulo: 0, sentada: true });
    const palmas = poseLeveDoAtor(a({ gesto: "aplaudir" }), 3);
    expect(palmas.sentada).toBe(true);
    expect(Math.abs(palmas.bracos - BRACOS.palmas)).toBeLessThanOrEqual(0.16);
    const comemora = poseLeveDoAtor(a({ anim: "cheer" }), 3);
    expect(comemora.sentada).toBe(false);
    expect(comemora.bracos).toBeLessThan(-2.3);
    const lamenta = poseLeveDoAtor(a({ gesto: "lamentar", intensidade: 1 }), 3);
    expect(lamenta).toMatchObject({ bracos: 0, sentada: true });
    expect(lamenta.inclina).toBeGreaterThan(0.2);
    expect(poseLeveDoAtor(a({ gesto: "lamentar", intensidade: 0.55 }), 3).inclina).toBeLessThan(lamenta.inclina);
  });

  it("as palmas mexem com o tempo, cada pessoa na própria fase; com reduzir movimento ficam paradas", () => {
    const palmas = a({ gesto: "aplaudir" });
    expect(poseLeveDoAtor(palmas, 1).bracos).not.toBe(poseLeveDoAtor(palmas, 1.1).bracos);
    expect(poseLeveDoAtor(palmas, 1, 0.2).bracos).not.toBe(poseLeveDoAtor(palmas, 1, 0.7).bracos);
    expect(poseLeveDoAtor(palmas, 1, 0, true)).toEqual(poseLeveDoAtor(palmas, 9, 0, true));
    expect(poseLeveAnimada(palmas)).toBe(true);
    expect(poseLeveAnimada(a({}))).toBe(false);
  });
});

describe("papéis que faltavam, reagindo ao desfecho de verdade", () => {
  const papeis = (codigo: NucleoCodigo) => figurantesDaCena(SALAS[codigo], NUCLEOS[codigo].personagens).map((p) => p.papel);
  it("Boutique: a vendedora e outra cliente; a vendedora aplaude o look aprovado e lamenta o devolvido", () => {
    expect(papeis("BOUTIQUE_3D")).toEqual(["CLIENTE", "VENDEDORA", "CLIENTE_DA_LOJA"]);
    expect(clipes("BOUTIQUE_3D", res("APROVADO", 3), "fig:VENDEDORA:0")).toEqual(["F_POSE", "F_APLAUSO"]);
    expect(clipes("BOUTIQUE_3D", res("REPROVADO", 0), "fig:VENDEDORA:0")).toEqual(["F_POSE", "F_LAMENTA"]);
    expect(clipes("BOUTIQUE_3D", res("APROVADO", 3), "fig:CLIENTE_DA_LOJA:0")).toEqual(["F_APLAUSO"]);
    expect(clipes("BOUTIQUE_3D", res("REPROVADO", 0), "fig:CLIENTE_DA_LOJA:0")).toEqual([]);
    expect(clipes("BOUTIQUE_3D", res("REPROVADO", 0), "fig:CLIENTE:0")).toEqual(["F_PROVA_E_GIRA", "F_DEVOLVE"]);
    const pessoas = pessoasDosFigurantes(5, figurantesDaCena(SALAS.BOUTIQUE_3D, NUCLEOS.BOUTIQUE_3D.personagens));
    expect(pessoas.get("fig:VENDEDORA:0")?.pecas.map((p) => p.subcategory)).toEqual(["shirt", "tailored_pants", "loafers"]);
  });

  it("Batalha: três jurados sentados à mesa; plateia e jurados seguem quem venceu, não só a nota", () => {
    const lista = figurantesDaCena(SALAS.BATALHA_LOOKS, NUCLEOS.BATALHA_LOOKS.personagens);
    const jurados = lista.filter((p) => p.papel === "JURADO");
    expect(jurados).toHaveLength(3);
    for (const j of jurados) expect(j.postura).toBe("sentada");
    expect(atoresDosFigurantes(lista).filter((x) => x.id.startsWith("fig:JURADO")).map((x) => x.anim)).toEqual(["sit", "sit", "sit"]);
    expect(plateiaDaBatalha(res("VITORIA", 3))).toBe("F_COMEMORA");
    expect(plateiaDaBatalha(res("VITORIA", 1))).toBe("F_APLAUSO");
    expect(plateiaDaBatalha(res("EMPATE", 2))).toBe("F_POSE");
    expect(plateiaDaBatalha(res("DERROTA", 2))).toBe("F_APLAUSO");
    expect(plateiaDaBatalha(res("DERROTA", 0))).toBe("F_LAMENTA");
    expect(clipes("BATALHA_LOOKS", res("VITORIA", 3), "fig:JURADO:1")).toEqual(["F_POSE", "F_APLAUSO"]);
    expect(clipes("BATALHA_LOOKS", res("EMPATE", 1), "fig:JURADO:1")).toEqual(["F_POSE", "F_POSE"]);
    // o adversário lamenta quando perde e só ergue o braço quando vence
    expect(clipes("BATALHA_LOOKS", res("VITORIA", 3), "fig:ADVERSARIO:0")).toEqual(["F_POSE", "F_LAMENTA"]);
    expect(clipes("BATALHA_LOOKS", res("DERROTA", 0), "fig:ADVERSARIO:0")).toEqual(["F_POSE", "F_LEVANTA_O_BRACO"]);
  });

  it("Dress Fighter: a torcida do beco vibra com o golpe da avatar, lamenta o que ela leva e grita por quem venceu", () => {
    expect(papeis("DRESS_FIGHTER").filter((p) => p === "TORCEDOR")).toHaveLength(6);
    expect(reacaoDaArena(12, 0)).toBe("F_COMEMORA");
    expect(reacaoDaArena(0, 9)).toBe("F_LAMENTA");
    expect(reacaoDaArena(8, 8)).toBe("F_APLAUSO");
    expect(reacaoDaArena(0, 0)).toBeNull();
    expect(clipes("DRESS_FIGHTER", res("VITORIA", 3), "fig:TORCEDOR:2").at(-1)).toBe("F_COMEMORA");
    expect(clipes("DRESS_FIGHTER", res("DERROTA", 0), "fig:TORCEDOR:2").at(-1)).toBe("F_LAMENTA");
    // no meio da luta não há desfecho: a torcida só reage ao lance
    const lance = { codigo: "LANCE", valor: { round: 1, lance: 1, golpe: "GOLPE_FORTE", golpeOponente: "GUARDA", dano: 14, sofrido: 0, vida: 100, vidaOponente: 86 } };
    const noMeio = clipes("DRESS_FIGHTER", { ...res("EM_ACAO", 0, [lance]), status: "EM_ACAO" } as NucleoResultado, "fig:TORCEDOR:0");
    expect(noMeio.every((c) => ["F_COMEMORA", "F_APLAUSO", "F_LAMENTA"].includes(c))).toBe(true);
    // de pé na calçada, conversando até a luta pedir reação; roupa de torcida
    const lista = figurantesDaCena(SALAS.DRESS_FIGHTER, NUCLEOS.DRESS_FIGHTER.personagens);
    expect(atoresDosFigurantes(lista).filter((x) => x.id.startsWith("fig:TORCEDOR")).every((x) => x.anim === "talk")).toBe(true);
  });

  it("Fashion Sports (quadra): três reservas no banco; banco e torcida comemoram o gol do time e lamentam o sofrido", () => {
    expect(papeis("FASHION_SPORTS").filter((p) => p === "RESERVA")).toHaveLength(3);
    const vitoria = res("VITORIA", 3, [{ codigo: "PLACAR", valor: "1-0" }]);
    const derrota = res("DERROTA", 0, [{ codigo: "PLACAR", valor: "0-1" }]);
    for (const ator of ["fig:RESERVA:1", "fig:TORCIDA:4"]) {
      expect(clipes("FASHION_SPORTS", vitoria, ator)).toEqual(["F_COMEMORA"]);
      expect(clipes("FASHION_SPORTS", derrota, ator)).toEqual(["F_LAMENTA"]);
    }
    const pessoas = pessoasDosFigurantes(5, figurantesDaCena(SALAS.FASHION_SPORTS, NUCLEOS.FASHION_SPORTS.personagens), true);
    expect(pessoas.get("fig:RESERVA:0")?.pecas.map((p) => p.subcategory)).toEqual(["t_shirt", "shorts", "casual_sneakers"]);
  });
});

describe("torcida e bancos do estádio (Fashion Sports)", () => {
  const lance = (tipo: string, time: "NOS" | "ELES", placar = "0-0"): Jogada => ({ n: 7, tipo, time, placar } as Jogada);
  it("o gol do time levanta a arquibancada depois que a bola chega à rede; o gol sofrido e a trave fazem lamentar", () => {
    expect(humorDaTorcida(lance("CHUTE_GOL", "NOS"), 0.5, false)).toBeNull();
    expect(humorDaTorcida(lance("CHUTE_GOL", "NOS"), 0.8, false)).toEqual({ reacao: "comemora", chave: "lance-7" });
    expect(humorDaTorcida(lance("RIVAL_GOL", "ELES"), 0.8, false)?.reacao).toBe("lamenta");
    expect(humorDaTorcida(lance("CHUTE_NA_TRAVE", "NOS"), 0.8, false)?.reacao).toBe("lamenta");
    expect(humorDaTorcida(lance("PASSE", "NOS"), 0.9, false)).toBeNull();
  });

  it("no apito final a torcida segue o placar; o banco do visitante reage ao contrário", () => {
    expect(humorDaTorcida(lance("PASSE", "NOS", "2-1"), 1, true)).toEqual({ reacao: "comemora", chave: "fim" });
    expect(humorDaTorcida(lance("PASSE", "NOS", "1-1"), 1, true)?.reacao).toBe("aplaude");
    expect(humorDaTorcida(lance("PASSE", "NOS", "0-1"), 1, true)?.reacao).toBe("lamenta");
    const gol = humorDaTorcida(lance("CHUTE_GOL", "NOS"), 0.8, false);
    expect(humorDoLado(gol, "NOS")?.reacao).toBe("comemora");
    expect(humorDoLado(gol, "ELES")?.reacao).toBe("lamenta");
  });

  it("cada pessoa reage no próprio atraso e com a própria força: uns pulam, outros aplaudem; sentado ninguém pula", () => {
    const torcida = torcidaEmDegraus(1, 40, 5, ["#C6275E", "#1F7A76"]);
    const humor = { reacao: "comemora", chave: "lance-1" } as const;
    const atrasos = torcida.map((p) => variacaoDaTorcida(p).atraso);
    expect(Math.max(...atrasos) - Math.min(...atrasos)).toBeGreaterThan(0.6);
    // meio segundo depois do gol, parte já reage e parte ainda não
    const cedo = torcida.map((p) => variacaoDaTorcida(p).atraso <= 0.45);
    expect(cedo.some(Boolean) && cedo.some((x) => !x)).toBe(true);
    const depois = torcida.map((p) => poseDaTorcida(p, 3.3, humor, 0));
    expect(depois.some((x) => x.bracos < -2.2)).toBe(true);
    expect(depois.some((x) => x.bracos > -1.4 && x.bracos < -0.8)).toBe(true);
    expect(depois.some((x) => x.pulo > 0)).toBe(true);
    const triste = torcida.map((p) => poseDaTorcida(p, 3.3, { reacao: "lamenta", chave: "lance-2" }, 0));
    expect(triste.every((x) => x.inclina > 0 && x.pulo === 0)).toBe(true);
    const banco = reservasNoBanco(11, 4, "#1F7A76");
    expect(banco).toHaveLength(4);
    expect(banco.every((p) => p.sentada && !p.torce && p.roupa === "#1F7A76")).toBe(true);
    expect(banco.every((p) => poseDaTorcida(p, 3.3, humor, 0).pulo === 0)).toBe(true);
    // sem nada acontecendo no jogo, o banco fica quieto
    expect(banco.every((p) => poseDaTorcida(p, 3.3).bracos === 0)).toBe(true);
  });
});
