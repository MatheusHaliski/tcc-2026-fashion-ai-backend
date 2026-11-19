import { describe, expect, it } from "vitest";
import { semPontosNoDeck, viabilidade } from "@/lib/flair/nucleos/viabilidade";

/**
 * Auditoria dos jogos (15/11), defeito 4: rodadas impossíveis com as cartas da conta não podem ficar em silêncio.
 * Os casos são os da auditoria: tema Brasil da Passarela, pedido da Boutique, marca brasileira do Rio.
 */
const motivo = (codigo: string) => ({ codigo, valor: 0, motivo: true });
const efeito = (codigo: string, valor = 10) => ({ codigo, valor });

describe("viabilidade da rodada", () => {
  it("nenhuma carta pontua: todos os selos são motivo (a cor de cena não conta)", () => {
    const v = viabilidade(["MARCA_BR", "TODAS_BR"], [[motivo("MARCA_NAO_BR")], [motivo("MARCA_NAO_BR"), efeito("COR_FLASHES", 4)]]);
    expect(v).toEqual({ semPontos: true, regrasSemCarta: [] });
    expect(viabilidade(["NO_PEDIDO"], [[motivo("FORA_DO_PEDIDO")]])?.semPontos).toBe(true);
  });

  it("a regra de peça sem carta: a marca brasileira do Rio, com as outras regras cumpríveis", () => {
    const rio = ["CIMA_LEVE", "BAIXO_LEVE", "COR_QUENTE", "MARCA_BR"];
    const v = viabilidade(rio, [[efeito("CIMA_LEVE", 25)], [efeito("COR_QUENTE", 25)], [efeito("BAIXO_LEVE", 25)]]);
    expect(v).toEqual({ semPontos: false, regrasSemCarta: ["MARCA_BR"] });
    // a cor quente é regra do Rio: uma carta só com ela pontua
    expect(viabilidade(rio, [[efeito("COR_QUENTE", 25)]])?.semPontos).toBe(false);
  });

  it("sem resposta do servidor, sem cartas, ou com tudo cumprível, não há aviso; jogos sem selo também não", () => {
    expect(viabilidade(["MARCA_BR"], [undefined])).toBeNull();
    expect(viabilidade(["MARCA_BR"], [])).toBeNull();
    expect(viabilidade(["MARCA_BR", "TODAS_BR"], [[efeito("MARCA_BR")]])).toBeNull();
    expect(viabilidade(["TODAS_AS_ZONAS"], [[], []])).toBeNull();
    expect(viabilidade(["NO_TEMA"], [[efeito("TEMA_SURPRESA", 1)]])).toBeNull();
  });

  it("Road to Glory: a maquiagem vale metade, então o aviso diz as regras de roupa sem carta e nunca que a nota sai 0", () => {
    const ensaio = ["OCASIAO", "MATERIAL_LEVE", "BATOM_CORAL", "ACABAMENTO_BATOM"];
    const semBonus = [motivo("SEM_BONUS"), efeito("COR_LUZ_FRIA", 4)];
    expect(viabilidade(ensaio, [semBonus, semBonus], true)).toEqual({ semPontos: false, regrasSemCarta: ["OCASIAO", "MATERIAL_LEVE"] });
    expect(viabilidade(ensaio, [[efeito("MATERIAL_LEVE", 25)], semBonus], true)).toEqual({ semPontos: false, regrasSemCarta: ["OCASIAO"] });
    expect(viabilidade(ensaio, [[efeito("OCASIAO", 25), efeito("MATERIAL_LEVE", 25)]], true)).toBeNull();
    // Entrevista e Primeiro Encontro: o calçado fechado e o acessório também são regras de carta
    expect(viabilidade(["OCASIAO", "CALCADO_FECHADO"], [[efeito("OCASIAO", 25)]], true)?.regrasSemCarta).toEqual(["CALCADO_FECHADO"]);
    expect(viabilidade(["OCASIAO", "ACESSORIO"], [[efeito("ACESSORIO", 25)]], true)?.regrasSemCarta).toEqual(["OCASIAO"]);
  });

  it("no deck escolhido só vale o aviso de nenhuma carta pontuar", () => {
    expect(semPontosNoDeck({ semPontos: false, regrasSemCarta: ["MARCA_BR"] })).toBeNull();
    expect(semPontosNoDeck({ semPontos: true, regrasSemCarta: [] })).toEqual({ semPontos: true, regrasSemCarta: [] });
  });
});
