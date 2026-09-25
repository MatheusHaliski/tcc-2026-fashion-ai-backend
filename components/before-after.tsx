"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { Button, useToast } from "@/components/ui";
import { drawContain, fileSlug, loadImage, newCanvas, saveCanvas } from "@/lib/export/canvas";

/**
 * DET-D09 — Antes e depois da peça: um controle deslizante compara a foto original com o flat lay tratado pelo
 * pipeline do RF4. A comparação pode ser exportada como imagem (lado a lado, 4:5 cada metade).
 */
export function BeforeAfter({ before, after, name }: { before: string; after: string; name: string }) {
  const { t } = useI18n(); const toast = useToast();
  const [pos, setPos] = useState(50); const [busy, setBusy] = useState(false);
  async function exportImage() {
    setBusy(true);
    try {
      const [a, b] = await Promise.all([loadImage(before), loadImage(after)]);
      const [c, ctx] = newCanvas(2160, 1350);
      ctx.fillStyle = "#EDEAE4"; ctx.fillRect(0, 0, 1080, 1350); ctx.fillStyle = "#FFFFFF"; ctx.fillRect(1080, 0, 1080, 1350);
      drawContain(ctx, a, 60, 60, 960, 1150); drawContain(ctx, b, 1140, 60, 960, 1150);
      ctx.fillStyle = "#1A1714"; ctx.fillRect(1078, 0, 4, 1350);
      ctx.font = "600 34px system-ui, sans-serif"; ctx.fillStyle = "#1A1714"; ctx.textBaseline = "alphabetic";
      ctx.fillText(t("beforeAfter.antes").toUpperCase(), 60, 1290); ctx.fillText(t("beforeAfter.depois").toUpperCase(), 1140, 1290);
      ctx.font = "400 26px system-ui, sans-serif"; ctx.fillStyle = "#5C554D"; ctx.textAlign = "right";
      ctx.fillText(`${name} · FashionAI`, 2100, 1290);
      await saveCanvas(c, `antes-e-depois-${fileSlug(name)}.png`);
    } catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  return (
    <div>
      <div className="before-after" style={{ ["--ba" as string]: `${pos}%` }}>
        <img src={after} alt={t("beforeAfter.depois_alt", { name })} className="before-after-img" />
        <div className="before-after-before" aria-hidden><img src={before} alt="" className="before-after-img" /></div>
        <span className="before-after-divider" aria-hidden />
        <span className="before-after-tag is-before" aria-hidden>{t("beforeAfter.antes")}</span>
        <span className="before-after-tag is-after" aria-hidden>{t("beforeAfter.depois")}</span>
        <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} className="before-after-range" aria-label={t("beforeAfter.comparar", { name })} aria-valuetext={t("beforeAfter.valor", { n: pos })} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 p-3">
        <p className="type-caption text-muted">{t("beforeAfter.legenda")}</p>
        <Button size="sm" onClick={exportImage} loading={busy}>{t("beforeAfter.exportar")}</Button>
      </div>
    </div>
  );
}
