"use client";
import { useI18n } from "@/lib/i18n/i18n";
import { Button } from "@/components/ui";
import type { SceneVersion } from "./contracts";
import styles from "./editor.module.css";

interface Props {
  history: Pick<SceneVersion, "id" | "sequence" | "author">[];
  canRestore: boolean;
  onRestore: (version: Pick<SceneVersion, "id">) => void;
}

/** Lista das versões salvas; restaurar carrega a versão como rascunho no editor. */
export function EditorVersionHistory({ history, canRestore, onRestore }: Props) {
  const { t } = useI18n();
  return (
    <section className={styles.evidence}>
      <h2 className="type-h3">{t("atelier3d.history")}</h2>
      {history.map((v) => (
        <div className={styles.toolbar} key={v.id}>
          <span>
            {t("atelier3d.version", { number: v.sequence })} · {v.author}
          </span>
          <Button disabled={!canRestore} onClick={() => onRestore(v)}>
            {t("atelier3d.restore")}
          </Button>
        </div>
      ))}
    </section>
  );
}
