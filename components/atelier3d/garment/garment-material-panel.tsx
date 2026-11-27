"use client";
import { useI18n } from "@/lib/i18n/i18n";
import { Button } from "@/components/ui";
import type { LoadedAsset, SceneDocument } from "@/lib/atelier3d/document";
import { applyFabricPreset, FABRIC_LOOKS, removeFabric, updateFabric } from "@/lib/atelier3d/garment/fabrics";
import { FABRIC_PRESETS, garmentOf, WEAVES, type FabricEdit } from "@/lib/atelier3d/garment/state";
import { Choice, ColorField, RangeField } from "./garment-fields";
import type { GarmentStudio } from "./use-garment-studio";
import styles from "./garment.module.css";

interface Props {
  studio: GarmentStudio;
  asset: LoadedAsset;
  doc: SceneDocument;
  editable: boolean;
}

/** Presets de tecido PBR por parte ou peça inteira, com ajuste fino do brilho, verniz e trama. */
export function GarmentMaterialPanel({ studio, asset, doc, editable }: Props) {
  const { t } = useI18n();
  const targets = studio.targets;
  const fabric = targets.map((key) => garmentOf(doc).fabrics[key]).find(Boolean);
  const run = (change: () => SceneDocument, preview = false) => {
    try {
      const next = change();
      if (preview) studio.preview(next);
      else studio.commit(next);
    } catch (e) {
      studio.fail(e instanceof Error ? e.message : "ATELIER_COMMAND_VALUE");
    }
  };
  const tune = (field: keyof FabricEdit) => ({
    onPreview: (value: number | string) => run(() => updateFabric(doc, targets, { [field]: value }), true),
    onCommit: (value: number | string) => run(() => updateFabric(doc, targets, { [field]: value })),
  });
  const percent = (value: number) => `${Math.round(value * 100)}%`;
  return (
    <div className={styles.grid}>
      <div className={styles.group}>
        <Choice legend={t("atelier3d.garment.fabric.title")} value={fabric?.preset ?? null} disabled={!editable || !targets.length}
          options={FABRIC_PRESETS.map((id) => ({ id, label: t(`atelier3d.garment.fabric.${id}`), swatch: FABRIC_LOOKS[id].color }))}
          onChange={(preset) => run(() => applyFabricPreset(doc, targets, preset, asset.baseline, studio.keepColor))} />
        <label className={styles.row}>
          <input type="checkbox" checked={studio.keepColor} onChange={(e) => studio.setKeepColor(e.target.checked)} />
          <span className="type-caption">{t("atelier3d.garment.fabric.keepColor")}</span>
        </label>
        {!fabric && <p className={`type-caption ${styles.hint}`}>{t("atelier3d.garment.fabric.none")}</p>}
      </div>
      {fabric && (
        <>
          <div className={styles.group}>
            <RangeField label={t("atelier3d.garment.fabric.sheen")} value={fabric.sheen} min={0} max={1} step={0.05} format={percent} disabled={!editable} {...tune("sheen")} />
            <ColorField label={t("atelier3d.garment.fabric.sheenColor")} value={fabric.sheenColor} disabled={!editable} {...tune("sheenColor")} />
            <RangeField label={t("atelier3d.garment.fabric.sheenRoughness")} value={fabric.sheenRoughness} min={0} max={1} step={0.05} format={percent} disabled={!editable} {...tune("sheenRoughness")} />
          </div>
          <div className={styles.group}>
            <RangeField label={t("atelier3d.garment.fabric.clearcoat")} value={fabric.clearcoat} min={0} max={1} step={0.05} format={percent} disabled={!editable} {...tune("clearcoat")} />
            <RangeField label={t("atelier3d.garment.fabric.transmission")} value={fabric.transmission} min={0} max={1} step={0.05} format={percent} disabled={!editable} {...tune("transmission")} />
            <Button size="sm" disabled={!editable} onClick={() => run(() => removeFabric(doc, targets))}>{t("atelier3d.garment.fabric.remove")}</Button>
          </div>
          <div className={styles.group}>
            <Choice legend={t("atelier3d.garment.fabric.weave")} value={fabric.weave} disabled={!editable}
              options={WEAVES.map((id) => ({ id, label: t(`atelier3d.garment.weave.${id}`) }))}
              onChange={(weave) => run(() => updateFabric(doc, targets, { weave }))} />
            <RangeField label={t("atelier3d.garment.fabric.weaveScale")} value={fabric.weaveScale} min={1} max={120} step={1} disabled={!editable} {...tune("weaveScale")} />
            <RangeField label={t("atelier3d.garment.fabric.normalStrength")} value={fabric.normalStrength} min={0} max={2} step={0.05} disabled={!editable} {...tune("normalStrength")} />
          </div>
        </>
      )}
    </div>
  );
}
