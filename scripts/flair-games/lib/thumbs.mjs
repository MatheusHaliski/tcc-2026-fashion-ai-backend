/**
 * Miniaturas dos jogos (desenho §2.2 e R25): o SVG de scene-svg.mjs vira WebP 640×400 com o sharp já presente em
 * node_modules. Sem IA, sem rede: só o scene_json do catálogo. Uma miniatura por slug, sobrescrita a cada build.
 */
import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { sceneSvg } from "../scene-svg.mjs";
import { photoOf } from "./venue-map.mjs";

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

const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/**
 * Miniatura fotográfica: a foto real do ambiente, com gradação para a faixa de texto, as vagas como pontos de luz na cor
 * de destaque da cena (a promessa do que acende ao jogar) e a faixa "Nº 01 · Série A · nome".
 */
export async function photoThumb(game, photoFile, sharp) {
  const W = THUMB_WIDTH, H = THUMB_HEIGHT, accent = game.scene?.accent ?? "#ffd76a";
  const coords = Object.values(game.scene?.slots ?? {});
  const lights = coords.map(([x, y]) => `<circle cx="${(x / 100) * W}" cy="${(y / 100) * H}" r="22" fill="url(#g)"/><circle cx="${(x / 100) * W}" cy="${(y / 100) * H}" r="3.5" fill="#fff"/>`).join("");
  const overlay = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><defs>
    <radialGradient id="g"><stop offset="0" stop-color="${esc(accent)}" stop-opacity=".85"/><stop offset="1" stop-color="${esc(accent)}" stop-opacity="0"/></radialGradient>
    <linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".82"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#b)"/>${lights}
    <text x="18" y="${H - 44}" font-family="DejaVu Sans, sans-serif" font-size="15" font-weight="700" fill="#fff" fill-opacity=".8" letter-spacing="2">Nº ${String(game.number).padStart(2, "0")} · SÉRIE ${esc(game.series)}</text>
    <text x="18" y="${H - 18}" font-family="DejaVu Serif, serif" font-size="24" font-weight="700" fill="#fff">${esc(game.names?.["pt-BR"])}</text></svg>`;
  return sharp(photoFile).resize(W, H, { fit: "cover", position: "attention" }).modulate({ brightness: 0.92, saturation: 1.08 })
    .composite([{ input: Buffer.from(overlay), top: 0, left: 0 }]).webp({ quality: 82 }).toBuffer();
}

/** Gera a miniatura de um jogo (foto do ambiente quando houver; senão o desenho 2D) e devolve o caminho gravado. */
export async function writeThumb(game, dir, sharpImpl, { root } = {}) {
  await mkdir(dir, { recursive: true });
  const file = thumbFile(dir, game.slug);
  const rel = game.scene?.photo ?? photoOf(game.number);
  const photo = root && rel ? join(root, "public", rel) : null;
  if (photo && (await access(photo).then(() => true, () => false))) {
    await writeFile(file, await photoThumb(game, photo, sharpImpl ?? (await loadSharp())));
    return file;
  }
  const svg = sceneSvg({ scene: game.scene, slots: game.slots, number: game.number, series: game.series, name: game.names?.["pt-BR"] ?? "" });
  await writeFile(file, await svgToWebp(svg, sharpImpl));
  return file;
}

/** Gera todas as miniaturas em sequência (determinístico, sem disputa de disco) e devolve os caminhos. */
export async function writeThumbs(games, dir, sharpImpl, opts = {}) {
  const sharp = sharpImpl ?? (await loadSharp());
  const files = [];
  for (const game of [...games].sort((a, b) => a.number - b.number)) {
    files.push(await writeThumb(game, dir, sharp, opts));
  }
  return files;
}
