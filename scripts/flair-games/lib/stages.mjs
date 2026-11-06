// Palcos fotográficos por jogo (scripts/flair-games/data/stages/serie-{a..e}.json): qual foto o jogo usa e onde cada vaga
// fica sobre um objeto real da imagem, com o tipo de luz do ambiente. Formato por jogo:
//   "<número>": { "photo": "<id do arquivo em public/flair/games/scenes>", "anchors": { "<vaga>": { "x": 0..100, "y": 0..100,
//                 "fx": "spot|flash|neon|candle|vitrine|mirror|rack|daylight|screen|lamp", "on": "objeto da foto",
//                 "size": largura do objeto em % da foto (3..40, padrão 12) } } }
// O palco substitui as coordenadas do desenho 2D (mantendo o módulo do quarto na série A) e acrescenta fx/anchors/photo.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export const SCENE_FX = ["spot", "flash", "neon", "candle", "vitrine", "mirror", "rack", "daylight", "screen", "lamp"];

/** Lê todos os palcos (objeto número → palco). Sem pasta, nenhum palco. */
export async function loadStages(dataDir) {
  const dir = join(dataDir, "stages");
  const out = {};
  let names = [];
  try { names = (await readdir(dir)).filter((n) => /^serie-[a-e]\.json$/.test(n)).sort(); } catch { return out; }
  for (const n of names) Object.assign(out, JSON.parse(await readFile(join(dir, n), "utf8")));
  return out;
}

/** Erros do palco de um jogo (vazio = ok). `photos` = ids de foto disponíveis com crédito. */
export function stageErrors(game, stage, photos) {
  const errs = [];
  const add = (m) => errs.push(`jogo ${game.number}: palco: ${m}`);
  if (!stage || typeof stage !== "object") return errs;
  if (typeof stage.photo !== "string" || !photos.has(stage.photo)) add(`foto "${stage.photo}" sem arquivo ou sem crédito`);
  const keys = new Set((game.slots ?? []).map((s) => s.key));
  const anchors = stage.anchors ?? {};
  for (const k of keys) if (!anchors[k]) add(`falta a âncora da vaga ${k}`);
  for (const [k, a] of Object.entries(anchors)) {
    if (!keys.has(k)) add(`âncora de vaga inexistente ${k}`);
    if (typeof a?.x !== "number" || typeof a?.y !== "number" || a.x < 2 || a.x > 98 || a.y < 4 || a.y > 96) add(`${k}: x e y entre 2..98 e 4..96`);
    if (!SCENE_FX.includes(a?.fx)) add(`${k}: fx desconhecido (${a?.fx})`);
    if (typeof a?.on !== "string" || a.on.length < 3) add(`${k}: descreva o objeto da foto em "on"`);
    if (a?.size !== undefined && (typeof a.size !== "number" || a.size < 3 || a.size > 40)) add(`${k}: size (largura do objeto em % da foto) entre 3 e 40`);
  }
  return errs;
}

/** Cena do jogo com o palco aplicado (coordenadas sobre objetos reais, fx e foto). Sem palco, a cena original. */
export function applyStage(game, stage, credits = {}) {
  if (!stage) return game.scene;
  const slots = {};
  for (const [k, v] of Object.entries(game.scene?.slots ?? {})) {
    const a = stage.anchors?.[k];
    slots[k] = a ? (v.length === 3 ? [round(a.x), round(a.y), v[2]] : [round(a.x), round(a.y)]) : v;
  }
  const fx = Object.fromEntries(Object.entries(stage.anchors ?? {}).map(([k, a]) => [k, a.fx]));
  const anchors = Object.fromEntries(Object.entries(stage.anchors ?? {}).map(([k, a]) => [k, a.on]));
  const sizes = Object.fromEntries(Object.entries(stage.anchors ?? {}).map(([k, a]) => [k, a.size ?? 12]));
  const c = credits[stage.photo];
  return { ...game.scene, slots, fx, anchors, sizes, venue: stage.photo, photo: `/flair/games/scenes/${stage.photo}.webp`,
    credit: c ? { title: c.title ?? null, creator: c.creator ?? null, license: c.license, source: c.source ?? null } : null };
}
const round = (n) => Math.round(n * 10) / 10;
