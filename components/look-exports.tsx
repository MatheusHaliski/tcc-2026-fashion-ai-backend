"use client";
import { useState } from "react";
import { mediaUrl } from "@/lib/api/client";
import type { SchemeView } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { useAuth } from "@/lib/auth/session";
import { Button, useToast } from "@/components/ui";
import { drawContain, drawCover, fileSlug, loadImage, newCanvas, saveCanvas, wrapText } from "@/lib/export/canvas";

/** Faixa "Arrasando no Look" começa em 85 (RF6); a capa da FAI Magazine só aparece dali para cima (DET-K07). */
export const MAGAZINE_MIN_HYPE = 85;
const W = 1080, H = 1350; // 4:5 — formato de feed

/** Foto do look: a capa do esquema ou, sem capa, um mosaico das peças sobre fundo claro. */
async function drawLook(ctx: CanvasRenderingContext2D, s: SchemeView, x: number, y: number, w: number, h: number) {
  const cover = mediaUrl(s.coverImageUrl ?? s.mannequinImageUrl ?? undefined);
  if (cover) { try { drawCover(ctx, await loadImage(cover), x, y, w, h); return; } catch { /* cai no mosaico */ } }
  ctx.fillStyle = "#F1EEE8"; ctx.fillRect(x, y, w, h);
  const srcs = s.items.map((i) => mediaUrl(i.piece?.imageUrl ?? i.imageUrl ?? i.piece?.thumbnailUrl ?? undefined)).filter((u): u is string => !!u).slice(0, 4);
  const imgs = (await Promise.all(srcs.map((u) => loadImage(u).catch(() => null)))).filter((i): i is HTMLImageElement => !!i);
  const cols = imgs.length > 1 ? 2 : 1, rows = Math.ceil(imgs.length / cols) || 1; const cw = w / cols, ch = h / rows;
  imgs.forEach((img, i) => drawContain(ctx, img, x + (i % cols) * cw + 24, y + Math.floor(i / cols) * ch + 24, cw - 48, ch - 48));
}

/**
 * DET-C10 — #lookdodia: o Look do Dia sai num formato pronto para o feed (4:5, 1080×1350).
 * DET-K07 — capa FAI Magazine: com Hype Score na faixa "Arrasando no Look" ou acima, o usuário ganha uma capa editorial
 * com o look e o nome dele. O desenho é próprio da FashionAI; nenhuma marca editorial real é imitada.
 */
export function LookExports({ scheme, hype, bandLabel, date }: { scheme: SchemeView; hype: number; bandLabel?: string; date?: string }) {
  const { t, fmtDate } = useI18n(); const toast = useToast(); const { user } = useAuth();
  const [busy, setBusy] = useState<"feed" | "cover" | null>(null);
  const name = user?.displayName ?? scheme.owner?.displayName ?? scheme.owner?.username ?? "";
  const day = fmtDate(date ?? new Date().toISOString());

  async function feed() {
    setBusy("feed");
    try {
      const [c, ctx] = newCanvas(W, H);
      await drawLook(ctx, scheme, 0, 0, W, H);
      const g = ctx.createLinearGradient(0, H * 0.58, 0, H); g.addColorStop(0, "rgba(16,14,12,0)"); g.addColorStop(1, "rgba(16,14,12,0.78)");
      ctx.fillStyle = g; ctx.fillRect(0, H * 0.58, W, H * 0.42);
      ctx.fillStyle = "#FFFFFF"; ctx.textBaseline = "alphabetic";
      ctx.font = "700 88px system-ui, sans-serif"; ctx.fillText("#lookdodia", 64, H - 210);
      ctx.font = "500 40px system-ui, sans-serif"; wrapText(ctx, scheme.title, 64, H - 140, W - 128, 48, 2);
      ctx.font = "400 30px system-ui, sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.86)";
      ctx.fillText(`${day} · @${scheme.owner?.username ?? ""}`, 64, H - 56);
      ctx.textAlign = "right"; ctx.font = "700 30px system-ui, sans-serif"; ctx.fillText("FashionAI", W - 64, H - 56);
      await saveCanvas(c, `lookdodia-${fileSlug(scheme.title)}.jpg`, "image/jpeg");
      toast.success(t("lookExports.pronto_para_o_feed"));
    } catch (e) { toast.fromError(e); } finally { setBusy(null); }
  }

  async function cover() {
    setBusy("cover");
    try {
      const [c, ctx] = newCanvas(W, H);
      await drawLook(ctx, scheme, 0, 0, W, H);
      const top = ctx.createLinearGradient(0, 0, 0, 420); top.addColorStop(0, "rgba(12,10,9,0.62)"); top.addColorStop(1, "rgba(12,10,9,0)");
      ctx.fillStyle = top; ctx.fillRect(0, 0, W, 420);
      const bottom = ctx.createLinearGradient(0, H * 0.55, 0, H); bottom.addColorStop(0, "rgba(12,10,9,0)"); bottom.addColorStop(1, "rgba(12,10,9,0.82)");
      ctx.fillStyle = bottom; ctx.fillRect(0, H * 0.55, W, H * 0.45);
      // masthead próprio: "FAI" em serifa grande, "MAGAZINE" espaçado; edição e preço de capa fictício da casa
      ctx.fillStyle = "#FFFFFF"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      ctx.font = "700 220px Georgia, 'Times New Roman', serif"; ctx.fillText("FAI", W / 2, 230);
      ctx.font = "600 34px system-ui, sans-serif"; const mag = "M A G A Z I N E"; ctx.fillText(mag, W / 2, 284);
      ctx.font = "400 24px system-ui, sans-serif"; ctx.textAlign = "left"; ctx.fillText(t("lookExports.edicao", { date: day }), 56, 340);
      ctx.textAlign = "right"; ctx.fillText(`HYPE ${Math.round(hype)}`, W - 56, 340);
      // chamadas de capa
      ctx.textAlign = "left"; ctx.fillStyle = "#FFFFFF";
      ctx.font = "600 30px system-ui, sans-serif"; ctx.fillText((bandLabel || t("lookExports.arrasando")).toUpperCase(), 56, H - 290);
      ctx.font = "700 76px Georgia, 'Times New Roman', serif"; const y = wrapText(ctx, name, 56, H - 206, W - 112, 80, 2);
      ctx.font = "400 34px system-ui, sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.9)"; wrapText(ctx, t("lookExports.chamada", { title: scheme.title }), 56, Math.max(y + 8, H - 110), W - 112, 42, 2);
      ctx.font = "600 22px system-ui, sans-serif"; ctx.textAlign = "right"; ctx.fillStyle = "rgba(255,255,255,0.8)"; ctx.fillText("fashionai", W - 56, H - 40);
      await saveCanvas(c, `fai-magazine-${fileSlug(name || scheme.title)}.jpg`, "image/jpeg");
      toast.success(t("lookExports.capa_pronta"));
    } catch (e) { toast.fromError(e); } finally { setBusy(null); }
  }

  const magazine = hype >= MAGAZINE_MIN_HYPE;
  return (
    <div className="mt-3 grid gap-2">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={feed} loading={busy === "feed"}>{t("lookExports.exportar_lookdodia")}</Button>
        {magazine && <Button size="sm" variant="primary" onClick={cover} loading={busy === "cover"}>{t("lookExports.baixar_capa")}</Button>}
      </div>
      <p className="type-caption text-muted">{magazine ? t("lookExports.capa_liberada", { n: Math.round(hype) }) : t("lookExports.capa_bloqueada", { n: MAGAZINE_MIN_HYPE })}</p>
    </div>
  );
}
