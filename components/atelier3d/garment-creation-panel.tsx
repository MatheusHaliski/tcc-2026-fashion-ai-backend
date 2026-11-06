"use client";
import { useRef, useState } from "react";
import { Button, Dialog, Field, Input } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import { createGarmentTemplate, GARMENT_TEMPLATES, type GarmentTemplate } from "@/lib/atelier3d/garment-template";
import styles from "./editor.module.css";

interface Props {
  editable: boolean;
  dirty: boolean;
  onCreate: (file: File) => Promise<void>;
}

/** Creates a local prototype then goes through the same validated upload path as imported GLBs. */
export function GarmentCreationPanel({ editable, dirty, onCreate }: Props) {
  const { t } = useI18n();
  const [kind, setKind] = useState<GarmentTemplate>("tee");
  const [color, setColor] = useState("#2867ad");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState(false);
  const current = useRef({ editable, dirty, onCreate });
  current.current = { editable, dirty, onCreate };
  async function create() {
    if (!editable || busy) return;
    setConfirm(false);
    setBusy(true);
    setError(false);
    try {
      const bytes = await createGarmentTemplate(kind, color);
      if (!current.current.editable) return;
      if (current.current.dirty && !dirty) {
        setConfirm(true);
        return;
      }
      await current.current.onCreate(new File([bytes], `fai-${kind}-prototype.glb`, { type: "model/gltf-binary" }));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return <section className={styles.evidence}>
    <h2 className="type-h3">{t("atelier3d.create.title")}</h2>
    <p className="type-caption">{t("atelier3d.create.scope")}</p>
    <fieldset disabled={!editable || busy} className={styles.toolbar}>
      <legend className="sr-only">{t("atelier3d.create.title")}</legend>
      {GARMENT_TEMPLATES.map((value) => <label className={styles.check} key={value}>
        <input type="radio" name="garment-template" value={value} checked={kind === value} onChange={() => setKind(value)} />
        {t(`atelier3d.create.${value}`)}
      </label>)}
      <Field id="garment-template-color" label={t("atelier3d.create.color")}>
        <Input id="garment-template-color" type="color" value={color} onChange={(event) => setColor(event.target.value)} />
      </Field>
      <Button disabled={!editable || busy} loading={busy} onClick={() => dirty ? setConfirm(true) : void create()}>
        {t("atelier3d.create.action")}
      </Button>
    </fieldset>
    {error && <p role="alert">{t("atelier3d.create.error")}</p>}
    <Dialog open={confirm} onClose={() => setConfirm(false)} title={t("atelier3d.create.replaceTitle")}>
      <p>{t("atelier3d.create.replaceWarning")}</p>
      <Button onClick={() => setConfirm(false)}>{t("common.cancel")}</Button>
      <Button disabled={!editable || busy} onClick={() => void create()}>{t("atelier3d.create.replace")}</Button>
    </Dialog>
  </section>;
}
