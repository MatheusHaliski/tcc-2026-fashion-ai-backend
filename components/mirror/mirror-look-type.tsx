"use client";
import { api, ApiError } from "@/lib/api/client";
import type { TipoLook } from "@/lib/api/types";
import { lookTypeName } from "@/lib/api/look-type";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { Chip, ErrorState } from "@/components/ui";

/**
 * Espelho › "Para quem é o look": chips (radiogroup) com os tipos do cadastro, cada um pelo nome no idioma de quem lê
 * ("Unissex", não o "Unisex" gravado). Sem a rota de tipos (404/405), avisa e o espelho segue funcionando.
 */
export function MirrorLookType({ currentId, busy, onChoose }: { currentId?: string | null; busy: boolean; onChoose: (id: string) => void }) {
  const { t } = useI18n();
  const tipos = useApi<TipoLook[]>((signal) => api.get("/api/tipos-look", { signal }), []);
  const missing = tipos.error instanceof ApiError && (tipos.error.status === 404 || tipos.error.status === 405);
  return (
    <section className="mirror-section" aria-labelledby="mirror-tipo-h">
      <h3 id="mirror-tipo-h" className="mirror-section-h">{t("mirror.para_quem")}</h3>
      {missing ? <p className="type-body-sm text-muted" role="status">{t("lookType.unavailable")}</p>
        : tipos.error ? <ErrorState error={tipos.error} onRetry={tipos.reload} />
        : (
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-labelledby="mirror-tipo-h">
            {(tipos.data ?? []).map((tipo) => (
              <Chip key={tipo.id} role="radio" aria-checked={currentId === tipo.id} disabled={busy}
                onClick={() => { if (currentId !== tipo.id) onChoose(tipo.id); }}>{lookTypeName(tipo, t)}</Chip>
            ))}
          </div>
        )}
    </section>
  );
}
