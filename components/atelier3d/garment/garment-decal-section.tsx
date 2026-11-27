"use client";
import { useI18n } from "@/lib/i18n/i18n";
import { Button } from "@/components/ui";
import type { SceneDocument } from "@/lib/atelier3d/document";
import { updateDecal } from "@/lib/atelier3d/garment/prints";
import { garmentOf, type Decal } from "@/lib/atelier3d/garment/state";
import { RangeField } from "./garment-fields";
import type { GarmentStudio } from "./use-garment-studio";
import styles from "./garment.module.css";

interface Props {
  studio: GarmentStudio;
  doc: SceneDocument;
  editable: boolean;
}

/** Decalques: clicar na peça aplica a imagem enviada; com um decalque escolhido, o clique o recoloca. */
export function GarmentDecalSection({ studio, doc, editable }: Props) {
  const { t } = useI18n();
  const decals = garmentOf(doc).decals;
  const chosen = decals.find((d) => d.id === studio.decal.selected);
  const placing = studio.mode === "decal";
  const change = (value: Partial<Decal> | null, preview = false) => {
    if (!chosen) return;
    try {
      const next = updateDecal(doc, chosen.id, value);
      if (preview) studio.preview(next);
      else studio.commit(next);
      if (value === null) studio.setDecal({ selected: null });
    } catch (e) {
      studio.fail(e instanceof Error ? e.message : "ATELIER_COMMAND_VALUE");
    }
  };
  const tool = (field: "size" | "rotation" | "opacity", scale = 1) => ({
    onPreview: (value: number) => {
      studio.setDecal({ [field]: value * scale });
      change({ [field]: value * scale }, true);
    },
    onCommit: (value: number) => {
      studio.setDecal({ [field]: value * scale });
      change({ [field]: value * scale });
    },
  });
  const settings = chosen ?? studio.decal;
  return (
    <div className={styles.group}>
      <Button variant={placing ? "primary" : "default"} aria-pressed={placing} disabled={!editable || (!studio.decal.image && !chosen)}
        onClick={() => studio.setMode(placing ? "none" : "decal")}>
        {t(placing ? "atelier3d.garment.decal.stop" : chosen ? "atelier3d.garment.decal.move" : "atelier3d.garment.decal.place")}
      </Button>
      <p className={`type-caption ${styles.hint}`}>{t("atelier3d.garment.decal.hint")}</p>
      <div className={styles.layers}>
        {decals.map((decal, index) => (
          <div key={decal.id} className={styles.layer} aria-current={decal.id === chosen?.id}>
            <img src={garmentOf(doc).images[decal.image]} alt="" className={styles.thumb} />
            <Button size="sm" aria-pressed={decal.id === chosen?.id}
              onClick={() => studio.setDecal({ selected: decal.id === chosen?.id ? null : decal.id })}>
              {t("atelier3d.garment.decal.item", { number: index + 1 })}
            </Button>
          </div>
        ))}
      </div>
      <RangeField label={t("atelier3d.garment.decal.size")} value={settings.size} min={0.02} max={1.2} step={0.01} disabled={!editable} {...tool("size")} />
      <RangeField label={t("atelier3d.garment.decal.rotation")} value={Math.round((settings.rotation * 180) / Math.PI)} min={-180} max={180} step={5}
        format={(v) => `${v}°`} disabled={!editable} {...tool("rotation", Math.PI / 180)} />
      <RangeField label={t("atelier3d.garment.decal.opacity")} value={settings.opacity} min={0.05} max={1} step={0.05}
        format={(v) => `${Math.round(v * 100)}%`} disabled={!editable} {...tool("opacity")} />
      {chosen && (
        <Button size="sm" variant="ghost" disabled={!editable} onClick={() => change(null)}>
          {t("atelier3d.garment.decal.remove")}
        </Button>
      )}
    </div>
  );
}
