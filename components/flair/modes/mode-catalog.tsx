"use client";
import { useState, type ReactNode } from "react";
import { Chip, cn } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import { FAMILIES, matchesFilter, modeMeta, scenePhoto, type ModeFilter } from "@/lib/flair/modes/registry";
import type { Mode } from "@/components/flair/modes/types";

const FILTERS: ModeFilter[] = ["all", "multi", "cards", "strategy"];

/**
 * Catálogo das Partidas FLAIR: cada modo é um cartão com a foto do cenário em que ele acontece, o selo solo/multiplayer,
 * se joga com cartas soltas do deck e a complexidade (1 a 5). Os modos vêm agrupados por família (duelos, estratégia,
 * campanhas e eventos) e os filtros recortam por multiplayer, cartas e estratégia.
 */
export function ModeCatalog({ modes, icons, onOpen }: { modes: Mode[]; icons: Record<string, ReactNode>; onOpen: (code: string) => void }) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<ModeFilter>("all");
  const visible = modes.filter((m) => matchesFilter(m.code, filter));
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("flair.arena.filtrar_modos")}>
        {FILTERS.map((f) => <Chip key={f} role="radio" aria-checked={filter === f} active={filter === f} onClick={() => setFilter(f)}>{t(`flair.arena.filtro.${f}`)}</Chip>)}
      </div>
      {FAMILIES.map((family) => {
        const list = visible.filter((m) => modeMeta(m.code).family === family);
        if (!list.length) return null;
        return (
          <section key={family}>
            <h2 className="type-h3 mb-2">{t(`flair.arena.familia.${family}`)}</h2>
            <div className="mode-grid mode-grid-scene">{list.map((m) => <SceneModeCard key={m.code} m={m} icon={icons[m.code]} onOpen={() => onOpen(m.code)} />)}</div>
          </section>
        );
      })}
    </div>
  );
}

function SceneModeCard({ m, icon, onOpen }: { m: Mode; icon?: ReactNode; onOpen: () => void }) {
  const { t } = useI18n();
  const meta = modeMeta(m.code);
  return (
    <button type="button" className="fm-card fm-scene" onClick={onOpen}>
      <img className="fm-scene-photo" src={scenePhoto(m.code)} alt="" loading="lazy" decoding="async" />
      <span className="fm-card-emoji" aria-hidden>{icon ?? m.emoji}</span>
      <p className="type-h3">{m.name}</p>
      <p className="type-body-sm text-muted">{m.summary}</p>
      <span className="fm-tags">
        <span className="fm-tag">{t("flair.arena.solo")}</span>
        <span className="fm-tag is-multi">{t(`flair.arena.multi.${meta.multi}`)}</span>
        {meta.hand === "deck" && <span className="fm-tag is-cards">{t("flair.arena.com_cartas")}</span>}
        <span className="fm-level" aria-label={t("flair.arena.complexidade", { n: meta.complexity })}>
          {[1, 2, 3, 4, 5].map((i) => <i key={i} className={cn(i <= meta.complexity && "on")} />)}
        </span>
      </span>
    </button>
  );
}
