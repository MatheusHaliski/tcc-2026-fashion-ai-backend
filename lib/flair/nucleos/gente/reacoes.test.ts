import { describe, expect, it } from "vitest";
import { Diretor } from "@/lib/flair/nucleos/scene/director";
import { atorNoMomento, REACAO_DO_CLIPE } from "@/lib/flair/nucleos/gente/reacoes";
import type { AtorDeCena } from "@/lib/flair/nucleos/gente/ator";
import { CLIPS } from "@/lib/flair/nucleos/scene/clips/index";

const sentada: AtorDeCena = { id: "fig:PLATEIA:0", x: 1, z: 2, giro: 0, anim: "sit", velocidade: 0 };
const momento = (clip: string | null, velocidade = 0) => ({ clip, desde: 10, x: 1, z: 2, giro: 0, velocidade });

describe("pessoas de cena seguem o diretor (critério da dona: animação coerente com o momento)", () => {
  it("o diretor diz o clipe de cada ator agora: o mais recente que dura, o mantido depois do fim, nenhum fora", () => {
    const d = new Diretor();
    d.tocar({ id: "s", passos: [
      { ator: "fig:PLATEIA:*", clip: "F_APLAUSO", inicio: 0 },
      { ator: "fig:OPONENTE:0", clip: "F_GUARDA", inicio: 0 },
      { ator: "fig:OPONENTE:0", clip: "F_SOCO", inicio: 1 },
      { ator: "luz:vencedor", clip: "L_ACENDE", inicio: 0, mantem: true },
    ] }, 100);
    expect(d.clipeDoAtor("fig:PLATEIA:3", 101)).toEqual({ clip: "F_APLAUSO", desde: 100 });
    expect(d.clipeDoAtor("fig:OPONENTE:0", 101.5)?.clip).toBe("F_SOCO");
    expect(d.clipeDoAtor("fig:OPONENTE:0", 99)).toBeNull();
    expect(d.clipeDoAtor("fig:PLATEIA:0", 120)).toBeNull();
    expect(d.clipeDoAtor("luz:vencedor", 120)?.clip).toBe("L_ACENDE");
  });

  it("cada clipe de figurante tem uma reação de gente; a plateia sentada aplaude sentada e lamenta de cabeça baixa", () => {
    for (const id of Object.keys(CLIPS).filter((c) => c.startsWith("F_"))) expect(REACAO_DO_CLIPE[id], id).toBeTruthy();
    expect(atorNoMomento(sentada, momento("F_APLAUSO"))).toMatchObject({ anim: "sit", gesto: "aplaudir", naJogada: true });
    expect(atorNoMomento(sentada, momento("F_LAMENTA"))).toMatchObject({ anim: "sit", gesto: "lamentar" });
    expect(atorNoMomento(sentada, momento(null))).toMatchObject({ anim: "sit", gesto: undefined, naJogada: false });
  });

  it("quem o diretor leva anda (sem deslizar) com o gesto por cima; correr é correr; o oponente cai no nocaute estilizado", () => {
    const oponente: AtorDeCena = { ...sentada, id: "fig:OPONENTE:0", anim: "idle" };
    expect(atorNoMomento(oponente, momento("F_GUARDA", 0.6))).toMatchObject({ anim: "walk", velocidade: 0.6, gesto: "guarda" });
    expect(atorNoMomento(oponente, momento("F_CORRER", 0.2))).toMatchObject({ anim: "run", velocidade: 3.2 });
    expect(atorNoMomento(oponente, momento("F_QUEDA"))).toMatchObject({ anim: "knockedOut" });
    expect(atorNoMomento(oponente, momento("F_PROVA_E_GIRA"))).toMatchObject({ anim: "change" });
  });
});
