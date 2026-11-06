"use client";
import { useId, useState } from "react";
import { Field, Input } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import type { LoadedAsset, SceneDocument } from "@/lib/atelier3d/document";
import { executeSceneCommand, type SceneCommand } from "@/lib/atelier3d/commands";
import styles from "./editor.module.css";

interface Props {
  asset: LoadedAsset;
  document: SceneDocument;
  selected: string;
  primitive?: string;
  editable: boolean;
  deformationBlocked: boolean;
  onChange: (document: SceneDocument) => void;
}

/** Commands produce ordinary document edits, so existing history, save and export remain authoritative. */
export function SceneCommandPanel({ asset, document, selected, primitive, editable, deformationBlocked, onChange }: Props) {
  const { t } = useI18n();
  const id = useId();
  const [axis, setAxis] = useState<"x" | "y" | "z">("y");
  const [factor, setFactor] = useState("0.8");
  const [message, setMessage] = useState<{ error: boolean; key: string } | null>(null);
  const validFactor = factor.trim() !== "" && Number.isFinite(Number(factor)) && Number(factor) >= 0.25 && Number(factor) <= 2;
  const deformable = editable && !!primitive && !deformationBlocked;
  function run(command: SceneCommand) {
    if (!editable) return;
    try {
      onChange(executeSceneCommand(asset, document, command));
      setMessage({ error: false, key: "atelier3d.commands.applied" });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      const known = ["ATELIER_COMMAND_TARGET", "ATELIER_COMMAND_STATIC", "ATELIER_COMMAND_LIMIT", "ATELIER_COMMAND_VALUE"];
      setMessage({ error: true, key: known.includes(code) ? `atelier3d.commands.${code}` : "atelier3d.commands.failed" });
    }
  }
  return <section className={styles.stack} aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`} className="type-h3">{t("atelier3d.commands.title")}</h3>
    <p className="type-caption">{t("atelier3d.commands.help")}</p>
    <div className="flex flex-wrap gap-2">
      {(["reset-transform", "center", "floor"] as const).map((type) => <button key={type} type="button"
        className="btn btn-sm" disabled={!editable || !asset.nodes.has(selected)} onClick={() => run({ type, node: selected })}>
        {t(`atelier3d.commands.${type}`)}
      </button>)}
      <button type="button" className="btn btn-sm" disabled={!editable || !primitive}
        onClick={() => primitive && run({ type: "reset-material", primitive })}>{t("atelier3d.commands.reset-material")}</button>
    </div>
    {primitive && <p className="type-caption">{t("atelier3d.commands.mesh", { name: asset.primitives.get(primitive)?.name || primitive })}</p>}
    <div className="flex flex-wrap gap-2">
      {(["reset-vertices", "smooth"] as const).map((type) => <button key={type} type="button" className="btn btn-sm"
        disabled={!deformable} onClick={() => primitive && run({ type, primitive })}>{t(`atelier3d.commands.${type}`)}</button>)}
    </div>
    <fieldset disabled={!deformable} className={styles.stack}>
      <legend className="label">{t("atelier3d.commands.taper")}</legend>
      <p id={`${id}-taper-help`} className="type-caption">{t("atelier3d.commands.taperHelp")}</p>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="label">{t("atelier3d.commands.axis")}</legend>
        {(["x", "y", "z"] as const).map((value) => <label key={value} className={styles.check}>
          <input type="radio" name={`${id}-axis`} value={value} checked={axis === value} onChange={() => setAxis(value)} />
          {value.toUpperCase()}
        </label>)}
      </fieldset>
      <Field id={`${id}-factor`} label={t("atelier3d.commands.factor")}>
        <Input id={`${id}-factor`} type="number" min={0.25} max={2} step={0.05} value={factor}
          aria-describedby={`${id}-taper-help`} aria-invalid={!validFactor} onChange={(e) => setFactor(e.target.value)} />
      </Field>
      <button type="button" className="btn btn-sm" disabled={!validFactor || !deformable}
        onClick={() => primitive && run({ type: "taper", primitive, axis, factor: Number(factor) })}>{t("atelier3d.commands.applyTaper")}</button>
    </fieldset>
    {message && <p role={message.error ? "alert" : "status"}>{t(message.key)}</p>}
  </section>;
}
