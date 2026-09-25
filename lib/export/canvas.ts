/**
 * Exportação de imagens montadas no navegador (Look do Dia, capa FAI Magazine, antes e depois, modo foto do quarto).
 * As imagens vêm do backend (/media) ou de /public; o backend libera CORS, então o canvas não fica "sujo".
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, fail) => {
    const img = new Image();
    if (!src.startsWith("data:") && !src.startsWith("blob:")) img.crossOrigin = "anonymous";
    img.onload = () => ok(img); img.onerror = () => fail(new Error(`imagem indisponível: ${src}`));
    img.src = src;
  });
}

/** Desenha a imagem cobrindo o quadro (corta as sobras), como object-fit: cover. */
export function drawCover(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height); const dw = img.width * s, dh = img.height * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/** Desenha a imagem inteira dentro do quadro, como object-fit: contain. */
export function drawContain(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, x: number, y: number, w: number, h: number) {
  const s = Math.min(w / img.width, h / img.height); const dw = img.width * s, dh = img.height * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/** Quebra o texto em até maxLines linhas dentro de maxW; devolve o y depois da última linha. */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number, maxLines = 3): number {
  const words = text.split(/\s+/).filter(Boolean); let line = ""; let lines = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxW && line) {
      if (lines === maxLines - 1) { ctx.fillText(`${line}…`, x, y); return y + lineH; }
      ctx.fillText(line, x, y); y += lineH; lines++; line = words[i];
    } else line = test;
  }
  if (line) { ctx.fillText(line, x, y); y += lineH; }
  return y;
}

export function newCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  return [c, c.getContext("2d")!];
}

/** Baixa o canvas como arquivo (PNG por padrão; JPEG para fotos grandes). */
export async function saveCanvas(canvas: HTMLCanvasElement, filename: string, type: "image/png" | "image/jpeg" = "image/png", quality = 0.92) {
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, type, quality));
  if (!blob) throw new Error("canvas vazio");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Nome de arquivo seguro a partir de um título. */
export function fileSlug(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "fashionai";
}
