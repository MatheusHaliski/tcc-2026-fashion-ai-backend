import { describe, expect, it } from "vitest";
import { desgasteDe, nomeDoRecurso } from "@/lib/flair/recursos/desgaste";
import type { NucleoResultado } from "@/lib/flair/nucleos/types";

const resultado = (valor: unknown): NucleoResultado => ({ pontos: 0, estrelas: 0, resultado: "NAO_ABRE", regras: [], eventos: [{ codigo: "DESGASTE", valor }], status: "ABERTA" });

describe("desgaste do recurso-vida (Flair3dDesgaste)", () => {
  it("lê o que o servidor mandou e recusa evento sem recurso conhecido", () => {
    const d = desgasteDe(resultado({ recurso: "ENERGIA", reserva: 40, gasto: 30, restante: 10, motivos: { APRESENTACAO_ERRADA: 30 } }));
    expect(d).toEqual({ recurso: "ENERGIA", reserva: 40, gasto: 30, restante: 10, motivos: { APRESENTACAO_ERRADA: 30 } });
    expect(desgasteDe(resultado({ recurso: "OURO", restante: 1 }))).toBeNull();
    expect(desgasteDe(null)).toBeNull();
  });

  it("o recurso tem o nome do jogo quando há um; senão, o nome comum", () => {
    const nomes: Record<string, string> = { "flair3d.ui.recurso.LABIRINTO.ENERGIA": "Reflexo", "flair3d.ui.recurso.ENERGIA": "Energia" };
    const ou = (k: string, padrao: string) => nomes[k] ?? padrao;
    expect(nomeDoRecurso(ou, "LABIRINTO", "ENERGIA")).toBe("Reflexo");
    expect(nomeDoRecurso(ou, "PASSARELA", "ENERGIA")).toBe("Energia");
    expect(nomeDoRecurso(ou, "PASSARELA", "OUTRO")).toBe("OUTRO");
  });
});
