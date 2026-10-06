import { describe, expect, it } from "vitest";
import { EYES, eyesProfile, irisClass, IRIS_PROTOTYPES, measureIris, defaultEyes, irisColorOf } from "./iris";
import { detectGlasses, inpaint, removeGlasses, glassesMask } from "./glasses";
import { deltaE2000, rgbToLab, hexToLab, type Lab } from "./identity/metrics";
import { FACE_OVAL } from "./canonical-face";
import type { Pt } from "./image-stats";

/**
 * Rostos sintéticos (nenhuma foto de pessoa): pele lisa, dois olhos com contorno, esclera e íris de cor conhecida,
 * sobrancelhas, e por cima, conforme o caso, armação de grau, lente escura, olheira ou ruga. Auditoria de identidade,
 * seção 17: "cor de íris em olhos sintéticos"; lista de 29/09, itens 3 e 7.
 */
const W = 400, H = 400;
const SKIN: [number, number, number] = [196, 150, 122];
const SCLERA: [number, number, number] = [222, 214, 205];
const BROWS = { right: [70, 63, 105, 66, 107, 55, 65, 52, 53, 46], left: [300, 293, 334, 296, 336, 285, 295, 282, 283, 276] };
const EYE_C = { right: [140, 180] as Pt, left: [260, 180] as Pt };

type RGB = [number, number, number];
interface Opts {
  iris?: { right: RGB; left?: RGB; inner?: RGB }; irisR?: number; specular?: boolean;
  glasses?: "frame" | "sun"; darkCircles?: boolean; wrinkle?: boolean; skin?: RGB;
}

function face(o: Opts = {}) {
  const skin = o.skin ?? SKIN;
  const data = new Uint8ClampedArray(W * H * 4);
  const px: Pt[] = Array.from({ length: 478 }, () => [200, 210] as Pt);
  FACE_OVAL.forEach((id, k) => { const a = (k / FACE_OVAL.length) * Math.PI * 2 - Math.PI / 2; px[id] = [200 + Math.cos(a) * 150, 210 + Math.sin(a) * 190]; });
  const R = o.irisR ?? 13;
  for (const side of ["right", "left"] as const) {
    const [cx, cy] = EYE_C[side]; const e = EYES[side];
    // contorno: começa no canto externo e dá a volta (o externo do olho direito fica à esquerda da foto)
    const dir = side === "right" ? -1 : 1;
    e.contour.forEach((id, k) => { const a = (k / e.contour.length) * Math.PI * 2; px[id] = [cx + dir * Math.cos(a) * 30, cy + Math.sin(a) * 11]; });
    px[e.corners[0]] = [cx + dir * 30, cy]; px[e.corners[1]] = [cx - dir * 30, cy];
    px[e.lids[0]] = [cx, cy - 11]; px[e.lids[1]] = [cx, cy + 11];
    px[e.iris] = [cx, cy]; e.ring.forEach((id, k) => { const a = (k / 4) * Math.PI * 2; px[id] = [cx + Math.cos(a) * R, cy + Math.sin(a) * R]; });
    BROWS[side].forEach((id, k) => { px[id] = [cx - 34 + (k % 5) * 17, cy - 34 + (k < 5 ? 0 : 7)]; });
  }
  const inEye = (x: number, y: number, side: "right" | "left") => ((x - EYE_C[side][0]) / 30) ** 2 + ((y - EYE_C[side][1]) / 11) ** 2 < 1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let c: RGB = ((x - 200) / 150) ** 2 + ((y - 210) / 190) ** 2 < 1 ? [...skin] : [90, 110, 140];
    if (o.darkCircles) for (const side of ["right", "left"] as const) { const [cx, cy] = EYE_C[side]; if (((x - cx) / 32) ** 2 + ((y - cy - 24) / 14) ** 2 < 1) c = c.map((v) => v * 0.8) as RGB; }
    if (o.wrinkle) for (const side of ["right", "left"] as const) { const [cx, cy] = EYE_C[side]; if (Math.abs(x - cx) < 24 && Math.abs(y - (cy + 26 + ((x - cx) / 24) ** 2 * 4)) < 0.8) c = c.map((v) => v * 0.86) as RGB; }
    for (const side of ["right", "left"] as const) {
      const [cx, cy] = EYE_C[side];
      if (y >= cy - 36 && y <= cy - 30 && Math.abs(x - cx) < 32) c = [60, 42, 32];          // sobrancelha
      if (!inEye(x, y, side)) continue;
      const r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (r < R) {
        const col = side === "left" && o.iris?.left ? o.iris.left : o.iris?.right ?? [70, 45, 30];
        c = r < R * 0.38 ? [12, 10, 10] : r < R * 0.62 && o.iris?.inner ? [...o.iris.inner] : r > R * 0.92 ? col.map((v) => v * 0.7) as RGB : [...col];
        if (o.specular && Math.hypot(x - cx - 3, y - cy + 3) < 1.6) c = [252, 252, 252];
      } else c = [...SCLERA];
    }
    if (o.glasses === "sun") for (const side of ["right", "left"] as const) { const [cx, cy] = EYE_C[side]; if (((x - cx) / 52) ** 2 + ((y - cy - 6) / 38) ** 2 < 1) c = c.map((v) => v * 0.12 + 18) as RGB; }
    if (o.glasses) {
      for (const side of ["right", "left"] as const) {
        const [cx, cy] = EYE_C[side]; const dx = Math.abs(x - cx), dy = Math.abs(y - cy - 6);
        const outer = (dx / 54) ** 4 + (dy / 40) ** 4 < 1, inner = (dx / 50) ** 4 + (dy / 36) ** 4 < 1;
        if (outer && !inner) c = [28, 26, 30];
      }
      if (x > 192 && x < 208 && y > 168 && y < 173) c = [28, 26, 30];                         // ponte
    }
    const k = (y * W + x) * 4; data[k] = c[0]; data[k + 1] = c[1]; data[k + 2] = c[2]; data[k + 3] = 255;
  }
  return { img: { data, width: W, height: H }, px, skin };
}

