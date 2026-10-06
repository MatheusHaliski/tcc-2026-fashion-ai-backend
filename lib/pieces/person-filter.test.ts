// @vitest-environment jsdom
/**
 * Tirar a pessoa da foto da peça (RF4): com a máscara de classes do segmentador e o esqueleto, a pele, o cabelo, o
 * cenário e a outra roupa saem e fica só a peça do tipo escolhido. O segmentador (MediaPipe) é simulado: a máscara e o
 * esqueleto descrevem uma pessoa de pé com camiseta e calça.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BodyDetection } from "@/lib/avatar3d/body-detect";
import { P, type PosePoint } from "@/lib/avatar3d/body";

const W = 40, H = 80;
let detection: BodyDetection;

vi.mock("@/lib/avatar3d/pipeline", () => ({
  loadOriented: async () => { const c = document.createElement("canvas"); c.width = W; c.height = H; return c; },
}));
vi.mock("@/lib/avatar3d/body-detect", () => ({ detectBody: async () => detection }));

import { stripPerson } from "./person-filter";

/** Máscara: cabelo/rosto no alto, camiseta (4) no tronco, calça (4) nas pernas, bolsa (5) ao lado, fundo (0) no resto. */
function personMask(): Uint8Array {
  const m = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = y / H; const inBody = x > 10 && x < 30;
    let k = 0;
    if (inBody && v < 0.15) k = v < 0.07 ? 1 : 3;          // cabelo, rosto
    else if (inBody && v < 0.55) k = 4;                    // camiseta
    else if (inBody && v < 0.92) k = 4;                    // calça
    else if (x >= 30 && x < 34 && v > 0.4 && v < 0.5) k = 5; // bolsa
    else if ((x === 9 || x === 30) && v < 0.5) k = 2;       // braços (pele)
    m[y * W + x] = k;
  }
  return m;
}
function pose(): PosePoint[] {
  const pts: PosePoint[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
  pts[P.shL] = { x: 0.35, y: 0.2, visibility: 0.95 }; pts[P.shR] = { x: 0.65, y: 0.2, visibility: 0.95 };
  pts[P.hipL] = { x: 0.4, y: 0.55, visibility: 0.95 }; pts[P.hipR] = { x: 0.6, y: 0.55, visibility: 0.95 };
  pts[P.ankL] = { x: 0.42, y: 0.92, visibility: 0.9 }; pts[P.ankR] = { x: 0.58, y: 0.92, visibility: 0.9 };
  return pts;
}

const photo = () => new File([new Uint8Array([1])], "look.jpg", { type: "image/jpeg" });
HTMLCanvasElement.prototype.toBlob = function toBlob(cb: BlobCallback) { cb(new Blob(["png"], { type: "image/png" })); };

afterEach(() => vi.clearAllMocks());

describe("tirar a pessoa da foto da peça", () => {
  it("sem máscara do segmentador, a foto segue como veio", async () => {
    detection = { people: 0, pose: null, world: null, mask: null, chin: null, ms: 1 };
    const f = photo();
    const r = await stripPerson(f);
    expect(r.personFound).toBe(false);
    expect(r.file).toBe(f);
  });

  it("pouca pele e ninguém detectado: é ruído, a foto segue como veio", async () => {
    detection = { people: 0, pose: null, world: null, mask: { width: W, height: H, data: new Uint8Array(W * H).fill(4) }, chin: null, ms: 1 };
    const r = await stripPerson(photo());
    expect(r.personFound).toBe(false);
  });

  it("pessoa sem esqueleto: tira pele e fundo e mantém a roupa toda", async () => {
    detection = { people: 1, pose: null, world: null, mask: { width: W, height: H, data: personMask() }, chin: null, ms: 1 };
    const r = await stripPerson(photo());
    expect(r.personFound).toBe(true);
    expect(r.file.type).toBe("image/png");
    expect(r.file.name).toBe("look.png");
    expect(r.garments).toBeNull();
  });

  for (const keep of ["upper", "lower", "feet", "full"] as const) {
    it(`com esqueleto, mantém só a peça escolhida (${keep})`, async () => {
      detection = { people: 1, pose: pose(), world: null, mask: { width: W, height: H, data: personMask() }, chin: null, ms: 1 };
      const r = await stripPerson(photo(), { keep });
      expect(r.personFound).toBe(true);
      expect(r.garments?.kept).toBe(keep);
      expect(r.removedPct).toBeGreaterThanOrEqual(0);
    });
  }

  it("sem tipo escolhido e com camiseta e calça na foto, decide pela maior parte", async () => {
    detection = { people: 1, pose: pose(), world: null, mask: { width: W, height: H, data: personMask() }, chin: null, ms: 1 };
    const r = await stripPerson(photo());
    expect(r.garments?.ambiguous).toBe(true);
    expect(["upper", "lower"]).toContain(r.garments?.kept);
  });

  it("esqueleto com ombros invisíveis não define zonas", async () => {
    const p = pose(); p[P.shL] = { ...p[P.shL], visibility: 0.1 };
    detection = { people: 1, pose: p, world: null, mask: { width: W, height: H, data: personMask() }, chin: null, ms: 1 };
    const r = await stripPerson(photo(), { keep: "upper" });
    expect(r.garments).toBeNull();
  });
});
