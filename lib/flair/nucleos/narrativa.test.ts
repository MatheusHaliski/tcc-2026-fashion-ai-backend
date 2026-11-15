import { describe, expect, it } from "vitest";
import ptBR from "@/lib/i18n/messages/pt-BR.json";
import en from "@/lib/i18n/messages/en.json";
import { desfechoDe } from "@/lib/flair/nucleos/narrativa";
import { NUCLEO_CODIGOS } from "@/lib/flair/nucleos/types";

describe("moldura de história (critério da dona: começo, final pelo desfecho)", () => {
  it("o desfecho segue o resultado do servidor e, sem ele, as estrelas", () => {
    expect(desfechoDe({ resultado: "VITORIA", estrelas: 3 })).toBe("BOM");
    expect(desfechoDe({ resultado: "EMPATE", estrelas: 1 })).toBe("MEDIO");
    expect(desfechoDe({ resultado: "DERROTA", estrelas: 0 })).toBe("RUIM");
    expect(desfechoDe({ resultado: "PARCIAL", estrelas: 1 })).toBe("MEDIO");
    expect(desfechoDe({ resultado: "NAO_ABRE", estrelas: 0 })).toBe("RUIM");
    expect(desfechoDe({ resultado: "APROVADO", estrelas: 3 })).toBe("BOM");
    expect(desfechoDe({ resultado: "APROVADO", estrelas: 1 })).toBe("MEDIO");
    expect(desfechoDe({ resultado: "REPROVADO", estrelas: 0 })).toBe("RUIM");
    // o modo artístico (sem placar) conclui sem estrelas: o final é o bom
    expect(desfechoDe({ resultado: "CONCLUIDO", estrelas: 0 })).toBe("BOM");
  });

  it("os 15 jogos têm premissa e um final para cada desfecho, em pt-BR e en", () => {
    for (const catalogo of [ptBR, en] as Record<string, string>[]) {
      for (const jogo of NUCLEO_CODIGOS) {
        for (const parte of ["premissa", "final.BOM", "final.MEDIO", "final.RUIM"]) {
          expect(catalogo[`flair3d.narrativa.${jogo}.${parte}`], `${jogo} ${parte}`).toBeTruthy();
        }
      }
    }
  });
});