const labOf = (c: RGB): Lab => rgbToLab(...c);
const BLUE: RGB = [92, 118, 150], GREEN: RGB = [96, 118, 74], BROWN: RGB = [96, 64, 42], DARK: RGB = [40, 28, 22];

describe("cor da íris (I4)", () => {
  it("mede a cor base de olhos azuis, verdes e castanhos (ΔE2000 ≤ 4) e dá a classe certa", () => {
    for (const [col, cls] of [[BLUE, "BLUE"], [GREEN, "GREEN"], [BROWN, "MEDIUM_BROWN"], [DARK, "DARK_BROWN"]] as const) {
      const { img, px } = face({ iris: { right: col } });
      const m = measureIris(img, px, "right")!;
      expect(deltaE2000(m.base, labOf(col))).toBeLessThan(4);
      expect(irisClass(m.base)).toBe(cls);
      expect(m.confidence).toBeGreaterThanOrEqual(0.8);
    }
  });

  it("o reflexo da luz na córnea não clareia a íris", () => {
    const { img, px } = face({ iris: { right: BLUE }, specular: true });
    expect(deltaE2000(measureIris(img, px, "right")!.base, labOf(BLUE))).toBeLessThan(4);
  });

  it("zona perto da pupila de outra cor vira padrão RING com a cor secundária medida", () => {
    const amber: RGB = [150, 100, 40];
    const { img, px } = face({ iris: { right: GREEN, inner: amber } });
    const m = measureIris(img, px, "right")!;
    expect(m.pattern).toBe("RING");
    expect(deltaE2000(m.inner, labOf(amber))).toBeLessThan(6);
    expect(deltaE2000(m.outer, labOf(GREEN))).toBeLessThan(6);
  });

  it("íris pequena na foto (< 18 px) sai com confiança baixa", () => {
    const { img, px } = face({ iris: { right: BLUE }, irisR: 7 });
    expect(measureIris(img, px, "right")!.confidence).toBeLessThanOrEqual(0.3);
  });

  it("sem os pontos de íris (468 pontos), não mede", () => {
    const { img, px } = face();
    expect(measureIris(img, px.slice(0, 468), "right")).toBeNull();
    expect(eyesProfile(img, px.slice(0, 468)).source).toBe("DEFAULT");
  });

  it("perfil dos dois olhos: mesma cor → uma cor; cores muito diferentes → heterocromia com a cor de cada olho", () => {
    const same = eyesProfile(face({ iris: { right: BLUE, left: BLUE } }).img, face().px);
    expect(same.cls).toBe("BLUE"); expect(same.right).toBeUndefined(); expect(same.source).toBe("IMAGE_ANALYSIS");
    const f = face({ iris: { right: BLUE, left: BROWN } });
    const het = eyesProfile(f.img, f.px);
    expect(het.right && het.left).toBeTruthy();
    expect(deltaE2000(hexToLab(irisColorOf(het, "right").color), labOf(BLUE))).toBeLessThan(5);
    expect(deltaE2000(hexToLab(irisColorOf(het, "left").color), labOf(BROWN))).toBeLessThan(5);
  });

  it("um olho na sombra (mesma cor, mais escuro) não é heterocromia", () => {
    const f = face({ iris: { right: [150, 158, 150], left: [72, 76, 72] } });
    expect(eyesProfile(f.img, f.px).right).toBeUndefined();
  });

  it("azul claro e bem iluminado continua azul; castanhos se separam pela luminosidade", () => {
    expect(irisClass({ L: 60, a: 5, b: -14 })).toBe("BLUE");
    expect(irisClass({ L: 50, a: 7, b: 2 })).toBe("GRAY");
    expect(irisClass({ L: 32, a: -5, b: 5 })).toBe("GREEN_GRAY");
    expect(irisClass({ L: 11, a: 3, b: -4 })).toBe("DARK_BROWN");                  // escura com matiz fria da foto
    expect(irisClass({ L: 22, a: -4, b: 3 })).toBe("DARK_BROWN");
    expect([irisClass({ L: 15, a: 9, b: 17 }), irisClass({ L: 28, a: 10, b: 9 }), irisClass({ L: 40, a: 13, b: 20 })]).toEqual(["DARK_BROWN", "MEDIUM_BROWN", "LIGHT_BROWN"]);
  });

  it("luz sem correção pela esclera reduz a confiança", () => {
    const f = face({ iris: { right: BLUE, left: BLUE } });
    expect(eyesProfile(f.img, f.px, { wb: "NONE" }).confidence).toBeLessThan(eyesProfile(f.img, f.px, { wb: "SCLERA" }).confidence);
  });

  it("óculos escuros: cor padrão, confiança 0 e origem DEFAULT", () => {
    const f = face({ iris: { right: BLUE }, glasses: "sun" });
    const e = eyesProfile(f.img, f.px, { glasses: "SUNGLASSES" });
    expect(e).toMatchObject({ source: "DEFAULT", confidence: 0, glasses: "SUNGLASSES" });
    expect(e).toEqual(defaultEyes("SUNGLASSES"));
  });

  it("os protótipos caem cada um na própria classe", () => {
    for (const [k, lab] of Object.entries(IRIS_PROTOTYPES)) expect(irisClass(lab)).toBe(k);
  });
});

