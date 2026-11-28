"use client";
import { useI18n } from "@/lib/i18n/i18n";
import { Button, Select } from "@/components/ui";
import type { Tool, View } from "./viewport";
import styles from "./editor.module.css";

const TOOLS: Tool[] = ["translate", "rotate", "scale"];
const VIEWS: View[] = ["perspective", "front", "back", "left", "right", "top"];

interface Props {
  tool: Tool;
  view: View;
  wireframe: boolean;
  snap: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onTool: (tool: Tool) => void;
  onView: (view: View) => void;
  onFit: () => void;
  onWireframe: (value: boolean) => void;
  onSnap: (value: boolean) => void;
  onTravel: (direction: "undo" | "redo") => void;
}

/** Gizmo, desfazer/refazer, câmera e ajudas visuais do viewport; o estado continua no editor. */
export function EditorViewToolbar(props: Props) {
  const { t } = useI18n();
  return (
    <div className={styles.toolbar}>
      {TOOLS.map((mode) => (
        <Button key={mode} aria-pressed={props.tool === mode} onClick={() => props.onTool(mode)}>
          {t(`atelier3d.${mode}`)}
        </Button>
      ))}
      <Button disabled={!props.canUndo} onClick={() => props.onTravel("undo")}>
        {t("atelier3d.undo")}
      </Button>
      <Button disabled={!props.canRedo} onClick={() => props.onTravel("redo")}>
        {t("atelier3d.redo")}
      </Button>
      <Select aria-label={t("atelier3d.view")} value={props.view} onChange={(e) => props.onView(e.target.value as View)}>
        {VIEWS.map((v) => (
          <option key={v} value={v}>
            {t(`atelier3d.view.${v}`)}
          </option>
        ))}
      </Select>
      <Button onClick={props.onFit}>{t("atelier3d.fit")}</Button>
      <label className={styles.check}>
        <input type="checkbox" checked={props.wireframe} onChange={(e) => props.onWireframe(e.target.checked)} />
        {t("atelier3d.wireframe")}
      </label>
      <label className={styles.check}>
        <input type="checkbox" checked={props.snap} onChange={(e) => props.onSnap(e.target.checked)} />
        {t("atelier3d.snap")}
      </label>
    </div>
  );
}
