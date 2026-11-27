"use client";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import type { CbcGroup, CbcList as CbcListData, CbcSummary } from "@/lib/flair/cbc";
import { Badge, Card, cn, EmptyState, ErrorState, PageHeader, SkeletonGrid, UiIcon } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { CenaVestir } from "@/components/flair/cenas/cena-vestir";
import { CenaViva } from "@/components/flair/cenas/cena-viva";
import { useCbcLabels, windowOf } from "@/components/flair/use-cbc-labels";
import { HowItWorks } from "@/components/guide/guide";
import { cenaDoCenario } from "@/lib/flair/cenas/catalogo";
import { vestirDoCenario } from "@/lib/flair/vestir/cenas";
import { CbcPreferidos, cenarioVisivel, useCenarioPreferido } from "@/components/flair/cbc-cenario-preferido";

export { CbcPlay } from "@/components/flair/cbc-play";
export { CbcRewardDialog } from "@/components/flair/cbc-partes";

/**
 * Desafios de Montagem (Card Building Challenges, FLAIR-UT §7 e §14) sobre /api/flair/challenges.
 * A analogia é a dos desafios de elenco dos jogos de futebol: em vez de um campo, a pessoa completa um mini mapa
 * ilustrado do objetivo (Ipanema, a gala, o desfile…), vaga a vaga, com as próprias cartas FLAIR. A sintonia é a
 * "química"; os requisitos, a sintonia, a história e os pontos vêm sempre do servidor (/check), que é a fonte da
 * verdade; a entrega (/submit) é atômica e bloqueia as cartas como memória. Conferir nunca gasta nada.
 *
 * A montagem está em cbc-play.tsx; as partes comuns, em cbc-partes.tsx; os rótulos, em use-cbc-labels.ts.
 */

// ================================================================== lista
export function CbcList() {
  const { t } = useI18n();
  const data = useApi<CbcListData>((signal) => api.get("/api/flair/challenges", { signal }), []);
  return (
    <>
      <div className="flair-section-head">
        <Link href="/flair?mode=cbc" className="btn btn-sm"><UiIcon name="chevronLeft" size={18} />{t("flair.hub.back")}</Link>
        <PageHeader title={t("flair.hub.mode.cbc.title")} kicker={t("flair.hub.mode.cbc.kicker")}
          actions={<div className="flex flex-wrap items-center gap-2"><HowItWorks id="flair.cbc" />{data.data && <Badge tone="thread">{t("cbc.season", { season: data.data.season })}</Badge>}</div>} />
      </div>
      {data.error ? <ErrorState error={data.error} onRetry={data.reload} /> : data.loading || !data.data ? <SkeletonGrid /> : <CbcPreferidos><CbcSections list={data.data} /></CbcPreferidos>}
    </>
  );
}

function CbcSections({ list }: { list: CbcListData }) {
  const { t } = useI18n();
  const empty = list.now.length + list.always.length + list.upcoming.length + list.groups.length + list.memories.length === 0;
  if (empty) return <EmptyState title={t("cbc.empty.title")} hint={t("cbc.empty.hint")} />;
  return (
    <div className="grid gap-6">
      <Section id="now" title={t("cbc.section.now")} items={list.now} />
      <Section id="always" title={t("cbc.section.always")} items={list.always} />
      <Section id="upcoming" title={t("cbc.section.upcoming")} items={list.upcoming} />
      {list.groups.length > 0 && <section aria-labelledby="cbc-groups"><h2 id="cbc-groups" className="type-h2 mb-3">{t("cbc.section.groups")}</h2><div className="grid gap-3 md:grid-cols-2">{list.groups.map((g) => <GroupCard key={g.code} g={g} />)}</div></section>}
      <Section id="memories" title={t("cbc.section.memories")} items={list.memories} />
    </div>
  );
}

function Section({ id, title, items }: { id: string; title: string; items: CbcSummary[] }) {
  if (items.length === 0) return null;
  return <section aria-labelledby={`cbc-${id}`}><h2 id={`cbc-${id}`} className="type-h2 mb-3">{title}</h2><div className="cbc-grid">{items.map((c) => <CbcCard key={c.id} c={c} />)}</div></section>;
}

