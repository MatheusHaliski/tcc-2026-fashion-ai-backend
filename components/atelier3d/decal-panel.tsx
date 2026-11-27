"use client";
import { useRef, useState } from "react";
import { Field, Input, Select } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import type { LoadedAsset, SceneDocument } from "@/lib/atelier3d/document";
import { DECAL_SIZE, defaultPlacement, listDecals, moveDecal, nextDecalKey, printDecal, removeDecal, upsertDecal, type DecalEdit, type DecalEntry } from "@/lib/atelier3d/decals";
import { readDecalImage } from "@/lib/atelier3d/decal-image";
import { listParts } from "@/lib/atelier3d/garment-parts";
import { partLabel } from "./node-label";
import styles from "./editor.module.css";

interface Props {
  asset: LoadedAsset;
  document: SceneDocument;
  node: string;
  editable: boolean;
  onChange: (document: SceneDocument) => void;
}

/** Um passo de deslocamento: 1 cm sobre o tecido. */
const STEP = 0.01;
const MOVES = [["up", 0, STEP], ["down", 0, -STEP], ["left", -STEP, 0], ["right", STEP, 0]] as const;
const KNOWN = ["ATELIER_DECAL_PLACEMENT", "ATELIER_DECAL_IMAGE", "ATELIER_DECAL_LIMIT", "ATELIER_DECAL_VALUE"];

