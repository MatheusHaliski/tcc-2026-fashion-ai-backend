/**
 * A fonte em movimento do quebra-cabeça dinâmico (Strategy, docs/refactoring/gof/montagem-fonte-viva.md): o vídeo
 * tocando ou o símbolo FAI animado em código. As duas sabem pintar o quadro do instante numa tela de apoio, de modo que
 * o pintor das peças (pintura.ts) não sabe de onde o quadro vem. O vídeo fica fora do documento, sem som, em laço;
 * parado (movimento reduzido ou miniatura), pinta-se o pôster e o símbolo na pose do instante zero.
 */
import type { Ctx } from "@/lib/flair/cenas/tipos";
import type { Fonte, Janela } from "@/lib/flair/montagem/dinamico/catalogo";
import { poseDoLogo } from "@/lib/flair/montagem/dinamico/movimento";
import { pintarLogo, pintarVideo } from "@/lib/flair/montagem/dinamico/pintura";

export interface FonteViva {
  /** pinta o quadro do instante t (segundos) em w × h; parado, o quadro fixo */
  pintar(ctx: Ctx, w: number, h: number, t: number, parado: boolean): void;
  tocar(): void;
  pausar(): void;
  soltar(): void;
}

const INTEIRA: Janela = { x: 0, y: 0, w: 1, h: 1 };

function imagem(src: string, pronta: () => void): HTMLImageElement {
  const img = new Image();
  img.decoding = "async";
  img.onload = pronta;
  img.src = src;
  return img;
}

const carregada = (img: HTMLImageElement) => img.complete && img.naturalWidth > 0;

function fonteDeVideo(f: Extract<Fonte, { tipo: "video" }>, pronta: () => void): FonteViva {
  const poster = imagem(f.poster, pronta);
  const video = document.createElement("video");
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = "auto";
  video.addEventListener("loadeddata", pronta);
  video.src = f.src;
  return {
    pintar(ctx, w, h, _t, parado) {
      if (!parado && video.readyState >= 2) pintarVideo(ctx, video, video.videoWidth, video.videoHeight, f.janela, w, h);
      else if (carregada(poster)) pintarVideo(ctx, poster, poster.naturalWidth, poster.naturalHeight, INTEIRA, w, h);
    },
    tocar() {
      void video.play?.()?.catch?.(() => {});
    },
    pausar() {
      video.pause?.();
    },
    soltar() {
      video.pause?.();
      video.removeAttribute("src");
      video.load?.();
    },
  };
}

function fonteDeLogo(f: Extract<Fonte, { tipo: "logo" }>, pronta: () => void): FonteViva {
  const img = imagem(f.imagem, pronta);
  return {
    pintar(ctx, w, h, t, parado) {
      const instante = parado ? 0 : t;
      pintarLogo(ctx, carregada(img) ? img : null, poseDoLogo(instante), instante, w, h);
    },
    tocar() {},
    pausar() {},
    soltar() {},
  };
}

export function criarFonteViva(f: Fonte, pronta: () => void): FonteViva {
  return f.tipo === "video" ? fonteDeVideo(f, pronta) : fonteDeLogo(f, pronta);
}
