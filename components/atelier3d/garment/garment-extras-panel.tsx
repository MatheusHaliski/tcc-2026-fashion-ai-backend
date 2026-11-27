"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { Button } from "@/components/ui";
import { downloadBlob, type LoadedAsset, type SceneDocument } from "@/lib/atelier3d/document";
import { loopsOf } from "@/lib/atelier3d/garment/extras";
import { addStitch, removeAccessory, removeStitch } from "@/lib/atelier3d/garment/finishing";
import { garmentOf } from "@/lib/atelier3d/garment/state";
import { Choice, ColorField, RangeField } from "./garment-fields";
import type { GarmentStudio, LightPreset } from "./use-garment-studio";
import styles from "./garment.module.css";

interface Props {
  studio: GarmentStudio;
  asset: LoadedAsset;
  doc: SceneDocument;
  editable: boolean;
}

/** Pespontos nas bordas, botões e rebites, luz de prévia do tecido, manequim e miniatura. */
export function GarmentExtrasPanel({ studio, asset, doc, editable }: Props) {
  const { t } = useI18n();
  const [loop, setLoop] = useState(0);
  const [stitch, setStitch] = useState({ color: "#f4f1ea", offset: 0.03, dash: 0.02, width: 0.004 });
  const [thumb, setThumb] = useState<string | null>(null);
  const part = studio.part;
  const loops = part ? loopsOf(asset, part) : [];
  const garment = garmentOf(doc);
  const placing = studio.mode === "accessory";
  const run = (change: () => SceneDocument) => {
    try {
      studio.commit(change());
    } catch (e) {
      studio.fail(e instanceof Error ? e.message : "ATELIER_COMMAND_VALUE");
    }
  };
  const percent = (v: number) => `${(v * 100).toFixed(1)}%`;
  async function capture() {
    const url = studio.captureRef.current?.();
    if (!url) return studio.fail("ATELIER_CAPTURE");
    setThumb(url);
    downloadBlob(await (await fetch(url)).blob(), "fashionai-miniatura.png");
  }
  return (
    <div className={styles.grid}>
      <div className={styles.group}>
        <Choice legend={t("atelier3d.garment.stitch.edge")} value={loops.length ? String(Math.min(loop, loops.length - 1)) : null} disabled={!editable}
          options={loops.map((l, i) => ({ id: String(i), label: t("atelier3d.garment.stitch.edgeItem", { number: i + 1, height: Math.round(l.height * 100) }) }))}
          onChange={(id) => setLoop(Number(id))} />
        {!loops.length && <p className={`type-caption ${styles.hint}`}>{t("atelier3d.garment.stitch.none")}</p>}
        <ColorField label={t("atelier3d.garment.stitch.color")} value={stitch.color} disabled={!editable} onCommit={(color) => setStitch((s) => ({ ...s, color }))} />
        <RangeField label={t("atelier3d.garment.stitch.offset")} value={stitch.offset} min={0} max={0.12} step={0.005} format={percent} disabled={!editable}
          onCommit={(offset) => setStitch((s) => ({ ...s, offset }))} />
        <RangeField label={t("atelier3d.garment.stitch.dash")} value={stitch.dash} min={0.005} max={0.08} step={0.005} format={percent} disabled={!editable}
          onCommit={(dash) => setStitch((s) => ({ ...s, dash }))} />
        <Button size="sm" disabled={!editable || !part || !loops.length}
          onClick={() => part && run(() => addStitch(doc, { primitive: part, loop: Math.min(loop, loops.length - 1), ...stitch }))}>
          {t("atelier3d.garment.stitch.add")}
        </Button>
        {garment.stitches.map((s, i) => (
          <div key={s.id} className={styles.layer}>
            <span className="type-caption">{t("atelier3d.garment.stitch.item", { number: i + 1 })}</span>
            <Button size="sm" variant="ghost" disabled={!editable} onClick={() => run(() => removeStitch(doc, s.id))}>{t("atelier3d.garment.stitch.remove")}</Button>
          </div>
        ))}
      </div>
      <div className={styles.group}>
        <Choice legend={t("atelier3d.garment.accessory.kind")} value={studio.accessory.kind} disabled={!editable}
          options={[{ id: "button", label: t("atelier3d.garment.accessory.button") }, { id: "rivet", label: t("atelier3d.garment.accessory.rivet") }]}
          onChange={(kind) => studio.setAccessory({ kind, color: kind === "rivet" ? "#b8b2a6" : studio.accessory.color })} />
        <RangeField label={t("atelier3d.garment.accessory.size")} value={studio.accessory.size} min={0.005} max={0.08} step={0.005} disabled={!editable}
          onCommit={(size) => studio.setAccessory({ size })} />
        <ColorField label={t("atelier3d.garment.accessory.color")} value={studio.accessory.color} disabled={!editable} onCommit={(color) => studio.setAccessory({ color })} />
        <Button variant={placing ? "primary" : "default"} aria-pressed={placing} disabled={!editable} onClick={() => studio.setMode(placing ? "none" : "accessory")}>
          {t(placing ? "atelier3d.garment.accessory.stop" : "atelier3d.garment.accessory.place")}
        </Button>
        <p className={`type-caption ${styles.hint}`}>{t("atelier3d.garment.accessory.count", { count: garment.accessories.length })}</p>
        <Button size="sm" variant="ghost" disabled={!editable || !garment.accessories.length} onClick={() => run(() => removeAccessory(doc, null))}>
          {t("atelier3d.garment.accessory.clear")}
        </Button>
      </div>
      <div className={styles.group}>
        <Choice<LightPreset> legend={t("atelier3d.garment.light")} value={studio.light}
          options={(["neutral", "studio", "warm"] as const).map((id) => ({ id, label: t(`atelier3d.garment.light.${id}`) }))} onChange={studio.setLight} />
        <label className={styles.row}>
          <input type="checkbox" checked={studio.mannequin} onChange={(e) => studio.setMannequin(e.target.checked)} />
          <span className="type-caption">{t("atelier3d.garment.mannequin")}</span>
        </label>
        <Button size="sm" onClick={() => void capture()}>{t("atelier3d.garment.capture")}</Button>
        {thumb && <img src={thumb} alt={t("atelier3d.garment.captured")} className={styles.preview} />}
      </div>
    </div>
  );
}