/** Desenhos (estampas do arquivo) e logos enviados: mover, escalar, girar, recolorir, trocar imagem, adicionar e remover. */
export function DecalPanel({ asset, document: doc, node, editable, onChange }: Props) {
  const { t } = useI18n();
  const [chosen, setChosen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const entries = listDecals(asset, doc);
  const current = entries.find((entry) => entry.key === chosen) ?? entries[0];
  const label = (entry: DecalEntry) => {
    const part = entry.kind === "print" ? listParts(asset).find((p) => p.key === entry.key) : undefined;
    return part ? partLabel(part, t) : t("atelier3d.decal.logo", { n: entry.key.replace(/\D/g, "") });
  };
  // cliques seguidos (mover 1 cm três vezes) chegam antes de o editor redesenhar: cada edição parte da anterior
  const latest = useRef(doc);
  latest.current = doc;
  const editOf = (base: SceneDocument, key: string) => base.decals?.[key] ?? printDecal(asset, key);
  function attempt(work: (base: () => SceneDocument) => SceneDocument | Promise<SceneDocument>, select?: string) {
    if (!editable) return;
    // a edição seguinte já parte desta, mesmo antes de o editor redesenhar
    const commit = (next: SceneDocument) => (latest.current = next);
    Promise.resolve()
      .then(() => {
        const result = work(() => latest.current);
        return result instanceof Promise ? result.then(commit) : commit(result);
      })
      .then((next) => {
        onChange(next);
        if (select) setChosen(select);
        setError(null);
      })
      .catch((failure: unknown) => {
        const code = failure instanceof Error ? failure.message : "";
        setError(KNOWN.includes(code) ? code : "ATELIER_DECAL_VALUE");
      });
  }
  /** Altera campos do desenho em edição a partir do valor mais recente (não do que estava na tela no clique). */
  function edit(change: Partial<DecalEdit>) {
    const key = current!.key;
    attempt((base) => {
      const value = editOf(base(), key);
      if (!value) throw Error("ATELIER_DECAL_VALUE");
      return upsertDecal(base(), key, { ...value, ...change });
    });
  }
  function move(dx: number, dy: number) {
    const key = current!.key;
    attempt((base) => {
      const value = editOf(base(), key);
      const moved = value && moveDecal(asset, value, dx, dy);
      if (!moved) throw Error("ATELIER_DECAL_PLACEMENT");
      return upsertDecal(base(), key, moved);
    });
  }
  function addLogo(file: File) {
    attempt(async (base) => {
      const image = await readDecalImage(file);
      const placed = defaultPlacement(asset, node, image.aspect);
      if (!placed) throw Error("ATELIER_DECAL_PLACEMENT");
      const key = nextDecalKey(base());
      setChosen(key);
      return upsertDecal(base(), key, { ...placed, image: image.dataUrl });
    });
  }
  function replaceImage(file: File) {
    const key = current!.key;
    attempt(async (base) => {
      const image = await readDecalImage(file);
      const value = editOf(base(), key);
      if (!value) throw Error("ATELIER_DECAL_VALUE");
      return upsertDecal(base(), key, { ...value, image: image.dataUrl, aspect: image.aspect });
    });
  }
  return (
    <section className={styles.stack} aria-labelledby="decal-panel-title" data-testid="decal-panel">
      <h3 id="decal-panel-title" className="type-h3">{t("atelier3d.decal.title")}</h3>
      {!current && <p className="type-caption">{t("atelier3d.decal.empty")}</p>}
      {current && (
        <>
          <Field id="decal-pick" label={t("atelier3d.decal.pick")}>
            <Select id="decal-pick" value={current.key} onChange={(e) => setChosen(e.target.value)}>
              {entries.map((entry) => <option key={entry.key} value={entry.key}>{label(entry)}</option>)}
            </Select>
          </Field>
          <fieldset className="flex flex-wrap gap-2" data-testid="decal-move">
            <legend className="label">{t("atelier3d.decal.move")}</legend>
            {MOVES.map(([name, dx, dy]) => <button key={name} type="button" className="btn btn-sm" onClick={() => move(dx, dy)}>{t(`atelier3d.decal.${name}`)}</button>)}
          </fieldset>
          <Field id="decal-size" label={t("atelier3d.decal.size")}>
            <Input id="decal-size" type="number" min={DECAL_SIZE.min * 100} max={DECAL_SIZE.max * 100} step={0.5} value={+(current.edit.size * 100).toFixed(1)}
              onChange={(e) => {
                const size = e.target.valueAsNumber / 100;
                if (size >= DECAL_SIZE.min && size <= DECAL_SIZE.max) edit({ size });
              }} />
          </Field>
          <Field id="decal-rotation" label={t("atelier3d.decal.rotation")}>
            <Input id="decal-rotation" type="number" min={-180} max={180} step={5} value={Math.round((current.edit.rotation * 180) / Math.PI)}
              onChange={(e) => Number.isFinite(e.target.valueAsNumber) && edit({ rotation: (e.target.valueAsNumber * Math.PI) / 180 })} />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2">
              <input type="color" aria-label={t("atelier3d.decal.color")} value={current.edit.color ?? "#ffffff"} onChange={(e) => edit({ color: e.target.value })} />
              {t("atelier3d.decal.color")}
            </label>
            <button type="button" className="btn btn-sm" disabled={!current.edit.color} onClick={() => edit({ color: null })}>{t("atelier3d.decal.originalColors")}</button>
          </div>
          <label className={styles.check}>
            <input type="checkbox" checked={!current.edit.visible} onChange={(e) => edit({ visible: !e.target.checked })} />
            {t("atelier3d.decal.hidden")}
          </label>
          <ImageButton id="decal-replace" label={t("atelier3d.decal.replace")} onFile={replaceImage} />
          {current.edited && (
            <button type="button" className="btn btn-sm" onClick={() => attempt((base) => removeDecal(base(), current.key))}>
              {t(current.kind === "logo" ? "atelier3d.decal.remove" : "atelier3d.decal.restore")}
            </button>
          )}
        </>
      )}
      <ImageButton id="decal-add" label={t("atelier3d.decal.add")} onFile={addLogo} />
      {error && <p role="alert" className="type-body-sm text-critical">{t(`atelier3d.decal.${error}`)}</p>}
    </section>
  );
}

function ImageButton({ id, label, onFile }: { id: string; label: string; onFile: (file: File) => void }) {
  return (
    <label className="btn btn-sm" htmlFor={id}>
      {label}
      <input id={id} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) onFile(file);
      }} />
    </label>
  );
}