describe("óculos na foto (I4)", () => {
  it("rosto sem óculos: nada", () => {
    for (const o of [{}, { darkCircles: true }, { wrinkle: true }, { skin: [92, 62, 46] as RGB }]) {
      const f = face(o);
      expect(detectGlasses(f.img, f.px, f.skin).kind).toBe("NONE");
    }
  });

  it("armação fina em volta dos olhos e na ponte do nariz: óculos de grau, com a cor da armação", () => {
    for (const skin of [SKIN, [92, 62, 46] as RGB]) {
      const f = face({ glasses: "frame", skin });
      const d = detectGlasses(f.img, f.px, f.skin);
      expect(d.kind).toBe("PRESCRIPTION");
      expect(deltaE2000(hexToLab(d.frame!), labOf([28, 26, 30]))).toBeLessThan(6);
    }
  });

  it("lente escura sobre os dois olhos: óculos escuros", () => {
    const f = face({ glasses: "sun" });
    expect(detectGlasses(f.img, f.px, f.skin).kind).toBe("SUNGLASSES");
  });

  it("remover a armação devolve pele no lugar dela e não mexe no olho, na olheira nem na ruga", () => {
    const f = face({ glasses: "frame", darkCircles: true, wrinkle: true, iris: { right: BLUE, left: BLUE } });
    const clean = face({ darkCircles: true, wrinkle: true, iris: { right: BLUE, left: BLUE } });
    const before = Uint8ClampedArray.from(f.img.data);
    expect(removeGlasses(f.img, f.px, f.skin, "PRESCRIPTION", detectGlasses(f.img, f.px, f.skin).frame)).toBeGreaterThan(0);
    const de = (img: Uint8ClampedArray, x: number, y: number, ref: Uint8ClampedArray) => { const k = (y * W + x) * 4; return deltaE2000(rgbToLab(img[k], img[k + 1], img[k + 2]), rgbToLab(ref[k], ref[k + 1], ref[k + 2])); };
    // onde estava a armação (aro de baixo, lateral, ponte) agora é pele como no rosto sem óculos
    for (const [x, y] of [[140, 224], [88, 186], [200, 170], [260, 224], [312, 186]] as Pt[]) expect(de(f.img.data, x, y, clean.img.data)).toBeLessThan(8);
    // olho, olheira e ruga continuam idênticos
    for (const [x, y] of [[140, 180], [150, 181], [140, 204], [140, 206], [260, 204]] as Pt[]) expect(de(f.img.data, x, y, before)).toBe(0);
  });

  it("remover a lente escura devolve pele em volta do olho", () => {
    const f = face({ glasses: "sun" });
    removeGlasses(f.img, f.px, f.skin, "SUNGLASSES");
    const k = (214 * W + 140) * 4; const c = [f.img.data[k], f.img.data[k + 1], f.img.data[k + 2]] as RGB;
    expect(deltaE2000(labOf(c), labOf(SKIN))).toBeLessThan(8);
  });

  it("sem óculos não há máscara", () => {
    const f = face();
    expect(glassesMask(f.img, f.px, f.skin, "NONE")).toBeNull();
  });

  it("preenchimento harmônico reproduz um degradê liso por baixo do buraco", () => {
    const w = 60, h = 40; const data = new Uint8ClampedArray(w * h * 4); const mask = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = (y * w + x) * 4; data[k] = 60 + x * 2; data[k + 1] = 100; data[k + 2] = 80 + y; data[k + 3] = 255; if (x > 20 && x < 40 && y > 10 && y < 30) { mask[y * w + x] = 1; data[k] = 0; data[k + 1] = 0; data[k + 2] = 0; } }
    inpaint({ data, width: w, height: h }, mask, 400);
    const k = (20 * w + 30) * 4;
    expect(Math.abs(data[k] - (60 + 30 * 2))).toBeLessThan(4);
    expect(Math.abs(data[k + 2] - (80 + 20))).toBeLessThan(4);
  });
});
