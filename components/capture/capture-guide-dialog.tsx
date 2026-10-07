"use client";
import { useEffect, useMemo, useState } from "react";
import { Button, Dialog, cn } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import { CategoryCards } from "@/components/catalog/category-cards";
import { GarmentGlyph } from "@/components/capture/garment-glyphs";
import { ACCESSORY_TYPES, CATEGORY_CARDS, guideFor, type CaptureCategory, type CaptureGuide } from "@/lib/capture/capture-guides";
import type { useCaptureTutorialPrefs } from "@/lib/capture/tutorial-prefs";

type Step = "category" | "accessory" | "guide";
type Prefs = ReturnType<typeof useCaptureTutorialPrefs>;

/**
 * RF47 · Modal "Como fotografar sua peça": 1) O que você vai adicionar? (cards) → 1b) Qual tipo de acessório? →
 * 2) orientação ilustrada da categoria (regiões que a IA analisa, dicas, foto complementar possível) com
 * "Não mostrar novamente" POR GUIA → 3) adicionar foto. Com a categoria já escolhida na página, abre direto na
 * orientação com "Parte de cima · Alterar" no topo. A ilustração é só orientação, nunca a foto da pessoa.
 */
export function CaptureGuideDialog({ open, onClose, category, subcategory, onCategory, onConfirm, prefs }: {
  open: boolean; onClose: () => void; category?: string | null; subcategory?: string | null;
  /** categoria (e subcategoria do acessório) escolhida dentro do modal — sincroniza a página */
  onCategory: (category: CaptureCategory, subcategory?: string) => void;
  onConfirm: (guide: CaptureGuide) => void; prefs: Prefs;
}) {
  const { t } = useI18n();
  const initialGuide = guideFor(category, subcategory);
  const [step, setStep] = useState<Step>(initialGuide ? "guide" : category === "accessory_piece" ? "accessory" : "category");
  const [moreTips, setMoreTips] = useState(false);
  const guide = useMemo(() => guideFor(category, subcategory), [category, subcategory]);
  useEffect(() => { if (open) { setStep(guideFor(category, subcategory) ? "guide" : category === "accessory_piece" ? "accessory" : "category"); setMoreTips(false); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!open) return null;
  const hidden = guide ? prefs.isHidden(guide.id) : false;
  const steps = [t("pieces.guide.step_category"), t("pieces.guide.step_how"), t("pieces.guide.step_photo")];
  const stepIndex = step === "guide" ? 1 : 0;
  const pickCategory = (c: CaptureCategory) => {
    if (c === "accessory_piece") { onCategory(c); setStep("accessory"); return; }
    onCategory(c);
    setStep("guide");
  };
  const title = step === "category" ? t("pieces.guide.what_will_you_add") : step === "accessory" ? t("pieces.guide.which_accessory") : t("pieces.guide.how_to_photograph");
  return (
    <Dialog open={open} onClose={onClose} title={title} size="lg"
      footer={step === "guide" && guide ? (
        <>
          <label className="mr-auto flex items-center gap-2 type-body-sm"><input type="checkbox" checked={hidden} onChange={(e) => prefs.setHidden(guide.id, e.target.checked)} />{t("pieces.guide.dont_show_again")}</label>
          <Button variant="ghost" onClick={() => setMoreTips((m) => !m)} aria-expanded={moreTips}>{moreTips ? t("pieces.guide.less_tips") : t("pieces.guide.more_tips")}</Button>
          <Button variant="primary" onClick={() => onConfirm(guide)}>{t("pieces.guide.got_it_add_photo")}</Button>
        </>
      ) : step === "accessory" ? <Button variant="ghost" onClick={() => setStep("category")}>{t("common.back")}</Button> : undefined}>
      <ol className="guide-steps" aria-label={t("pieces.guide.steps_label")}>
        {steps.map((s, i) => <li key={s} aria-current={i === stepIndex ? "step" : undefined} className={cn(i < stepIndex && "is-done", i === stepIndex && "is-current")}><span className="guide-step-n">{i + 1}</span>{s}</li>)}
      </ol>
      {step === "category" && (<>
        <p className="type-body text-muted mb-3">{t("pieces.guide.choose_category_lead")}</p>
        <CategoryCards options={CATEGORY_CARDS} value={(category as CaptureCategory) ?? null} onChange={pickCategory} label={t("pieces.guide.what_will_you_add")} />
      </>)}
      {step === "accessory" && (<>
        <p className="type-body text-muted mb-3">{t("pieces.guide.choose_accessory_lead")}</p>
        <CategoryCards compact columns={3} options={ACCESSORY_TYPES.map((a) => ({ id: a.id, label: a.label, description: a.description }))}
          value={ACCESSORY_TYPES.find((a) => a.subcategory && a.subcategory === subcategory)?.id ?? null}
          onChange={(id) => { const a = ACCESSORY_TYPES.find((x) => x.id === id)!; onCategory("accessory_piece", a.subcategory || "hair_accessory"); setStep("guide"); }}
          label={t("pieces.guide.which_accessory")} />
      </>)}
      {step === "guide" && guide && (
        <div className="grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)]">
          <div className="grid content-start gap-2">
            <button type="button" className="chip self-start" onClick={() => setStep("category")} aria-label={t("pieces.guide.change_category")}>
              {t(CATEGORY_CARDS.find((c) => c.id === guide.category)!.label)}{guide.category === "accessory_piece" && <> · {t(ACCESSORY_TYPES.find((a) => a.id === guide.id)?.label ?? "pieces.guide.acc.other")}</>} · <span className="underline">{t("pieces.guide.change")}</span>
            </button>
            <div className="guide-art"><GarmentGlyph id={guide.illustration} regions={guide.highlightedRegions} size={220} title={t(guide.title)} /><span className="guide-art-note">{t("pieces.guide.illustration_note")}</span></div>
          </div>
          <div className="min-w-0">
            <h3 className="type-h2">{t(guide.title)}</h3>
            <p className="type-body mt-1">{t(guide.description)}</p>
            <p className="label mt-3">{t("pieces.guide.regions_analyzed")}</p>
            <ol className="guide-regions">{guide.highlightedRegions.map((r, i) => <li key={r}><span className="guide-step-n">{i + 1}</span>{t(`pieces.guide.region.${r}`)}</li>)}</ol>
            <p className="type-body-sm text-muted mt-2">{t(guide.regionsNote)}</p>
            {moreTips && (<>
              <p className="label mt-3">{t("pieces.guide.tips")}</p>
              <ul className="fai-list type-body-sm">{guide.tips.map((tip) => <li key={tip}>{t(tip)}</li>)}</ul>
              <p className="type-body-sm mt-2"><span className="font-medium">{t("pieces.guide.if_needed")}</span> {t(guide.secondaryCaptureSuggestion)}</p>
            </>)}
          </div>
        </div>
      )}
    </Dialog>
  );
}
