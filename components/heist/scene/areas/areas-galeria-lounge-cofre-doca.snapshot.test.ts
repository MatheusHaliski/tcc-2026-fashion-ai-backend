// @vitest-environment jsdom
/*
 * Retrato de caracterização das áreas galeria, lounge, cofre e doca (lote R73): cada área é montada num contexto
 * mínimo (lote, instâncias, âncoras) nas duas qualidades e o resultado — contagens de instâncias por material e
 * geometria, nomes, matrizes e posições arredondadas a 3 casas, âncoras de luz, animações e o digest das texturas
 * procedurais (no jsdom as texturas saem com 8 px, mas as funções de pixel rodam) — é comparado com o retrato gravado
 * em __retratos__/ a partir do código original, antes da extração.
 */
import { describe, expect, it } from "vitest";
import { M } from "../interior-mats";
import { recordCanvas, retrato } from "@/test-utils/heist-areas-retrato";
import { AREA as galeria } from "./galeria";
import { AREA as lounge } from "./lounge";
import { AREA as cofre } from "./cofre";
import { AREA as doca } from "./doca";

recordCanvas();
const PAL = { low: M("low"), high: M("high") } as const;
const AREAS = { galeria, lounge, cofre, doca } as const;

describe("retrato das áreas (galeria, lounge, cofre, doca)", () => {
  for (const [name, area] of Object.entries(AREAS)) {
    for (const q of ["low", "high"] as const) {
      it(`${name} · ${q}`, async () => {
        const r = retrato(area, q, PAL[q]);
        expect(r.batch.length).toBeGreaterThan(5);
        expect(r.anchors.length).toBeGreaterThan(0);
        await expect(JSON.stringify(r, null, 1)).toMatchFileSnapshot(`./__retratos__/${name}-${q}.json`);
      });
    }
  }
});
