"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { CATEGORY_KEYS, label } from "@/lib/api/taxonomy";
import { lensApi } from "@/lib/lens/api";
import type { LensDetectionView } from "@/lib/lens/types";
import { useToast } from "@/components/ui";
import { useLens } from "./lens-context";
import { suggestCategoryFromImage, type SuggestedCategory } from "@/lib/pieces/type-suggestion";

/** Sugestão de tipo pela forma do recorte da peça (leitura local); nula enquanto calcula ou quando a forma não é clara. */
function useShapeSuggestion(imageUrl: string | null, detection: LensDetectionView) {
  const [hint, setHint] = useState<SuggestedCategory | null>(null);
  const { x, y, w, h } = detection.box;
  useEffect(() => {
    if (!imageUrl) return;
    let alive = true;
    void suggestCategoryFromImage(imageUrl, { x, y, width: w, height: h }).then((c) => { if (alive) setHint(c); });
    return () => { alive = false; };
  }, [imageUrl, x, y, w, h]);
  return hint;
}

/**
 * Peça que a leitura não soube classificar: em vez de ficar só "Peça", o cartão pergunta o tipo. Um toque grava a
 * correção (a mesma do botão "Corrigir") e refaz as peças parecidas na hora.
 */
export function LensCategoryPick({ detection }: { detection: LensDetectionView }) {
  const { t } = useI18n();
  const toast = useToast();
  const { scan, imageUrl, updateDetection } = useLens();
  const [busy, setBusy] = useState<string | null>(null);
  const hint = useShapeSuggestion(imageUrl, detection);

  async function pick(category: string) {
    setBusy(category);
    try {
      const updated = await lensApi.patchDetection(scan.id, detection.id, { category });
      updateDetection(updated, { refresh: true });
      toast.success(t("lens.category_pick.saved", { category: label(category) }));
    } catch (e) {
      toast.fromError(e);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="lens-cat-pick" role="group" aria-label={t("lens.category_pick.title")}>
      <p className="lens-cat-pick-title">{t("lens.category_pick.title")}</p>
      {hint && <p className="type-caption" data-testid="lens-type-suggestion">{t("lens.category_pick.sugestao", { category: label(hint) })}</p>}
      <div className="lens-cat-pick-options">
        {CATEGORY_KEYS.map((category) => (
          <button
            key={category}
            type="button"
            className={hint === category ? "chip is-active" : "chip"}
            disabled={busy !== null}
            aria-busy={busy === category || undefined}
            onClick={() => pick(category)}
          >
            {hint === category ? t("lens.category_pick.sugerida", { category: label(category) }) : label(category)}
          </button>
        ))}
      </div>
    </div>
  );
}
