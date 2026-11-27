/**
 * Desenho de um quadro do vídeo da partida num canvas 2D: a foto do cenário do modo ao fundo (escurecida), o placar, o
 * tema, as cartas de roupa de cada lado com a moldura do nível e, na rodada, o efeito da carta no cenário (cone de
 * luz sobre a vencedora, clarão no empate). Textos chegam prontos (já traduzidos) em {@link ReplayTexts}.
 */
import type { MatchCard } from "@/lib/flair/match-stage";
import { slideIn, type ReplayFrame } from "@/lib/flair/replay/timeline";

export const REPLAY_W = 960;
export const REPLAY_H = 540;
export interface ReplayTexts { title: string; labelA: string; labelB: string; theme: string | null; finalText: string; round: (n: number, label: string) => string }
/** Imagens já carregadas (cenário e cartas por id); a que não carregou fica de fora e a carta vira só o nome. */
export interface ReplayImages { scene: CanvasImageSource | null; cards: Map<string, CanvasImageSource> }

const TIER_COLOR: Record<string, string> = { BRONZE: "#b08d57", PRATA: "#c9ced6", OURO: "#e9b949", ESPECIAL: "#c6275e" };
const ACCENT_A = "#e0457b";
const ACCENT_B = "#3a86ff";

function cover(ctx: CanvasRenderingContext2D, img: CanvasImageSource, w: number, h: number) {
  const iw = (img as HTMLImageElement).naturalWidth || w, ih = (img as HTMLImageElement).naturalHeight || h;
  const s = Math.max(w / iw, h / ih);
  ctx.drawImage(img, (w - iw * s) / 2, (h - ih * s) / 2, iw * s, ih * s);
}

function card(ctx: CanvasRenderingContext2D, c: MatchCard | null, img: CanvasImageSource | undefined, x: number, y: number, lit: number, accent: string) {
  const w = 200, h = 270;
  ctx.save();
  ctx.globalAlpha = 0.35 + 0.65 * lit;
  ctx.shadowColor = accent; ctx.shadowBlur = 40 * lit;
  ctx.fillStyle = "#14121a"; ctx.strokeStyle = TIER_COLOR[c?.tier ?? "BRONZE"]; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, 16); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  if (img) ctx.drawImage(img, x - w / 2 + 12, y - h / 2 + 12, w - 24, h - 74);
  ctx.fillStyle = "#fff"; ctx.font = "600 18px system-ui, sans-serif"; ctx.textAlign = "center";
  ctx.fillText((c?.name ?? "—").slice(0, 20), x, y + h / 2 - 26);
  ctx.restore();
}

function spotlight(ctx: CanvasRenderingContext2D, x: number, strength: number, color: string) {
  const g = ctx.createRadialGradient(x, 0, 10, x, REPLAY_H * 0.55, REPLAY_H * 0.75);
  g.addColorStop(0, `${color}cc`); g.addColorStop(1, `${color}00`);
  ctx.save(); ctx.globalAlpha = strength; ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(x - 40, 0); ctx.lineTo(x + 40, 0); ctx.lineTo(x + 220, REPLAY_H); ctx.lineTo(x - 220, REPLAY_H); ctx.closePath(); ctx.fill();
  ctx.restore();
}

export function drawFrame(ctx: CanvasRenderingContext2D, f: ReplayFrame, img: ReplayImages, tx: ReplayTexts) {
  ctx.clearRect(0, 0, REPLAY_W, REPLAY_H);
  ctx.fillStyle = "#0b0a10"; ctx.fillRect(0, 0, REPLAY_W, REPLAY_H);
  if (img.scene) { ctx.save(); ctx.globalAlpha = f.phase === "intro" ? 0.4 + 0.5 * f.progress : 0.9; cover(ctx, img.scene, REPLAY_W, REPLAY_H); ctx.restore(); }
  const shade = ctx.createLinearGradient(0, 0, 0, REPLAY_H);
  shade.addColorStop(0, "rgba(0,0,0,.65)"); shade.addColorStop(0.5, "rgba(0,0,0,.2)"); shade.addColorStop(1, "rgba(0,0,0,.75)");
  ctx.fillStyle = shade; ctx.fillRect(0, 0, REPLAY_W, REPLAY_H);
  ctx.textAlign = "center"; ctx.fillStyle = "#fff";
  ctx.font = "700 44px system-ui, sans-serif"; ctx.fillText(`${f.score.A} × ${f.score.B}`, REPLAY_W / 2, 60);
  ctx.font = "600 20px system-ui, sans-serif";
  ctx.fillStyle = ACCENT_A; ctx.textAlign = "left"; ctx.fillText(tx.labelA.slice(0, 22), 24, 50);
  ctx.fillStyle = ACCENT_B; ctx.textAlign = "right"; ctx.fillText(tx.labelB.slice(0, 22), REPLAY_W - 24, 50);
  ctx.textAlign = "center"; ctx.fillStyle = "#fff";
  if (f.phase === "intro") {
    ctx.font = "800 48px system-ui, sans-serif"; ctx.fillText(tx.title, REPLAY_W / 2, REPLAY_H / 2);
    if (tx.theme) { ctx.font = "500 24px system-ui, sans-serif"; ctx.fillText(tx.theme, REPLAY_W / 2, REPLAY_H / 2 + 44); }
    return;
  }
  if (f.phase === "moment" && f.moment) {
    const m = f.moment, off = slideIn(f.progress) * 420, lit = f.progress >= 0.5;
    const litA = !lit ? 0.6 : m.winner === "A" ? 1 : m.winner === "DRAW" ? 0.8 : 0.25;
    const litB = !lit ? 0.6 : m.winner === "B" ? 1 : m.winner === "DRAW" ? 0.8 : 0.25;
    if (lit && m.winner !== "B") spotlight(ctx, 260, m.winner === "A" ? 1 : 0.5, ACCENT_A);
    if (lit && m.winner !== "A") spotlight(ctx, REPLAY_W - 260, m.winner === "B" ? 1 : 0.5, ACCENT_B);
    card(ctx, m.a, m.a ? img.cards.get(m.a.id) : undefined, 260 - off, 300, litA, ACCENT_A);
    card(ctx, m.b, m.b ? img.cards.get(m.b.id) : undefined, REPLAY_W - 260 + off, 300, litB, ACCENT_B);
    ctx.font = "600 22px system-ui, sans-serif"; ctx.fillStyle = "#fff";
    ctx.fillText(tx.round(m.index + 1, m.label), REPLAY_W / 2, REPLAY_H - 30);
    ctx.font = "700 30px system-ui, sans-serif"; ctx.fillText(`${m.scoreA} · ${m.scoreB}`, REPLAY_W / 2, 300);
    return;
  }
  const gold = ctx.createRadialGradient(REPLAY_W / 2, REPLAY_H / 2, 10, REPLAY_W / 2, REPLAY_H / 2, 420);
  gold.addColorStop(0, `rgba(233,185,73,${0.55 * f.progress})`); gold.addColorStop(1, "rgba(233,185,73,0)");
  ctx.fillStyle = gold; ctx.fillRect(0, 0, REPLAY_W, REPLAY_H);
  ctx.fillStyle = "#fff"; ctx.font = "800 46px system-ui, sans-serif"; ctx.fillText(tx.finalText, REPLAY_W / 2, REPLAY_H / 2 + 10);
}