export function CbcCard({ c }: { c: CbcSummary }) {
  const { t } = useI18n(); const { requirement } = useCbcLabels();
  const w = windowOf(c, t);
  const done = !!c.mine?.done;
  // exercício 16: a cena que esta pessoa prefere, sem mudar o desafio; num desafio de vestir, a cena é o próprio desafio
  const preferido = useCenarioPreferido(c.id);
  const vestir = vestirDoCenario(c.scenario);
  const arte = vestir ? <CenaVestir cena={vestir} nome={c.name} vestidos={vestir.pessoas.map(() => done)} decorativa />
    : <CenaViva cena={cenaDoCenario(cenarioVisivel(preferido, c.scenario))} decorativa />;
  return (
    <article className={cn("cbc-card", c.status === "ENDED" && "is-ended")} aria-labelledby={`cbc-card-${c.id}`}>
      <Link href={`/flair/desafios/${encodeURIComponent(c.slug)}`} className="cbc-card-art" aria-hidden tabIndex={-1}>{arte}<span className={cn("cbc-diff", `is-${c.difficulty.toLowerCase()}`)}>{t(`cbc.difficulty.${c.difficulty}`)}</span></Link>
      <div className="cbc-card-body">
        <div className="flex flex-wrap items-center gap-2"><Badge tone={w.tone}>{w.text}</Badge>{c.moment && <Badge>{c.moment.name}</Badge>}{done && <Badge tone="thread">{t("cbc.done")}</Badge>}</div>
        <h3 id={`cbc-card-${c.id}`} className="type-h3 mt-1">{c.name}</h3>
        {c.description && <p className="type-body-sm text-muted">{c.description}</p>}
        {preferido && !vestir && <p className="type-caption text-muted" data-cbc-cenario={preferido.codigo}>{t("cbc.cenarioPreferido.no_card", { nome: preferido.nome })}</p>}
        <ul className="cbc-reqs-mini">
          <li>{t("cbc.slots_n", { n: c.slotsCount })}</li>
          {c.requirements.map((r, i) => <li key={i}>{requirement(r)}</li>)}
          {c.levelOpen && c.requirements.length === 0 && <li>{t("cbc.any_level")}</li>}
        </ul>
        <div className="cbc-card-foot">
          <span className="cbc-points"><FaiIcon id="ACT-40" size={20} decorative /><b className="tabular">+{c.pointsPreview}</b>{c.multiplier !== 1 && <small className="tabular">×{c.multiplier}</small>}</span>
          <Link href={`/flair/desafios/${encodeURIComponent(c.slug)}`} className={cn("btn btn-sm", c.status !== "ENDED" && !done && "btn-primary")}>
            {c.status === "ENDED" ? t("cbc.see_memory") : done ? t("cbc.see_delivery") : c.status === "UPCOMING" ? t("cbc.prepare") : t("cbc.build")}
          </Link>
        </div>
      </div>
    </article>
  );
}

function GroupCard({ g }: { g: CbcGroup }) {
  const { t } = useI18n();
  return (
    <Card>
      <div className="flex items-start justify-between gap-2"><div><p className="type-label text-muted">{t("cbc.group")}</p><h3 className="type-h3">{g.name}</h3>{g.description && <p className="type-body-sm text-muted">{g.description}</p>}</div><span className="cbc-points"><FaiIcon id="ACT-40" size={20} decorative /><b className="tabular">+{g.points}</b></span></div>
      <div className="hype-bar mt-2"><i style={{ width: `${g.total ? (g.done / g.total) * 100 : 0}%`, background: "var(--thread)" }} /></div>
      <p className="type-caption tabular mt-1">{t("cbc.group_progress", { done: g.done, total: g.total })}{g.completed ? ` · ${t("cbc.done")}` : ""}</p>
      <ul className="mt-2 flex flex-wrap gap-1.5">{g.challenges.map((c) => <li key={c.id}><Link href={`/flair/desafios/${encodeURIComponent(c.slug)}`} className={cn("chip", c.done && "is-active")}>{c.done ? "✓ " : ""}{c.name}</Link></li>)}</ul>
    </Card>
  );
}
