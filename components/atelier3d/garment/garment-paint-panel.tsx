"use client";
import { useI18n } from "@/lib/i18n/i18n";
import { Button } from "@/components/ui";
import type { SceneDocument } from "@/lib/atelier3d/document";
import { addLayer, addPaintOp, updateLayer } from "@/lib/atelier3d/garment/paint";
import { garmentOf, setRecord, withGarment } from "@/lib/atelier3d/garment/state";
import { Choice, ColorField, RangeField } from "./garment-fields";
import type { GarmentStudio } from "./use-garment-studio";
import styles from "./garment.module.css";

interface Props {
  studio: GarmentStudio;
  doc: SceneDocument;
  editable: boolean;
}

/** Pintura direta na textura: pincel/borracha em UV, preenchimento da parte e camadas simples. */
export function GarmentPaintPanel({ studio, doc, editable }: Props) {
  const { t } = useI18n();
  const brush = studio.paint;
  const part = studio.part;
  const layers = part ? garmentOf(doc).layers[part] ?? [] : [];
  const run = (change: () => SceneDocument) => {
    try {
      studio.commit(change());
    } catch (e) {
      studio.fail(e instanceof Error ? e.message : "ATELIER_COMMAND_VALUE");
    }
  };
  const painting = studio.mode === "paint";
  const percent = (value: number) => `${Math.round(value * 100)}%`;
  return (
    <div className={styles.grid}>
      <div className={styles.group}>
        <Button variant={painting ? "primary" : "default"} aria-pressed={painting} disabled={!editable}
          onClick={() => studio.setMode(painting ? "none" : "paint")}>
          {t(painting ? "atelier3d.garment.paint.stop" : "atelier3d.garment.paint.start")}
        </Button>
        <p className={`type-caption ${styles.hint}`}>{t("atelier3d.garment.paint.hint")}</p>
        <Choice legend={t("atelier3d.garment.paint.tool")} value={brush.erase ? "erase" : "brush"} disabled={!editable}
          options={[{ id: "brush", label: t("atelier3d.garment.paint.brush") }, { id: "erase", label: t("atelier3d.garment.paint.eraser") }]}
          onChange={(tool) => studio.setPaint({ erase: tool === "erase" })} />
        <ColorField label={t("atelier3d.garment.paint.color")} value={brush.color} disabled={!editable}
          onPreview={(color) => studio.setPaint({ color })} onCommit={(color) => studio.setPaint({ color })} />
      </div>
      <div className={styles.group}>
        <RangeField label={t("atelier3d.garment.paint.size")} value={brush.size} min={2} max={200} step={1} disabled={!editable}
          format={(v) => `${v} px`} onCommit={(size) => studio.setPaint({ size })} />
        <RangeField label={t("atelier3d.garment.paint.opacity")} value={brush.opacity} min={0.05} max={1} step={0.05} disabled={!editable}
          format={percent} onCommit={(opacity) => studio.setPaint({ opacity })} />
        <RangeField label={t("atelier3d.garment.paint.hardness")} value={brush.hardness} min={0} max={1} step={0.05} disabled={!editable}
          format={percent} onCommit={(hardness) => studio.setPaint({ hardness })} />
        <Button size="sm" disabled={!editable || !studio.targets.length}
          onClick={() => run(() => studio.targets.reduce((next, key) => addPaintOp(next, key, brush.layer, { kind: "fill", color: brush.color, opacity: brush.opacity }), doc))}>
          {t("atelier3d.garment.paint.fill")}
        </Button>
      </div>
      <div className={styles.group}>
        <span className="type-caption">{t("atelier3d.garment.paint.layers")}</span>
        {!part && <p className={`type-caption ${styles.hint}`}>{t("atelier3d.garment.noTarget")}</p>}
        <div className={styles.layers}>
          {layers.map((layer, index) => (
            <div key={layer.id} className={styles.layer} aria-current={brush.layer === layer.id}>
              <Button size="sm" aria-pressed={brush.layer === layer.id} onClick={() => studio.setPaint({ layer: layer.id })}>
                {t("atelier3d.garment.paint.layer", { number: index + 1 })}
              </Button>
              <label className={styles.row}>
                <input type="checkbox" checked={layer.visible} disabled={!editable}
                  onChange={(e) => part && run(() => updateLayer(doc, part, layer.id, { visible: e.target.checked }))} />
                <span className="type-caption">{t("atelier3d.garment.paint.visible")}</span>
              </label>
              <RangeField label={t("atelier3d.garment.paint.layerOpacity")} value={layer.opacity} min={0} max={1} step={0.05} disabled={!editable}
                format={percent} onPreview={(opacity) => part && studio.preview(updateLayer(doc, part, layer.id, { opacity }))}
                onCommit={(opacity) => part && run(() => updateLayer(doc, part, layer.id, { opacity }))} />
              <Button size="sm" variant="ghost" disabled={!editable} onClick={() => part && run(() => updateLayer(doc, part, layer.id, null))}>
                {t("atelier3d.garment.paint.removeLayer")}
              </Button>
            </div>
          ))}
        </div>
        <div className={styles.row}>
          <Button size="sm" disabled={!editable || !part} onClick={() => part && run(() => {
            const next = addLayer(doc, part);
            studio.setPaint({ layer: garmentOf(next).layers[part]?.at(-1)?.id ?? null });
            return next;
          })}>
            {t("atelier3d.garment.paint.addLayer")}
          </Button>
          <Button size="sm" variant="ghost" disabled={!editable || !studio.targets.some((key) => garmentOf(doc).layers[key])}
            onClick={() => run(() => withGarment(doc, (g) => ({ layers: studio.targets.reduce((all, key) => setRecord(all, key, undefined), g.layers) })))}>
            {t("atelier3d.garment.paint.clear")}
          </Button>
        </div>
      </div>
    </div>
  );
}
