#!/usr/bin/env node
/**
 * Converte as gravações brutas (out/<modo>.raw.webm, do record.mjs) nas mídias finais de public/flair/demos:
 * MP4 (H.264, yuv420p, faststart) + WebM (VP9) otimizados, sem áudio, e uma capa JPG do primeiro quadro útil.
 * O começo da gravação (página ainda carregando) é cortado: a demonstração começa direto na interface.
 *
 * Uso: node scripts/flair-demos/encode.mjs [modo…]
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out");
/** clipes da central de FAI Points vão para public/points/demos; os demais, public/flair/demos */
const POINTS = new Set(["balance", "earn", "store", "statement"]);
const destOf = (id) => { const d = join(HERE, "..", "..", "public", POINTS.has(id) ? "points" : "flair", "demos"); mkdirSync(d, { recursive: true }); return d; };
const TRIM_DEFAULT = Number(process.env.DEMO_TRIM ?? "1.6");   // corte do início quando a gravação não registrou o instante em que a interface ficou pronta
const MAX = Number(process.env.DEMO_MAX ?? "19.5");    // duração máxima: acima disso o clipe é levemente acelerado (até 1,6×) para caber em 10–20 s
const args = process.argv.slice(2);
const POSTERS_ONLY = args.includes("--posters");   // só regenera as capas (quadro já com a interface carregada)
const ids = args.filter((a) => !a.startsWith("--")).length ? args.filter((a) => !a.startsWith("--")) : readdirSync(OUT).filter((f) => f.endsWith(".raw.webm")).map((f) => f.replace(".raw.webm", ""));
const POSTER_AT = Number(process.env.DEMO_POSTER_AT ?? "5");
const ff = (args) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
const probe = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString().trim());

for (const id of ids) {
  const src = join(OUT, `${id}.raw.webm`);
  if (!existsSync(src)) { console.log(`[${id}] sem gravação`); continue; }
  const DEST = destOf(id);
  // corte do início: o instante em que a interface ficou pronta (gravado pelo record.mjs) ou DEMO_TRIM
  const meta = existsSync(join(OUT, `${id}.json`)) ? JSON.parse(readFileSync(join(OUT, `${id}.json`), "utf8")) : {};
  const TRIM = typeof meta.ready === "number" ? meta.ready + 0.15 : TRIM_DEFAULT;
  const dur = probe(src) - TRIM;
  const speed = Math.min(1.6, Math.max(1, dur / MAX));
  const common = ["-ss", String(TRIM), "-i", src, "-an", "-vf", `setpts=PTS/${speed.toFixed(3)},scale=1280:720:flags=lanczos,format=yuv420p`, "-r", "30"];
  if (!POSTERS_ONLY) {
    ff([...common, "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-profile:v", "high", "-level", "4.0", "-movflags", "+faststart", join(DEST, `${id}.mp4`)]);
    ff([...common, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "34", "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", join(DEST, `${id}.webm`)]);
  }
  ff(["-ss", String(Math.min(TRIM + POSTER_AT, TRIM + dur - 0.5)), "-i", src, "-frames:v", "1", "-vf", "scale=1280:720:flags=lanczos", "-q:v", "3", join(DEST, `${id}.jpg`)]);
  const mb = (f) => (statSync(f).size / 1024 / 1024).toFixed(2);
  if (POSTERS_ONLY) { console.log(`[${id}] capa ${mb(join(DEST, `${id}.jpg`))} MB`); continue; }
  console.log(`[${id}] ${(dur / speed).toFixed(1)} s${speed > 1 ? ` (${speed.toFixed(2)}×)` : ""} · mp4 ${mb(join(DEST, `${id}.mp4`))} MB · webm ${mb(join(DEST, `${id}.webm`))} MB · capa ${mb(join(DEST, `${id}.jpg`))} MB`);
}
