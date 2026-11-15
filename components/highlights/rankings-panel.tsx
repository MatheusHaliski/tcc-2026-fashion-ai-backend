"use client";

import { useI18n } from "@/lib/i18n/i18n";
import { Button } from "@/components/ui";

export interface RankingPositionView { segment: string; position: number; total: number; topPercent?: number | null }
export interface RankingsView { score?: number | null; optedIn?: boolean; message?: string; available?: string[]; positions?: RankingPositionView[]; note?: string }

/** "PAIS:BR" → nome do ranking na tela ("Seu país · BR"); código sem nome conhecido aparece como veio. */
export function rankingName(segment: string, t: (key: string) => string): string {
  const [kind, detail] = segment.split(":", 2);
  const key = `highlights.rank.seg.${kind}`;
  const name = t(key);
  const label = name === key ? kind : name;
  return detail ? `${label} · ${detail}` : label;
}

/**
 * Conteúdo da janela "Rankings" dos Destaques (RF34.CA08): a nota, a frase de quem ainda não participa com o botão
 * para entrar, a lista dos rankings pelo nome e, para quem participa, a posição em cada um. Antes a janela mostrava
 * a resposta da API como JSON.
 */
export function RankingsPanel({ data, busy, onOptIn }: { data: RankingsView; busy: boolean; onOptIn: (join: boolean) => void }) {
  const { t } = useI18n();
  const positions = data.positions ?? [];
  return (
    <div className="grid gap-3">
      {data.score != null && <p className="type-body font-medium">{t("highlights.rank.sua_nota", { score: data.score })}</p>}
      {!data.optedIn ? (
        <>
          <p className="type-body-sm text-muted">{data.message ?? t("highlights.rank.fora")}</p>
          <div>
            <Button variant="primary" loading={busy} onClick={() => onOptIn(true)}>{t("highlights.rank.participar")}</Button>
          </div>
          <h3 className="type-h3">{t("highlights.rank.disponiveis")}</h3>
          <ul className="fai-list">
            {(data.available ?? []).map((segment) => <li key={segment} className="py-1 type-body-sm">{rankingName(segment, t)}</li>)}
          </ul>
        </>
      ) : (
        <>
          {positions.length === 0 && <p className="type-body-sm text-muted" role="status">{t("highlights.rank.sem_posicao")}</p>}
          <ul className="fai-list">
            {positions.map((p) => (
              <li key={p.segment} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span className="type-body">{rankingName(p.segment, t)}</span>
                <span className="type-data tabular">{t("highlights.rank.posicao", { position: p.position, total: p.total, top: Math.max(1, Math.round(p.topPercent ?? 100)) })}</span>
              </li>
            ))}
          </ul>
          {data.note && <p className="type-caption text-muted">{data.note}</p>}
          <div>
            <Button size="sm" loading={busy} onClick={() => onOptIn(false)}>{t("highlights.rank.sair")}</Button>
          </div>
        </>
      )}
    </div>
  );
}
