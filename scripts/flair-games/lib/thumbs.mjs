/**
 * Miniaturas dos jogos (desenho §2.2 e R25): o SVG de scene-svg.mjs vira WebP 640×400 com o sharp já presente em
 * node_modules. Sem IA, sem rede: só o scene_json do catálogo. Uma miniatura por slug, sobrescrita a cada build.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { sceneSvg } from "../scene-svg.mjs";

export const THUMB_WIDTH = 640;
export const THUMB_HEIGHT = 400;

/** Carrega o sharp sob demanda (o build com --no-thumbs não precisa dele). */
async function loadSharp() {
  const mod = await import("sharp");
  return mod.default ?? mod;
}

/** Converte uma string SVG em WebP 640×400 (Buffer). */
export async function svgToWebp(svg, sharpImpl) {
  const sharp = sharpImpl ?? (await loadSharp());
  return sharp(Buffer.from(svg), { density: 192 })
    .resize(THUMB_WIDTH, THUMB_HEIGHT, { fit: "cover" })
    .webp({ quality: 82 })
    .toBuffer();
}

/** Caminho do arquivo da miniatura de um slug dentro de `dir`. */
export function thumbFile(dir, slug) {
  return join(dir, `${slug}.webp`);
}

/** Gera a miniatura de um jogo e devolve o caminho gravado. */
export async function writeThumb(game, dir, sharpImpl) {
  await mkdir(dir, { recursive: true });
  const svg = sceneSvg({ scene: game.scene, slots: game.slots, number: game.number, series: game.series, name: game.names?.["pt-BR"] ?? "" });
  const file = thumbFile(dir, game.slug);
  await writeFile(file, await svgToWebp(svg, sharpImpl));
  return file;
}

/** Gera todas as miniaturas em sequência (determinístico, sem disputa de disco) e devolve os caminhos. */
export async function writeThumbs(games, dir, sharpImpl) {
  const sharp = sharpImpl ?? (await loadSharp());
  const files = [];
  for (const game of [...games].sort((a, b) => a.number - b.number)) {
    files.push(await writeThumb(game, dir, sharp));
  }
  return files;
}
