"use client";
import { useState } from "react";
import { Field, Input } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import type { LoadedAsset, SceneDocument, Vec3 } from "@/lib/atelier3d/document";
import { listParts, type GarmentPart } from "@/lib/atelier3d/garment-parts";
import { apparentColor } from "@/lib/atelier3d/garment-materials";
import { changeHemLength, garmentSize, setGarmentSize, setPartColor, setPartHidden, SIZE_RANGE } from "@/lib/atelier3d/garment-commands";
import { DecalPanel } from "./decal-panel";
import { partLabel } from "./node-label";
import styles from "./editor.module.css";

interface Props {
  asset: LoadedAsset;
  document: SceneDocument;
  editable: boolean;
  onChange: (document: SceneDocument) => void;
}

/** Um passo da barra: 2 cm (o GLB do motor está em metros). */
const HEM_STEP = 0.02;
const AXES = ["width", "length", "depth"] as const;

/**
 * Edição da peça com GLB próprio (motor de peças): cor de cada parte (tecido, costura, zíper, botões, faixas), partes
 * ocultas, tamanho, barra e desenhos/logos. Cada controle gera uma edição comum do documento: desfazer/refazer,
 * salvar e exportar seguem o caminho do editor.
 */
export function GarmentPanel({ asset, document: doc, editable, onChange }: Props) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  const parts = listParts(asset).filter((part) => part.role && part.role !== "estampa");
  const node = listParts(asset).find((part) => part.role === "corpo")?.node ?? parts[0]?.node;
  if (!node) return null;
  const size = garmentSize(asset, doc, node);
  function run(edit: () => SceneDocument) {
    if (!editable) return;
    try {
      onChange(edit());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }
  function resize(axis: number | "all", percent: number) {
    const factor = percent / 100;
    if (!Number.isFinite(factor) || factor < SIZE_RANGE.min || factor > SIZE_RANGE.max) return;
    const next = (axis === "all" ? [factor, factor, factor] : size.map((value, i) => (i === axis ? factor : value))) as Vec3;
    run(() => setGarmentSize(asset, doc, node!, next));
  }
  const hemKeys = Object.keys(doc.vertices).filter((key) => key.startsWith(`${node}.`));
  return (
    <section className={styles.stack} aria-labelledby="garment-panel-title" data-testid="garment-panel">
      <h3 id="garment-panel-title" className="type-h3">{t("atelier3d.garment.title")}</h3>
      <fieldset className={styles.stack} data-testid="garment-colors">
        <legend className="label">{t("atelier3d.garment.colors")}</legend>
        {parts.map((part) => <PartRow key={part.key} part={part} asset={asset} doc={doc} onColor={(color) => run(() => setPartColor(asset, doc, part.key, color))}
          onHidden={(hidden) => run(() => setPartHidden(asset, doc, part.key, hidden))} />)}
      </fieldset>
      <fieldset className={styles.stack} data-testid="garment-size">
        <legend className="label">{t("atelier3d.garment.size")}</legend>
        <p className="type-caption">{t("atelier3d.garment.sizeHelp")}</p>
        <SizeField id="garment-size-all" label={t("atelier3d.garment.uniform")} value={(size[0] + size[1] + size[2]) / 3} onChange={(v) => resize("all", v)} />
        {AXES.map((axis, i) => <SizeField key={axis} id={`garment-size-${axis}`} label={t(`atelier3d.garment.${axis}`)} value={size[i]} onChange={(v) => resize(i, v)} />)}
      </fieldset>
      <fieldset className={styles.stack} data-testid="garment-hem">
        <legend className="label">{t("atelier3d.garment.hem")}</legend>
        <p className="type-caption">{t("atelier3d.garment.hemHelp")}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-sm" onClick={() => run(() => changeHemLength(asset, doc, node!, HEM_STEP))}>{t("atelier3d.garment.hemLonger")}</button>
          <button type="button" className="btn btn-sm" onClick={() => run(() => changeHemLength(asset, doc, node!, -HEM_STEP))}>{t("atelier3d.garment.hemShorter")}</button>
          <button type="button" className="btn btn-sm" disabled={!hemKeys.length}
            onClick={() => run(() => ({ ...doc, vertices: Object.fromEntries(Object.entries(doc.vertices).filter(([key]) => !hemKeys.includes(key))) }))}>
            {t("atelier3d.garment.hemReset")}
          </button>
        </div>
      </fieldset>
      {failed && <p role="alert" className="type-body-sm text-critical">{t("atelier3d.garment.error")}</p>}
      <DecalPanel asset={asset} document={doc} node={node} editable={editable} onChange={onChange} />
    </section>
  );
}

function PartRow({ part, asset, doc, onColor, onHidden }: {
  part: GarmentPart; asset: LoadedAsset; doc: SceneDocument; onColor: (color: string) => void; onHidden: (hidden: boolean) => void;
}) {
  const { t } = useI18n();
  const label = partLabel(part, t);
  const hidden = !!doc.materials[part.key]?.hidden;
  return (
    <div className="flex flex-wrap items-center gap-2" data-part={part.materialName}>
      <label className="flex items-center gap-2">
        <input type="color" aria-label={t("atelier3d.garment.colorOf", { part: label })} value={apparentColor(asset, doc, part.key)}
          onChange={(e) => onColor(e.target.value)} />
        <span>{label}</span>
      </label>
      {part.role !== "corpo" && (
        <label className={styles.check}>
          <input type="checkbox" checked={hidden} aria-label={t("atelier3d.garment.hideOf", { part: label })} onChange={(e) => onHidden(e.target.checked)} />
          {t("atelier3d.garment.hide")}
        </label>
      )}
    </div>
  );
}

function SizeField({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (percent: number) => void }) {
  return (
    <Field id={id} label={label}>
      <Input id={id} type="number" min={SIZE_RANGE.min * 100} max={SIZE_RANGE.max * 100} step={1} value={Math.round(value * 100)}
        onChange={(e) => onChange(e.target.valueAsNumber)} />
    </Field>
  );
}
