import { describe, expect, it } from "vitest";
import { createLookHref, cropOf, expiryDays, hotspotPoint, orderDetections, parseLensTab, safeBox, shownSimilarity } from "./model";
import { faceRegion, redactFaces } from "./redact";
import type { LensDetectionView } from "./types";

describe("Lens — regras de apresentação", () => {
  it("hotspot fica no centro da caixa da roupa", () => {
    expect(hotspotPoint({ x: 20, y: 10, w: 40, h: 30 })).toEqual({ left: 40, top: 25 });
  });

  it("caixa torta é saneada (dentro da imagem, tamanho mínimo)", () => {
    expect(safeBox({ x: -5, y: 90, w: 200, h: 50 })).toEqual({ x: 0, y: 90, w: 100, h: 10 });
    expect(safeBox({ x: 10, y: 10, w: 0, h: Number.NaN })).toEqual({ x: 10, y: 10, w: 1, h: 1 });
  });

  it("recorte por CSS mostra só a caixa e guarda a proporção em pixels", () => {
    const c = cropOf({ x: 0, y: 0, w: 50, h: 50 }, 1000, 800, 0);
    expect(c.size).toBe("200.00% 200.00%");
    expect(c.position).toBe("0.00% 0.00%");
    expect(c.ratio).toBeCloseTo(1.25);
    // caixa no canto inferior direito: posição 100%
    expect(cropOf({ x: 50, y: 50, w: 50, h: 50 }, 100, 100, 0).position).toBe("100.00% 100.00%");
    // foto inteira: sem deslocamento
    expect(cropOf({ x: 0, y: 0, w: 100, h: 100 }, 100, 100).position).toBe("0.00% 0.00%");
  });

  it("expiração em dias só quando não está salvo", () => {
    const now = Date.parse("2026-10-05T12:00:00Z");
    expect(expiryDays("2026-10-08T11:00:00Z", null, now)).toBe(3);
    expect(expiryDays("2026-10-05T11:00:00Z", null, now)).toBe(0);
    expect(expiryDays("2026-10-08T11:00:00Z", "2026-10-05T10:00:00Z", now)).toBeNull();
    expect(expiryDays(null, null, now)).toBeNull();
  });

  it("semelhança sem valor útil não vira selo (nunca 0%)", () => {
    expect(shownSimilarity(0)).toBeNull();
    expect(shownSimilarity(null)).toBeNull();
    expect(shownSimilarity(85.6)).toBe(86);
    expect(shownSimilarity(0.4)).toBe(1);
  });

  it("aba desconhecida volta para Leitura; ordem de leitura de cima para baixo", () => {
    expect(parseLensTab("closet")).toBe("closet");
    expect(parseLensTab("hack")).toBe("reading");
    const d = (id: string, ordinal: number, y: number) => ({ id, ordinal, box: { x: 0, y, w: 10, h: 10 } }) as LensDetectionView;
    expect(orderDetections([d("b", 2, 50), d("a", 1, 10)]).map((x) => x.id)).toEqual(["a", "b"]);
    expect(createLookHref(["a", "b c"])).toBe("/schemes/new?pieces=a,b%20c");
  });
});

describe("Lens — rostos borrados antes do upload", () => {
  it("a caixa do rosto tem folga (mais em cima) e fica dentro da imagem", () => {
    const r = faceRegion([{ x: 0.4, y: 0.2 }, { x: 0.6, y: 0.4 }], 1000, 1000)!;
    expect(r).toEqual({ x: 350, y: 110, w: 300, h: 320 });
    const edge = faceRegion([{ x: 0, y: 0 }, { x: 0.1, y: 0.1 }], 100, 100)!;
    expect(edge.x).toBe(0); expect(edge.y).toBe(0);
    expect(faceRegion([], 100, 100)).toBeNull();
  });

  it("sem decodificador (ou sem detector) nunca rejeita: devolve faces = -1 e a tela pede a confirmação", async () => {
    const file = new Blob(["x"], { type: "image/jpeg" });
    const r = await redactFaces(file, { finder: async () => [] });
    expect(r.faces).toBe(-1);
    expect(r.blob).toBe(file);
  });
});
