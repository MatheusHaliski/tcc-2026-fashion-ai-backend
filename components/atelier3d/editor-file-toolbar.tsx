"use client";
import { Button, Field, Input } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import styles from "./editor.module.css";

interface Props {
  canEdit: boolean;
  canSave: boolean;
  canExport: boolean;
  busy: boolean;
  autosave: boolean;
  onAutosave: (value: boolean) => void;
  onUpload: (file: File) => void;
  onSave: () => void;
  onExport: () => void;
  onReload: () => void;
}

/** File lifecycle actions stay distinct from viewport and geometry commands. */
export function EditorFileToolbar(props: Props) {
  const { t } = useI18n();
  return <div className={styles.toolbar}>
    <Field id="atelier-glb-file" label={t("atelier3d.import")}>
      <Input id="atelier-glb-file" type="file" accept=".glb,model/gltf-binary" disabled={!props.canEdit}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) props.onUpload(file);
          event.target.value = "";
        }} />
    </Field>
    <Button disabled={!props.canSave} onClick={props.onSave}>{t("common.save")}</Button>
    <Button disabled={!props.canExport} onClick={props.onExport}>{t("atelier3d.export")}</Button>
    <Button disabled={props.busy} onClick={props.onReload}>{t("atelier3d.reload")}</Button>
    <label className={styles.check}>
      <input type="checkbox" checked={props.autosave} onChange={(event) => props.onAutosave(event.target.checked)} />
      {t("atelier3d.autosave")}
    </label>
  </div>;
}
