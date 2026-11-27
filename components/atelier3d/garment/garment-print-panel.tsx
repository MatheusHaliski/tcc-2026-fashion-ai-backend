"use client";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { Button, FileButton } from "@/components/ui";
import type { SceneDocument } from "@/lib/atelier3d/document";
import { addImage, setPattern } from "@/lib/atelier3d/garment/prints";
import { PATTERN_COLORS, patternPixels } from "@/lib/atelier3d/garment/patterns";
import { importGarmentImage, IMAGE_TYPES } from "@/lib/atelier3d/garment/images";
import { createCanvas, putPixels } from "@/lib/atelier3d/garment/textures";
import { garmentOf, PATTERNS, type PatternFill, type PatternKind } from "@/lib/atelier3d/garment/state";
import { Choice, ColorField, RangeField } from "./garment-fields";
import { GarmentDecalSection } from "./garment-decal-section";
import type { GarmentStudio } from "./use-garment-studio";
import styles from "./garment.module.css";

interface Props {
  studio: GarmentStudio;
  doc: SceneDocument;
  editable: boolean;
}

function swatch(kind: PatternKind, colors: [string, string, string]): string | undefined {
  const canvas = createCanvas(48, 48);
  if (!canvas) return undefined;
  putPixels(canvas, patternPixels(kind, colors, 48));
  return canvas.toDataURL("image/png");
}

/** Estampas: padrão repetido por parte (biblioteca procedural ou imagem enviada) e decalques projetados. */
export function GarmentPrintPanel({ studio, doc, editable }: Props) {
  const { t } = useI18n();
  const [kind, setKind] = useState<PatternKind>("stripes");
  const [colors, setColors] = useState<[string, string, string]>(PATTERN_COLORS.stripes);
  const [busy, setBusy] = useState(false);
  const current = studio.targets.map((key) => garmentOf(doc).patterns[key]).find(Boolean);
  const fill: PatternFill = current ?? { source: { kind: "procedural", pattern: kind, colors }, scale: 6, rotation: 0, opacity: 1 };
  const thumbs = useMemo(() => Object.fromEntries(PATTERNS.map((p) => [p, swatch(p, PATTERN_COLORS[p])])), []);
  const run = (change: () => SceneDocument, preview = false) => {
    try {
      const next = change();
      if (preview) studio.preview(next);
      else studio.commit(next);
    } catch (e) {
      studio.fail(e instanceof Error ? e.message : "ATELIER_COMMAND_VALUE");
    }
  };
  const apply = (change: Partial<PatternFill>, preview = false) => run(() => setPattern(doc, studio.targets, { ...fill, ...change }), preview);
  const procedural = (pattern: PatternKind, palette: [string, string, string]) => apply({ source: { kind: "procedural", pattern, colors: palette } });
  async function upload(file: File) {
    setBusy(true);
    try {
      studio.setDecal({ image: await importGarmentImage(file), selected: null });
      studio.fail(null);
    } catch (e) {
      studio.fail(e instanceof Error ? e.message : "ATELIER_IMAGE_TYPE");
    } finally {
      setBusy(false);
    }
  }
  const tune = (field: "scale" | "rotation" | "opacity") => ({
    onPreview: (value: number) => apply({ [field]: field === "rotation" ? (value * Math.PI) / 180 : value }, true),
    onCommit: (value: number) => apply({ [field]: field === "rotation" ? (value * Math.PI) / 180 : value }),
  });
  return (
    <div className={styles.grid}>
      <div className={styles.group}>
        <Choice legend={t("atelier3d.garment.print.library")} disabled={!editable || !studio.targets.length}
          value={fill.source.kind === "procedural" && current ? fill.source.pattern : null}
          options={PATTERNS.map((id) => ({ id, label: t(`atelier3d.garment.pattern.${id}`) }))}
          onChange={(pattern) => {
            setKind(pattern);
            setColors(PATTERN_COLORS[pattern]);
            procedural(pattern, PATTERN_COLORS[pattern]);
          }} />
        <div className={styles.row} aria-hidden>
          {PATTERNS.map((p) => thumbs[p] && <img key={p} src={thumbs[p]} alt="" className={styles.thumb} />)}
        </div>
        {fill.source.kind === "procedural" && current && (
          <div className={styles.row}>
            {[0, 1, 2].map((i) => (
              <ColorField key={i} label={t("atelier3d.garment.print.color", { number: i + 1 })} value={colors[i]} disabled={!editable}
                onCommit={(color) => {
                  const palette = colors.map((c, j) => (j === i ? color : c)) as [string, string, string];
                  setColors(palette);
                  procedural(fill.source.kind === "procedural" ? fill.source.pattern : kind, palette);
                }} />
            ))}
          </div>
        )}
      </div>
      <div className={styles.group}>
        <RangeField label={t("atelier3d.garment.print.scale")} value={fill.scale} min={1} max={32} step={0.5} disabled={!editable || !current} {...tune("scale")} />
        <RangeField label={t("atelier3d.garment.print.rotation")} value={Math.round((fill.rotation * 180) / Math.PI)} min={-180} max={180} step={5}
          format={(v) => `${v}°`} disabled={!editable || !current} {...tune("rotation")} />
        <RangeField label={t("atelier3d.garment.print.opacity")} value={fill.opacity} min={0} max={1} step={0.05}
          format={(v) => `${Math.round(v * 100)}%`} disabled={!editable || !current} {...tune("opacity")} />
        <Button size="sm" variant="ghost" disabled={!editable || !current} onClick={() => run(() => setPattern(doc, studio.targets, null))}>
          {t("atelier3d.garment.print.removePattern")}
        </Button>
      </div>
      <div className={styles.group}>
        <span className="type-caption">{t("atelier3d.garment.print.upload")}</span>
        <FileButton accept={IMAGE_TYPES.join(",")} disabled={!editable} loading={busy} onFiles={(files) => files[0] && void upload(files[0])}>
          {t("atelier3d.garment.print.choose")}
        </FileButton>
        {studio.decal.image && <img src={studio.decal.image} alt={t("atelier3d.garment.print.uploaded")} className={styles.preview} />}
        <Button size="sm" disabled={!editable || !studio.decal.image || !studio.targets.length}
          onClick={() => run(() => {
            const stored = addImage(doc, studio.decal.image!);
            return setPattern(stored.doc, studio.targets, { source: { kind: "image", image: stored.id }, scale: 4, rotation: 0, opacity: 1 });
          })}>
          {t("atelier3d.garment.print.tile")}
        </Button>
      </div>
      <GarmentDecalSection studio={studio} doc={doc} editable={editable} />
    </div>
  );
}
