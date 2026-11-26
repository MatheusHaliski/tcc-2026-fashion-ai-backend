"use client";
import { api, ApiError } from "@/lib/api/client";
import type { ReferenceOption } from "@/lib/api/types";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { Chip, ErrorState } from "@/components/ui";

/** O retorno do Vista-me com nível térmico pedido (MirrorThermalFit.paraTela): evidência pela intensidade declarada das peças. */
export interface MirrorThermalFit { nivelTermico: string; compativeis: number; divergentes: number; semDado: number; base?: string }

/** Os níveis ativos (GET /api/opcoes/niveis-termicos), lidos uma vez pelo Vista-me e repartidos entre os chips e a nota. */
export function useNiveisTermicos() {
  return useApi<ReferenceOption[]>((signal) => api.get("/api/opcoes/niveis-termicos", { signal }), []);
}
type Niveis = ReturnType<typeof useNiveisTermicos>;
const list = (niveis: Niveis) => (Array.isArray(niveis.data) ? niveis.data : []);

/**
 * Espelho › Vista-me › "Nível térmico do look": chips (radiogroup) com "Não informado" e os níveis ativos da tabela
 * niveis_termicos. "Não informado" é a ausência do critério (o pedido sai sem nivelTermicoId), não um nível. Enquanto
 * carrega, só um aviso de carregando — nenhum chip finge um valor; com erro, "Tentar de novo"; sem a rota (404/405),
 * um aviso curto e o Vista-me segue sem o critério. Não é o clima do pedido ("frio", "calor"): é o nível do look.
 */
export function MirrorThermalLevel({ niveis, value, busy, onChange }: { niveis: Niveis; value: string | null; busy: boolean; onChange: (id: string | null) => void }) {
  const { t } = useI18n();
  const missing = niveis.error instanceof ApiError && (niveis.error.status === 404 || niveis.error.status === 405);
  return (
    <div className="grid gap-1.5" data-thermal-state={niveis.loading ? "loading" : niveis.error ? "error" : "ready"}>
      <p id="mirror-thermal-h" className="type-body-sm font-semibold">{t("lookReferences.nivelTermico.label")}</p>
      {niveis.loading ? <p className="type-body-sm text-muted" role="status">{t("lookReferences.nivelTermico.loading")}</p>
        : missing ? <p className="type-body-sm text-muted" role="status">{t("lookReferences.nivelTermico.mirrorUnavailable")}</p>
        : niveis.error ? <ErrorState error={niveis.error} onRetry={niveis.reload} />
        : (
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-labelledby="mirror-thermal-h">
            <Chip role="radio" aria-checked={value === null} disabled={busy} onClick={() => onChange(null)}>{t("lookReferences.nivelTermico.unselected")}</Chip>
            {list(niveis).map((nivel) => (
              <Chip key={nivel.id} role="radio" aria-checked={value === nivel.id} disabled={busy} onClick={() => onChange(nivel.id)}>{nivel.nome}</Chip>
            ))}
          </div>
        )}
    </div>
  );
}

/** Na recomendação: o nível pedido (pelo nome da opção) e quantas peças declaram intensidade compatível, divergente ou nenhuma. */
export function MirrorThermalFitNote({ niveis, fit }: { niveis: Niveis; fit: MirrorThermalFit }) {
  const { t } = useI18n();
  const nome = list(niveis).find((n) => n.codigo === fit.nivelTermico)?.nome ?? fit.nivelTermico;
  return (
    <p className="type-body-sm" data-testid="mirror-thermal-fit">
      <b>{t("lookReferences.nivelTermico.pedido", { nivel: nome })}</b>{" · "}
      {t("lookReferences.nivelTermico.fit", { ok: fit.compativeis, diverge: fit.divergentes, semDado: fit.semDado })}
    </p>
  );
}
