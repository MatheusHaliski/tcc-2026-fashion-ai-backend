import { describe, expect, it } from "vitest";
import { briefingDaPartida } from "@/lib/flair/nucleos/briefing";
import { avisoDoDeck } from "@/lib/flair/nucleos/deck";
import { definicaoLocal } from "@/lib/flair/nucleos/registry";
import { definicaoDaRodada, etapaDaVez, respostaObrigatoria, revelado, rodadasDe, temRodadas } from "@/lib/flair/nucleos/rodadas";
import { legivel, nomeDaEtapa, regraComum, textoDaEtapa, type Ou } from "@/lib/flair/nucleos/round-text";
import type { NucleoDefinicao, NucleoResultado } from "@/lib/flair/nucleos/types";

/** Rodadas como o servidor manda: a da base e mais duas, uma com zonas próprias e uma em etapas com opções. */
const comRodadas = (codigo: "PILOTO_FAVORITO" | "LABIRINTO" | "PERSONAGEM_FILME"): NucleoDefinicao => ({
  ...definicaoLocal(codigo),
  objetivo: { codigo: "BASE_DO_JOGO", regras: [{ codigo: "R1", pontos: 25 }] },
  rodadas: [
    { codigo: "BASE_DO_JOGO", objetivo: { codigo: "BASE_DO_JOGO", regras: [{ codigo: "R1", pontos: 25 }] } },
    { codigo: "TENIS_DOS_SONHOS", objetivo: { codigo: "TENIS_DOS_SONHOS", regras: [{ codigo: "SOLA_CLARA", pontos: 25 }] }, zonas: ["CABEDAL", "SOLA", "CADARCO"] },
    { codigo: "TRES_PORTAS", objetivo: { codigo: "TRES_PORTAS", regras: [{ codigo: "PORTA_FACIL", pontos: 1 }] }, opcoes: ["PORTA_FACIL", "PORTA_MEDIA"], etapas: 3 },
  ],
});

const resultado = (eventos: NucleoResultado["eventos"]): NucleoResultado => ({ pontos: 0, estrelas: 0, resultado: "ETAPA_CUMPRIDA", regras: [], eventos, status: "ABERTA" });

describe("rodadas de um jogo", () => {
  it("sem rodadas do servidor não há o que escolher e a definição fica como está", () => {
    const local = definicaoLocal("PASSARELA");
    expect(rodadasDe(local)).toEqual([]);
    expect(temRodadas(local)).toBe(false);
    expect(definicaoDaRodada(local, "TEMA_NOITE")).toBe(local);
  });

  it("a definição da rodada troca o objetivo e, quando a rodada tem as suas, as zonas e as opções", () => {
    const d = comRodadas("PILOTO_FAVORITO");
    expect(temRodadas(d)).toBe(true);
    const tenis = definicaoDaRodada(d, "TENIS_DOS_SONHOS");
    expect(tenis.rodada).toBe("TENIS_DOS_SONHOS");
    expect(tenis.zonas).toEqual(["CABEDAL", "SOLA", "CADARCO"]);
    expect(tenis.objetivo.regras.map((r) => r.codigo)).toEqual(["SOLA_CLARA"]);
    expect(tenis.opcoes).toEqual(d.opcoes);
    const base = definicaoDaRodada(d, "BASE_DO_JOGO");
    expect(base.zonas).toEqual(d.zonas);
    expect(base.rodada).toBe("BASE_DO_JOGO");
  });

  it("rodada com opções próprias ganha a aba de resposta e passa a exigir a resposta antes de entregar", () => {
    const d = comRodadas("LABIRINTO");
    expect(respostaObrigatoria(definicaoDaRodada(d, "BASE_DO_JOGO"))).toBe(false);
    const portas = definicaoDaRodada(d, "TRES_PORTAS");
    expect(portas.recursos).toContain("RESPOSTA");
    expect(portas.opcoes).toEqual(["PORTA_FACIL", "PORTA_MEDIA"]);
    expect(respostaObrigatoria(portas)).toBe(true);
    expect(respostaObrigatoria(definicaoDaRodada(comRodadas("PERSONAGEM_FILME"), "BASE_DO_JOGO"))).toBe(true);
  });
});

