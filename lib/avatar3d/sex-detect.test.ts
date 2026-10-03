import { describe, expect, it } from "vitest";
import { SEX_CONFIDENT, bodySex, combine, faceBox } from "./sex-detect";
import { classHairMask, headCrop } from "./pipeline";

/** Pontos de um rosto frontal sintético (só os usados no recorte): centro (500, 400), rosto de ~200 px. */
function face(roll = 0): [number, number][] {
  const px: [number, number][] = Array.from({ length: 478 }, () => [500, 400]);
  const put = (i: number, x: number, y: number) => {
    const c = Math.cos(roll), s = Math.sin(roll); const dx = x - 500, dy = y - 400;
    px[i] = [500 + dx * c - dy * s, 400 + dx * s + dy * c];
  };
  put(33, 440, 380); put(133, 480, 380); put(362, 520, 380); put(263, 560, 380);   // olhos
  put(234, 400, 390); put(454, 600, 390); put(152, 500, 520); put(10, 500, 290);    // contorno, queixo, testa
  [70, 63, 105, 66, 107].forEach((i, k) => put(i, 430 + k * 12, 350));              // sobrancelhas
  [300, 293, 334, 296, 336].forEach((i, k) => put(i, 520 + k * 12, 350));
  return px;
}

describe("sexo do corpo base pelo rosto", () => {
  it("média da foto e do espelho; certeza é a da classe vencedora", () => {
    const g = combine([{ pMale: 0.9, age: 30 }, { pMale: 0.7, age: 34 }])!;
    expect(g.sex).toBe("MASCULINO"); expect(g.confidence).toBeCloseTo(0.8); expect(g.age).toBe(32);
    const f = combine([{ pMale: 0.1, age: 25 }, { pMale: 0.2, age: 27 }])!;
    expect(f.sex).toBe("FEMININO"); expect(f.confidence).toBeCloseTo(0.85);
    expect(combine([])).toBeNull();
  });

  it("estimativa segura vence o cadastro; incerta cede a ele", () => {
    expect(bodySex({ sex: "FEMININO", confidence: 0.93, pMale: 0.07, age: 40 }, "MASCULINO")).toBe("FEMININO");
    expect(bodySex({ sex: "FEMININO", confidence: SEX_CONFIDENT - 0.05, pMale: 0.35, age: 40 }, "MASCULINO")).toBe("MASCULINO");
    expect(bodySex({ sex: "MASCULINO", confidence: 0.6, pMale: 0.6, age: 40 }, null)).toBe("MASCULINO");
    expect(bodySex(null, null)).toBe("FEMININO");
  });

  it("recorte como o do face-api: das sobrancelhas ao queixo + 20%, com a cabeça endireitada", () => {
    const b = faceBox(face());
    expect(b.angle).toBeCloseTo(0);
    expect(b.w).toBeCloseTo(200 * 1.2, 0); expect(b.h).toBeCloseTo(170 * 1.2, 0);
    const r = faceBox(face(0.3));
    expect(r.angle).toBeCloseTo(0.3, 2);                     // a inclinação é desfeita antes do recorte
    expect(r.w).toBeCloseTo(b.w, 0); expect(r.h).toBeCloseTo(b.h, 0);
  });
});

describe("máscaras de cabelo", () => {
  it("rosto pequeno numa foto grande: os segmentadores rodam no recorte da cabeça", () => {
    const small = face().map(([x, y]) => [x * 0.5 + 800, y * 0.5 + 500] as [number, number]);   // rosto de 100 px
    const r = headCrop(small, 1600, 1200)!;
    expect(r).not.toBeNull();
    expect(r.x).toBeLessThan(small[234][0]); expect(r.x + r.w).toBeGreaterThan(small[454][0]);
    expect(r.y).toBeLessThan(small[10][1] - 40); expect(r.y + r.h).toBeGreaterThan(small[152][1] + 200);   // cabelo longo cabe
    expect(headCrop(face(), 700, 700)).toBeNull();          // rosto grande: a foto inteira já serve
  });

  it("classe 'cabelo' (1) vira máscara 0/1 do tamanho da foto", () => {
    const cls = { width: 4, height: 2, data: Uint8Array.from([0, 1, 1, 0, 3, 1, 4, 5]) };
    const m = classHairMask(cls, 8, 4);
    expect(m.length).toBe(32);
    expect(Array.from(m.slice(0, 8))).toEqual([0, 0, 1, 1, 1, 1, 0, 0]);
    expect(Array.from(m.slice(16, 24))).toEqual([0, 0, 1, 1, 0, 0, 0, 0]);
  });
});
