"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { Button } from "@/components/ui";
import type { LoadedAsset, SceneDocument, Vec3 } from "@/lib/atelier3d/document";
import { executeSceneCommand, storePoints } from "@/lib/atelier3d/commands";
import { meshPoints, requireStaticAsset } from "@/lib/atelier3d/command-geometry";
import { FIT_ADJUSTS, fitPoints, mirrorPoints, REGIONS, type FitKind, type Region } from "@/lib/atelier3d/garment/fit";
import { FALLOFFS, SCULPT_MODES } from "@/lib/atelier3d/garment/sculpt";
import { Choice, RangeField } from "./garment-fields";
import type { GarmentStudio } from "./use-garment-studio";
import styles from "./garment.module.css";

interface Props {
  studio: GarmentStudio;
  asset: LoadedAsset;
  doc: SceneDocument;
  editable: boolean;
}

/** Modelagem: pincel de escultura, ajustes de roupa por região e simetria; tudo vira posições de vértices. */
export function GarmentShapePanel({ studio, asset, doc, editable }: Props) {
  const { t } = useI18n();
  const [region, setRegion] = useState<Region>("all");
  const brush = studio.sculpt;
  const sculpting = studio.mode === "sculpt";
  const reshape = (change: (points: Vec3[], original: Float32Array) => Vec3[]) => {
    requireStaticAsset(asset);
    return studio.targets.reduce((next, key) => {
      const original = asset.originalPositions.get(key);
      return original ? storePoints(asset, next, key, change(meshPoints(asset, next, key), original)) : next;
    }, doc);
  };
  const run = (change: () => SceneDocument, preview = false) => {
    try {
      const next = change();
      if (preview) studio.preview(next);
      else studio.commit(next);
    } catch (e) {
      studio.fail(e instanceof Error ? e.message : "ATELIER_COMMAND_VALUE");
    }
  };
  const fit = (kind: FitKind) => ({
    onPreview: (value: number) => run(() => reshape((points, original) => fitPoints(points, original, kind, value / 100, region)), true),
    onCommit: (value: number) => run(() => reshape((points, original) => fitPoints(points, original, kind, value / 100, region))),
  });
  const percent = (value: number) => `${Math.round(value * 100)}%`;
  return (
    <div className={styles.grid}>
      <div className={styles.group}>
        <Button variant={sculpting ? "primary" : "default"} aria-pressed={sculpting} disabled={!editable}
          onClick={() => studio.setMode(sculpting ? "none" : "sculpt")}>
          {t(sculpting ? "atelier3d.garment.sculpt.stop" : "atelier3d.garment.sculpt.start")}
        </Button>
        <p className={`type-caption ${styles.hint}`}>{t("atelier3d.garment.sculpt.hint")}</p>
        <Choice legend={t("atelier3d.garment.sculpt.mode")} value={brush.mode} disabled={!editable}
          options={SCULPT_MODES.map((id) => ({ id, label: t(`atelier3d.garment.sculpt.${id}`) }))} onChange={(mode) => studio.setSculpt({ mode })} />
        <Choice legend={t("atelier3d.garment.sculpt.falloff")} value={brush.falloff} disabled={!editable}
          options={FALLOFFS.map((id) => ({ id, label: t(`atelier3d.garment.falloff.${id}`) }))} onChange={(falloff) => studio.setSculpt({ falloff })} />
      </div>
      <div className={styles.group}>
        <RangeField label={t("atelier3d.garment.sculpt.radius")} value={brush.radius} min={0.02} max={0.5} step={0.01} format={percent}
          disabled={!editable} onCommit={(radius) => studio.setSculpt({ radius })} />
        <RangeField label={t("atelier3d.garment.sculpt.strength")} value={brush.strength} min={0.05} max={1} step={0.05} format={percent}
          disabled={!editable} onCommit={(strength) => studio.setSculpt({ strength })} />
        <label className={styles.row}>
          <input type="checkbox" checked={brush.mirror} disabled={!editable} onChange={(e) => studio.setSculpt({ mirror: e.target.checked })} />
          <span className="type-caption">{t("atelier3d.garment.sculpt.mirror")}</span>
        </label>
        <div className={styles.row}>
          <Button size="sm" disabled={!editable || !studio.targets.length} onClick={() => run(() => reshape((p, o) => mirrorPoints(p, o, "left")))}>
            {t("atelier3d.garment.mirror.left")}
          </Button>
          <Button size="sm" disabled={!editable || !studio.targets.length} onClick={() => run(() => reshape((p, o) => mirrorPoints(p, o, "right")))}>
            {t("atelier3d.garment.mirror.right")}
          </Button>
        </div>
      </div>
      <div className={styles.group}>
        <Choice legend={t("atelier3d.garment.region")} value={region} disabled={!editable}
          options={REGIONS.map((id) => ({ id, label: t(`atelier3d.garment.region.${id}`) }))} onChange={setRegion} />
        {FIT_ADJUSTS.map((kind) => (
          <RangeField key={kind} label={t(`atelier3d.garment.fit.${kind}`)} value={0} min={-30} max={30} step={1} format={(v) => `${v > 0 ? "+" : ""}${v}%`} reset
            disabled={!editable || !studio.targets.length} {...fit(kind)} />
        ))}
        <div className={styles.row}>
          <Button size="sm" disabled={!editable || !studio.targets.length}
            onClick={() => run(() => studio.targets.reduce((next, primitive) => executeSceneCommand(asset, next, { type: "smooth", primitive }), doc))}>
            {t("atelier3d.garment.shape.smooth")}
          </Button>
          <Button size="sm" variant="ghost" disabled={!editable || !studio.targets.some((key) => doc.vertices[key])}
            onClick={() => run(() => studio.targets.reduce((next, primitive) => executeSceneCommand(asset, next, { type: "reset-vertices", primitive }), doc))}>
            {t("atelier3d.garment.shape.reset")}
          </Button>
        </div>
        <p className={`type-caption ${styles.hint}`}>{t("atelier3d.garment.shape.gizmo")}</p>
      </div>
    </div>
  );
}
