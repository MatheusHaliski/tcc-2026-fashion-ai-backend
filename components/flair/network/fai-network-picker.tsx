"use client";
import { useState } from "react";
import { mediaUrl } from "@/lib/api/client";
import { Avatar, Badge, Chip, cn, Input, Skeleton } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import { NETWORK_FILTERS, useFaiNetwork, type NetworkFilter, type NetworkPerson } from "@/components/flair/network/use-fai-network";

/**
 * Convite pela rede FAI: em vez de digitar o @ do adversário, a pessoa busca na rede (toda a rede, quem segue, quem a
 * segue ou mútuos), vê avatar, nome e quantos looks a outra pessoa tem, e toca em "Convidar". `value` são os @ escolhidos
 * (sem o "@"); `max` limita quantos (1 adversário, 2 da dupla adversária, até 5 no desafio de placar). `exclude` tira
 * da lista quem já ocupa outra vaga (ex.: a parceira da dupla não aparece entre os adversários).
 */
export function FaiNetworkPicker({ value, onChange, max = 1, label, exclude = [], id = "fai-net" }: {
  value: string[]; onChange: (v: string[]) => void; max?: number; label: string; exclude?: string[]; id?: string;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<NetworkFilter>("all");
  const { people, loading, error, reload } = useFaiNetwork(query, filter);
  const [known, setKnown] = useState<Record<string, NetworkPerson>>({});
  const full = value.length >= max;
  const toggle = (p: NetworkPerson) => {
    if (value.includes(p.username)) { onChange(value.filter((x) => x !== p.username)); return; }
    setKnown((k) => ({ ...k, [p.username]: p }));
    onChange(max === 1 ? [p.username] : full ? value : [...value, p.username]);
  };
  const list = people.filter((p) => !exclude.includes(p.username));
  return (
    <div className="fai-net" role="group" aria-labelledby={`${id}-label`}>
      <p className="label" id={`${id}-label`}>{label}{max > 1 ? ` (${value.length}/${max})` : ""}</p>
      {value.length > 0 && (
        <ul className="fai-net-picked" aria-label={t("flair.network.escolhidos")}>
          {value.map((u) => (
            <li key={u}>
              <Avatar src={mediaUrl(known[u]?.avatarUrl)} name={known[u]?.displayName ?? u} size={22} />
              <span>@{u}</span>
              <button type="button" className="fai-net-remove" aria-label={t("flair.network.remover", { user: u })} onClick={() => onChange(value.filter((x) => x !== u))}>×</button>
            </li>))}
        </ul>
      )}
      <Input id={id} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("flair.network.buscar_placeholder")}
        aria-label={t("flair.network.buscar")} autoComplete="off" />
      <div className="fai-net-filters" role="radiogroup" aria-label={t("flair.network.recorte")}>
        {NETWORK_FILTERS.map((f) => <Chip key={f} role="radio" aria-checked={filter === f} active={filter === f} onClick={() => setFilter(f)}>{t(`flair.network.filtro.${f}`)}</Chip>)}
      </div>
      {loading ? <Skeleton className="h-24" /> : error ? (
        <p className="type-caption text-muted">{t("flair.network.erro")} <button type="button" className="underline" onClick={reload}>{t("common.retry")}</button></p>
      ) : list.length === 0 ? (
        <p className="type-caption text-muted">{query.trim() ? t("flair.network.ninguem_com", { q: query.trim() }) : t(`flair.network.vazio.${filter}`)}</p>
      ) : (
        <ul className="fai-net-list" aria-label={t("flair.network.resultados")}>
          {list.map((p) => {
            const on = value.includes(p.username);
            return (
              <li key={p.id} className={cn("fai-net-person", on && "is-on")}>
                <Avatar src={mediaUrl(p.avatarUrl)} name={p.displayName} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="type-body-sm font-semibold truncate">{p.displayName || p.username}{p.verified ? " ✓" : ""}</p>
                  <p className="type-caption text-muted truncate">@{p.username}{p.counters?.schemes != null ? ` · ${t("flair.network.looks", { n: p.counters.schemes })}` : ""}</p>
                </div>
                {p.relation === "ACEITO" && <Badge tone="thread">{t("flair.network.voce_segue")}</Badge>}
                <button type="button" className={cn("btn btn-sm", on ? "btn-primary" : "")} aria-pressed={on} disabled={!on && full && max > 1}
                  aria-label={t(on ? "flair.network.convidado_aria" : "flair.network.convidar_aria", { user: p.username })} onClick={() => toggle(p)}>
                  {on ? t("flair.network.convidado") : t("flair.network.convidar")}
                </button>
              </li>);
          })}
        </ul>
      )}
    </div>
  );
}