describe("etapa da vez e o que a partida revela", () => {
  const abertura = { etapa: { etapa: 1, codigo: "CLIENTE_JANTAR", total: 3, tentativa: 1 }, nota: "GOSTO_URBANO_PRETO" };

  it("a etapa vem da abertura e, depois de cada entrega, do evento PROXIMA_ETAPA", () => {
    expect(etapaDaVez({ abertura }, null)).toEqual({ etapa: 1, codigo: "CLIENTE_JANTAR", total: 3, tentativa: 1 });
    const depois = resultado([{ codigo: "PROXIMA_ETAPA", valor: { etapa: 2, codigo: "CLIENTE_VIAGEM", total: 3, tentativa: 2 } }]);
    expect(etapaDaVez({ abertura }, depois)).toEqual({ etapa: 2, codigo: "CLIENTE_VIAGEM", total: 3, tentativa: 2 });
    expect(etapaDaVez({ abertura: null }, null)).toBeNull();
    expect(etapaDaVez({ abertura: { etapa: "x" } }, null)).toBeNull();
  });

  it("o briefing apresenta a etapa (com a nota da rodada), o que foi revelado, o look-alvo ou o oponente", () => {
    const etapa = briefingDaPartida({ abertura }, null);
    expect(etapa).toMatchObject({ tipo: "etapa", codigo: "CLIENTE_JANTAR", nota: "GOSTO_URBANO_PRETO", chave: "etapa-1-1" });
    const seguinte = briefingDaPartida({ abertura }, resultado([{ codigo: "PROXIMA_ETAPA", valor: { etapa: 1, codigo: "CLIENTE_JANTAR", total: 3, tentativa: 2 } }]));
    expect(seguinte?.chave).toBe("etapa-1-2");
    expect(briefingDaPartida({ abertura: { tema: "TEMA_NOITE" } }, null)).toMatchObject({ tipo: "tema", codigo: "TEMA_NOITE" });
    expect(revelado({ abertura: { tema: "TEMA_NOITE" } }, "tema")).toBe("TEMA_NOITE");
    expect(briefingDaPartida({ abertura: { estrela: "ESTRELA_ROCK_80", pistas: 3 } }, null)?.tipo).toBe("estrela");
    expect(briefingDaPartida({ abertura: { alvo: { SUP: "c1", CAL: "c3" }, segundos: 10 } }, null)).toMatchObject({ tipo: "alvo", alvo: { SUP: "c1", CAL: "c3" }, segundos: 10 });
    expect(briefingDaPartida({ abertura: { oponente: { velocidade: 60, ataque: 35, defesa: 45 } } }, null)?.oponente).toEqual({ velocidade: 60, ataque: 35, defesa: 45 });
    expect(briefingDaPartida({ abertura: {} }, null)).toBeNull();
    expect(briefingDaPartida(null, null)).toBeNull();
  });
});

describe("aviso do deck do Labirinto", () => {
  const familia = (cor: string) => [{ codigo: `FAMILIA_${cor}`, valor: 1 }];

  it("avisa quando o deck escolhido não tem 3 cartas da mesma família de cor", () => {
    expect(avisoDoDeck("LABIRINTO", null, [familia("AZUL"), familia("AZUL"), familia("VERMELHO")])).toBe(true);
    expect(avisoDoDeck("LABIRINTO", "ESPELHO_1", [familia("AZUL"), familia("AZUL"), familia("AZUL")])).toBe(false);
    expect(avisoDoDeck("LABIRINTO", null, [[{ codigo: "SEM_FAMILIA_DE_COR", valor: 0, motivo: true }]])).toBe(true);
  });

  it("não avisa em outro jogo, em outra rodada, com o deck vazio ou antes de os selos chegarem", () => {
    expect(avisoDoDeck("PASSARELA", null, [familia("AZUL")])).toBe(false);
    expect(avisoDoDeck("LABIRINTO", "ESCADA_DE_ESPELHOS", [familia("AZUL")])).toBe(false);
    expect(avisoDoDeck("LABIRINTO", null, [])).toBe(false);
    expect(avisoDoDeck("LABIRINTO", null, [familia("AZUL"), undefined])).toBe(false);
  });
});

describe("textos das rodadas", () => {
  const catalogo: Record<string, string> = { "flair3d.etapa.ESPELHO.name": "Espelho {n}", "flair3d.etapa.ESPELHO_2.text": "Some: ocasião.", "flair3d.regra.ATE_2_CORES": "Até 2 cores" };
  const ou: Ou = (key, fallback, vars) => (key in catalogo ? catalogo[key].replace("{n}", String(vars?.n ?? "")) : fallback);

  it("código sem frase vira letras comuns, nunca um código cru; etapas numeradas usam o nome com o número", () => {
    expect(legivel("TEMA_NOITE")).toBe("Tema noite");
    expect(nomeDaEtapa(ou, "ESPELHO_2")).toBe("Espelho 2");
    expect(textoDaEtapa(ou, "ESPELHO_2")).toBe("Some: ocasião.");
    expect(nomeDaEtapa(ou, "CLIENTE_NOVA")).toBe("Cliente nova");
    expect(textoDaEtapa(ou, "CLIENTE_NOVA")).toBe("");
    expect(regraComum(ou, "ATE_2_CORES")).toBe("Até 2 cores");
    expect(regraComum(ou, "REGRA_SEM_FRASE")).toBe("Regra sem frase");
  });
});
