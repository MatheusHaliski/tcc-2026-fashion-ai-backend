// @vitest-environment jsdom
/*
 * Retrato das texturas procedurais das áreas galeria, lounge, cofre e doca (lote R73) com o desenho de verdade: o
 * navegador falso deixa de se chamar "jsdom" antes de carregar os módulos (os kits das áreas usam FAKE = /jsdom/ para
 * sair com 8 px nos testes), e cada função de textura roda no tamanho real sobre um contexto 2D gravador. Para cada uma
 * fica o tamanho dos canvas, o número de chamadas de desenho e o digest dos argumentos (e dos pixels gerados).
 */
import { describe, expect, it } from "vitest";
import { recordCanvas, retrato, takeCanvas } from "@/test-utils/heist-areas-retrato";

Object.defineProperty(window.navigator, "userAgent", { value: "retrato-das-areas", configurable: true });
recordCanvas();

type TexFn = () => unknown;
/** Chama a função e devolve o que o gravador viu (texturas com cache: a primeira chamada desenha). */
function take(fn: TexFn) {
  takeCanvas();
  fn();
  return takeCanvas();
}

describe("texturas das áreas no tamanho real", { timeout: 60_000 }, () => {
  it("galeria: parquet, granito, gesso, tecido, textos, etiquetas, arte, aurora, lanternim e manchas de luz", async () => {
    const T = await import("./galeria-tex"), J = await import("./galeria-trajes");
    const out: Record<string, unknown> = {
      floorOak: take(() => T.floorOak("low")), graniteMat: take(() => T.graniteMat("low", true)), plasterMat: take(() => T.plasterMat("low")),
      clothWall: take(() => T.clothWall("low")), wallBase: take(() => T.wallBase("low")),
      wallTextAtlasPt: take(() => T.wallTextAtlas("low", "pt")), wallTextAtlasEn: take(() => T.wallTextAtlas("high", "en")),
      creditsAtlas: take(() => T.creditsAtlas("low", "pt")), friezeText: take(() => T.friezeText("low", { exhibitTitle: "Aurora", exhibitSub: "a arte do vestido" } as never)),
      labelAtlas: take(() => T.labelAtlas("low", "pt")), labelAtlasEs: take(() => T.labelAtlas("high", "es")), artAtlas: take(() => T.artAtlas("low")),
      auroraTex: take(() => T.auroraTex()), laylightMat: take(() => T.laylightMat()), poolTex: take(() => T.poolTex()), coveTex: take(() => T.coveTex()),
      satinDegrade: take(() => J.satin("retrato", "#ffffff", { stops: ["#9c86f0", "#d79ad8", "#fde7b8"] })),
      consts: { HB_TILE: T.HB_TILE, SECTION: T.SECTION, LABEL: [T.LABEL_COLS, T.LABEL_ROWS, T.CATALOG_COVER], ART: [T.ART_COLS, T.ART_ROWS] },
    };
    await expect(JSON.stringify(out, null, 1)).toMatchFileSnapshot("./__retratos__/tex-galeria.json");
  });

  it("lounge: parquet, damasco, tapetes, franja, espelho, ônix, caixotão, rótulos, cardápio, partitura, livros, pintura e biombo", async () => {
    const T = await import("./lounge-tex");
    const out: Record<string, unknown> = {
      parquetSurface: take(() => T.parquetSurface("low")), damaskSurface: take(() => T.damaskSurface("low")),
      rugA: take(() => T.rugTexture("a", "low", 1)), rugB: take(() => T.rugTexture("b", "low", 1.5)), fringeTexture: take(() => T.fringeTexture()),
      agedMirrorTexture: take(() => T.agedMirrorTexture("low")), onyxSurface: take(() => T.onyxSurface("low")), cofferTexture: take(() => T.cofferTexture()),
      labelAtlas: take(() => T.labelAtlas()), menuTexture: take(() => T.menuTexture("Bar Lumière")), scoreTexture: take(() => T.scoreTexture()),
      bookAtlas: take(() => T.bookAtlas()), paintingTexture: take(() => T.paintingTexture()), screenTexture: take(() => T.screenTexture()),
      consts: { PARQUET_TILE: T.PARQUET_TILE, DAMASK_TILE: T.DAMASK_TILE, LABELS: T.LABELS, BOOKS: T.BOOKS },
    };
    await expect(JSON.stringify(out, null, 1)).toMatchFileSnapshot("./__retratos__/tex-lounge.json");
  });

  it("cofre: mármores, latão da rosácea, damasco, laca, anéis da trava, laudo e etiquetas", async () => {
    const T = await import("./cofre-tex");
    const out: Record<string, unknown> = {
      floorNero: take(() => T.floorNero("low")), neroMat: take(() => T.neroMat("low")), rossoMat: take(() => T.rossoMat("low", true)), thassosMat: take(() => T.thassosMat("low")),
      inlayBrass: take(() => T.inlayBrass("low")), damaskMat: take(() => T.damaskMat("low")), lacquerPlum: take(() => T.lacquerPlum()),
      ringTex: take(() => T.ringTex()), reportTex: take(() => T.reportTex("pt")), reportTexEn: take(() => T.reportTex("en")), tagAtlas: take(() => T.tagAtlas("low", "pt")),
      consts: { NERO_TILE: T.NERO_TILE, DAMASK_TILE: T.DAMASK_TILE, LABEL_N: T.LABEL_N },
    };
    await expect(JSON.stringify(out, null, 1)).toMatchFileSnapshot("./__retratos__/tex-cofre.json");
  });

  it("doca: concreto, bloco pintado, telha de aço, laminado e a folha de desenhos", async () => {
    const T = await import("./doca-tex");
    const atlas = take(() => T.docaAtlas("low")), rects = T.docaAtlas("low").rects;
    const out: Record<string, unknown> = {
      floorSurface: take(() => T.floorSurface("low")), wallSurface: take(() => T.wallSurface("low")), deckSurface: take(() => T.deckSurface("low")),
      laminateSurface: take(() => T.laminateSurface("low")), docaAtlas: atlas, docaAtlasHigh: take(() => T.docaAtlas("high")),
      rects, consts: { FLOOR_TILE: T.FLOOR_TILE, WALL_TILE: T.WALL_TILE },
    };
    await expect(JSON.stringify(out, null, 1)).toMatchFileSnapshot("./__retratos__/tex-doca.json");
  });
});

describe("as áreas inteiras com as texturas no tamanho real (as que só o desenho da área cria: lavagens, luar, brilho)", { timeout: 60_000 }, () => {
  for (const name of ["galeria", "lounge", "cofre", "doca"] as const) {
    it(name, async () => {
      const { M } = await import("../interior-mats"), { AREA } = await import(`./${name}`);
      const P = M("low");
      const r = retrato(AREA, "low", P);
      expect(r.batch.length).toBeGreaterThan(5);
      await expect(JSON.stringify(r, null, 1)).toMatchFileSnapshot(`./__retratos__/${name}-low-real.json`);
    });
  }
});
