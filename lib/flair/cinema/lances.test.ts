import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cutsceneDoLance, JOGOS_COM_LANCE } from "@/lib/flair/cinema/lances";
import { validarCutscene } from "@/lib/flair/cinema/types";
import { reacaoAoLance } from "@/lib/flair/nucleos/movimento/fase-de-uso";

const msgs = (l: string) => JSON.parse(readFileSync(join(process.cwd(), `lib/i18n/messages/${l}.json`), "utf8")) as Record<string, string>;
const IDIOMAS = { "pt-BR": msgs("pt-BR"), en: msgs("en"), es: msgs("es") };

describe("cutscene do momento-chave (rodada zonas)", () => {
  it("os quatro jogos de zonas têm a cutscene do lance certa e errada, válidas e com a fala nos três idiomas", () => {
    expect([...JOGOS_COM_LANCE].sort()).toEqual(["CLUBE_CORACAO", "FAVORITE_SINGER", "PILOTO_FAVORITO", "SUPER_HEROI"]);
    for (const jogo of JOGOS_COM_LANCE) {
      for (const certa of [true, false]) {
        const c = cutsceneDoLance(jogo, certa)!;
        expect(c.gatilho).toBe("VIRADA");
        expect(validarCutscene(c), c.id).toEqual([]);
        const fala = c.tomadas[0].fala!;
        expect(fala).toContain(certa ? "CERTA" : "ERRADA");
        for (const [l, m] of Object.entries(IDIOMAS)) expect(m[fala], `${l}: ${fala}`).toBeTruthy();
      }
    }
    expect(cutsceneDoLance("PASSARELA", true)).toBeNull();
  });

  it("quem assiste reage ao desfecho: comemora o momento-chave e a carta de Hype alto, lamenta o erro", () => {
    expect(reacaoAoLance("CHAVE")).toEqual({ gesto: "OUSADO", publico: "F_COMEMORA", flash: true });
    expect(reacaoAoLance("ERROU", "VIRAL").publico).toBe("F_LAMENTA");
    expect(reacaoAoLance("BOM", "VIRAL").publico).toBe("F_COMEMORA");
    expect(reacaoAoLance("BOM", "NICHE").publico).toBe("F_APLAUSO");
    expect(reacaoAoLance("DEFENDIDO").gesto).toBe("SEGURO");
  });
});
