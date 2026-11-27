import { describe, expect, it } from "vitest";
import { criarCtxFalso } from "@/lib/flair/cenas/ctx-falso";
import { folgaDaPeca } from "@/lib/flair/elencos/jigsaw";
import { poseDoLogo } from "@/lib/flair/montagem/dinamico/movimento";
import { cobrir, pintarLogo, pintarQuebraCabeca, pintarVideo, type PecaNoQuadro } from "@/lib/flair/montagem/dinamico/pintura";
import { pecasDinamicas } from "@/lib/flair/montagem/dinamico/recorte";

const APOIO = {} as CanvasImageSource;
const caminho = (d: string) => ({ d }) as unknown as Path2D;

describe("pintura do quebra-cabeça dinâmico", () => {
  it("cobre o destino sem distorcer, dentro da janela", () => {
    expect(cobrir(1280, 720, { x: 0, y: 0, w: 1, h: 1 }, 100, 100)).toEqual([280, 0, 720, 720]);
    expect(cobrir(960, 720, { x: 0, y: 0, w: 1, h: 1 }, 400, 300)).toEqual([0, 0, 960, 720]);
    expect(cobrir(480, 480, { x: 0, y: 0, w: 1, h: 1 }, 200, 100)).toEqual([0, 120, 480, 240]);
  });

  it("pinta o quadro do vídeo só quando ele tem tamanho", () => {
    const f = criarCtxFalso();
    pintarVideo(f.ctx, APOIO, 0, 0, { x: 0, y: 0, w: 1, h: 1 }, 100, 100);
    expect(f.conta("drawImage")).toBe(0);
    pintarVideo(f.ctx, APOIO, 480, 480, { x: 0, y: 0, w: 1, h: 1 }, 100, 100);
    expect(f.chamadas.find((c) => c.metodo === "drawImage")?.args).toEqual([APOIO, 0, 0, 480, 480, 0, 0, 100, 100]);
  });

  it("o símbolo gira na pose do instante, com os brilhos em órbita", () => {
    const f = criarCtxFalso();
    pintarLogo(f.ctx, APOIO, poseDoLogo(6), 6, 200, 200);
    expect(f.chamadas.find((c) => c.metodo === "rotate")?.args[0]).toBeCloseTo(Math.PI / 2);
    expect(f.conta("arc")).toBe(13);   // o recorte redondo do símbolo e os 12 brilhos
    expect(f.conta("clip")).toBe(1);
    const sem = criarCtxFalso();
    pintarLogo(sem.ctx, null, poseDoLogo(0), 0, 200, 200);
    expect(sem.conta("drawImage")).toBe(0);
  });

  it("cada peça posta é uma janela do mesmo quadro; a vazia é só o contorno", () => {
    const formas = pecasDinamicas("grade", 4, 100);
    const estados = ["verde", "coberta", "vermelha", "chegando"] as const;
    const pecas: PecaNoQuadro[] = formas.map((p, i) => ({ ...p, estado: estados[i], folga: folgaDaPeca(i, estados[i]), alfa: estados[i] === "coberta" ? 0 : 1 }));
    const f = criarCtxFalso();
    pintarQuebraCabeca(f.ctx, { apoio: APOIO, escala: 4, largura: 100, completo: false }, pecas, caminho);
    // o fundo apagado e três peças com conteúdo (a coberta não desenha o quadro)
    expect(f.conta("drawImage")).toBe(4);
    expect(f.conta("clip")).toBe(3);
    expect(f.conta("stroke")).toBe(4);
    expect(f.chamadas.filter((c) => c.metodo === "drawImage").every((c) => c.args[0] === APOIO)).toBe(true);
  });

  it("completo, o quadro inteiro sem emendas", () => {
    const f = criarCtxFalso();
    pintarQuebraCabeca(f.ctx, { apoio: APOIO, escala: 4, largura: 100, completo: true }, [], caminho);
    expect(f.conta("drawImage")).toBe(1);
    expect(f.conta("stroke")).toBe(0);
  });
});
