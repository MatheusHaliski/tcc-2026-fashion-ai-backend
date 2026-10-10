"use client";

import { Button, Card } from "@/components/ui";
import { mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import type { SavedTry } from "@/lib/tryon/fitting-room-model";

export interface SavedTriesProps {
  saved: SavedTry[];
  onRestore: (saved: SavedTry) => void;
  onDelete: (id: string) => void;
}

/** Provas salvas; restauração e persistência permanecem no coordenador. */
export function SavedTries({ saved, onRestore, onDelete }: SavedTriesProps) {
  const { t } = useI18n();

  return (
    <Card>
      {!saved.length ? (
        <p className="type-body-sm text-muted">{t("tryOn.nenhuma_prova_salva")}</p>
      ) : (
        <ul className="grid gap-2">
          {saved.map((entry) => (
            <li key={entry.id} className="fitting-saved">
              <div className="flex -space-x-2">
                {entry.items.slice(0, 4).map((item) => (
                  <span
                    key={item.key}
                    className="fitting-slot-thumb is-small"
                    style={{ background: item.colorHex ?? "var(--surface-2)" }}
                  >
                    {item.imageUrl ? <img src={mediaUrl(item.imageUrl) ?? undefined} alt="" /> : null}
                  </span>
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate type-body-sm font-medium">{entry.title}</p>
                <p className="type-caption text-muted">
                  {t("tryOn.n_pecas", { n: entry.items.length })} · {new Date(entry.createdAt).toLocaleDateString()}
                </p>
              </div>
              <Button size="sm" onClick={() => onRestore(entry)}>{t("tryOn.vestir_de_novo")}</Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={t("tryOn.apagar_prova", { title: entry.title })}
                onClick={() => onDelete(entry.id)}
              >
                {t("tryOn.remover")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
