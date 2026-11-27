"use client";
import { useEffect } from "react";
import { Chip } from "@/components/ui";
import { api, qs } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";

/** Abas da busca que o servidor responde por termo (GET /api/search?tab=…). */
export const SEARCH_TABS = ["LOOKS", "PECAS", "PESSOAS", "MARCAS", "CELEBRIDADES"] as const;
export type SearchTab = typeof SEARCH_TABS[number];

/**
 * Busca sem resultado na aba aberta: confere as outras abas com o mesmo termo e oferece o atalho para as que têm
 * resultado ("jaqueta" não é nome de look, mas é de peça). Sem isso a tela dizia só "Nada encontrado".
 */
export function SearchElsewhere({ term, current, anonymous, labelOf, onOpen, autoOpen = false }: {
  term: string; current: string; anonymous: boolean; labelOf: (tab: SearchTab) => string; onOpen: (tab: SearchTab) => void;
  /** a pessoa não escolheu a aba: abre sozinho a primeira que tem resultado (busca "jaqueta" cai em Peças, não em Looks vazio) */
  autoOpen?: boolean;
}) {
  const { t } = useI18n();
  const others = SEARCH_TABS.filter((tab) => tab !== current);
  const found = useApi<SearchTab[]>(async (signal) => {
    const hits = await Promise.all(others.map((tab) => api
      .get<{ results?: unknown[] }>(`/api/search${qs({ q: term, tab, size: 1 })}`, { anonymous, signal })
      .then((r) => (r.results?.length ? tab : null))
      .catch(() => null)));
    return hits.filter((tab): tab is SearchTab => tab !== null);
  }, [term, current, anonymous], { enabled: !!term.trim() });
  const first = found.data?.[0];
  useEffect(() => {
    if (autoOpen && first) onOpen(first);
  }, [autoOpen, first]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!term.trim() || !found.data?.length) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center justify-center gap-1.5" role="status" data-search-elsewhere>
      <span className="type-body-sm">{t("search.ha_resultados_em")}</span>
      {found.data.map((tab) => <Chip key={tab} onClick={() => onOpen(tab)}>{labelOf(tab)}</Chip>)}
    </div>
  );
}
