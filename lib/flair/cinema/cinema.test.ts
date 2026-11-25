import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cutsceneDe, finalDoResultado, GATILHOS_DO_CATALOGO } from "@/lib/flair/cinema/catalogo";
import { cameraNoInstante, posicao } from "@/lib/flair/cinema/tomada";
import { duracao, TETO_S, validarCutscene, type Cutscene } from "@/lib/flair/cinema/types";
import { NUCLEO_CODIGOS } from "@/lib/flair/nucleos/types";

const msgs = (l: string) => JSON.parse(readFileSync(join(process.cwd(), `lib/i18n/messages/${l}.json`), "utf8")) as Record<string, string>;
const IDIOMAS = { "pt-BR": msgs("pt-BR"), en: msgs("en"), es: msgs("es") };

describe("cutscenes: catálogo dos 15 jogos", () => {
  it("todo jogo tem abertura, vitória, empate e derrota válidas, com toda fala nos três idiomas", () => {
    for (const jogo of NUCLEO_CODIGOS) {
      for (const g of GATILHOS_DO_CATALOGO) {
        const c = cutsceneDe(jogo, g);
        expect(validarCutscene(c), c.id).toEqual([]);
        for (const t of c.tomadas) {
          if (!t.fala) continue;
          for (const [l, m] of Object.entries(IDIOMAS)) expect(m[t.fala], `${l}: ${t.fala}`).toBeTruthy();
        }
      }
    }
  });

  it("o final segue o desfecho do servidor", () => {
    expect(finalDoResultado("PASSARELA", { resultado: "APROVADO", estrelas: 3 }).gatilho).toBe("VITORIA");
    expect(finalDoResultado("DRESS_FIGHTER", { resultado: "EMPATE", estrelas: 1 }).gatilho).toBe("EMPATE");
    expect(finalDoResultado("LABIRINTO", { resultado: "NAO_ABRE", estrelas: 0 }).gatilho).toBe("DERROTA");
    expect(finalDoResultado("CLUBE_CORACAO", { resultado: "CONCLUIDO", estrelas: 0 }).gatilho).toBe("VITORIA");
  });

  it("validar recusa tomada longa, movimento sem destino e soma acima do teto", () => {
    const base = cutsceneDe("PASSARELA", "VITORIA");
    const longa: Cutscene = { ...base, tomadas: [{ ...base.tomadas[0], duracaoS: 6 }] };
    expect(validarCutscene(longa).join()).toContain("6 s");
    const semDestino: Cutscene = { ...base, tomadas: [{ duracaoS: 2, movimento: "ORBITA", de: base.tomadas[0].de }] };
    expect(validarCutscene(semDestino).join()).toContain("sem destino");
    const comprida: Cutscene = { ...base, gatilho: "VIRADA", tomadas: base.tomadas };
    expect(duracao(comprida)).toBeGreaterThan(TETO_S.VIRADA);
    expect(validarCutscene(comprida).join()).toContain("teto");
  });
});

describe("cutscenes: câmera no instante", () => {
  const c = cutsceneDe("PASSARELA", "ABERTURA");
  const alvo: [number, number, number] = [0, 0.4, 0];

  it("as tomadas se sucedem com corte seco e a legenda é a da tomada na tela", () => {
    const a = cameraNoInstante(c, 0.1, alvo);
    expect(a.tomada).toBe(0);
    expect(a.fala).toBe("flair3d.nucleo.PASSARELA.name");
    const b = cameraNoInstante(c, c.tomadas[0].duracaoS + 0.05, alvo);
    expect(b.tomada).toBe(1);
    expect(b.fala).toBe("flair3d.narrativa.PASSARELA.premissa");
    expect(cameraNoInstante(c, duracao(c) + 1, alvo).fim).toBe(true);
  });

  it("a câmera começa no enquadramento de partida, termina no de chegada e respeita o limite da sala", () => {
    const t0 = c.tomadas[0];
    expect(cameraNoInstante(c, 0, alvo).pos).toEqual(posicao(t0.de, alvo).pos);
    const fim = cameraNoInstante(c, t0.duracaoS - 1e-9, alvo).pos;
    posicao(t0.ate!, alvo).pos.forEach((v, i) => expect(fim[i]).toBeCloseTo(v, 3));
    expect(cameraNoInstante(c, 0, alvo, 3).pos[2]).toBeLessThanOrEqual(3);
  });

  it("reduzir movimento: só a última tomada, parada", () => {
    const r = cameraNoInstante(c, 0, alvo, Infinity, true);
    expect(r.tomada).toBe(c.tomadas.length - 1);
    expect(cameraNoInstante(c, 5, alvo, Infinity, true)).toEqual(r);
  });
});
