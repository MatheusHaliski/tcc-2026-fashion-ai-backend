"use client";
/**
 * Montagem de um Desafio de Montagem (/flair/desafios/[slug]): em cima, a cena dinâmica do desafio como quebra-cabeça
 * (uma peça por vaga: entra quando a carta é posta e encaixa conforme a sintonia que o servidor dá); embaixo, as vagas
 * em grade; ao pé da tela, a bandeja com as cartas da vaga em destaque. Pôr uma carta é um toque, um arrasto ou
 * Espaço/A no teclado e no controle (use-cbc-controle.ts).
 * A lista está em cbc.tsx; os dados e a conferência, em use-cbc-mesa.ts; a jogada, em use-cbc-jogo.ts.
 */
import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n";
import { OWN_READING } from "@/lib/flair/cbc";
import { Badge, cn, EmptyState, ErrorState, PageHeader, Skeleton, UiIcon } from "@/components/ui";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import { CbcPainel } from "@/components/flair/cbc-painel";
import { CbcRewardDialog, Story, SubmissionView } from "@/components/flair/cbc-partes";
import { CbcVagas } from "@/components/flair/cbc-vagas";
import { CenaVestir } from "@/components/flair/cenas/cena-vestir";
import { CenaViva } from "@/components/flair/cenas/cena-viva";
import { Bandeja } from "@/components/flair/montagem/bandeja";
import { useCbcControle } from "@/components/flair/use-cbc-controle";
import { useCbcJogo } from "@/components/flair/use-cbc-jogo";
import { useCbcLabels, windowOf } from "@/components/flair/use-cbc-labels";
import { useCbcMesa } from "@/components/flair/use-cbc-mesa";
import { HowItWorks } from "@/components/guide/guide";
import { cenaDoCenario } from "@/lib/flair/cenas/catalogo";
import { vestidos, vestirDoCenario } from "@/lib/flair/vestir/cenas";

export function CbcPlay({ slug }: { slug: string }) {
  const { t } = useI18n();
  const { slotLabel, storyText, tOr } = useCbcLabels();
  const m = useCbcMesa(slug);
  const j = useCbcJogo(m);
  const d = m.d;
  const foco = useCbcControle(j, d?.slots.map((s) => s.key) ?? [], !!d && !m.readOnly);

  if (m.detail.error) return <ErrorState error={m.detail.error} onRetry={m.detail.reload} />;
  if (m.detail.loading || !d) return <Skeleton className="h-96" />;
  const w = windowOf(d, t);
  const cena = cenaDoCenario(d.scenario);
  const vestir = vestirDoCenario(d.scenario);
  // "vestir a cena": o personagem troca de roupa quando o servidor aceita a carta da vaga dele (lib/flair/vestir)
  const julgadas = m.check?.evaluation.slots;
  const recusadas = new Set((julgadas ?? []).filter((r) => r.accepted === false && r.cardId === m.placed[r.slot]).map((r) => r.slot));
  const cartas = Object.fromEntries(m.available.map((c) => [c.id, c]));
  const postas: Record<string, FlairCollectionCard | undefined> = Object.fromEntries(Object.entries(m.placed).map(([k, v]) => [k, cartas[v]]));
  const sintonia = m.fresca && m.check ? Object.fromEntries(m.check.evaluation.slots.map((r) => [r.slot, r.sintonia])) : null;
  const delivered = d.mySubmissions[0];
  const semCartas = m.available.length === 0 && !m.bank.loading;
  const bandeja = j.aberta && !m.readOnly && !!j.atual && !semCartas;
  const posicao = (codigo: string) => tOr(`cbc.position.${codigo}`, codigo);

  return (
    <>
      <div className="flair-section-head">
        <Link href="/flair/desafios" className="btn btn-sm"><UiIcon name="chevronLeft" size={18} />{t("cbc.back_to_list")}</Link>
        <PageHeader title={d.name} kicker={`${t("flair.hub.mode.cbc.title")} · ${t(`cbc.difficulty.${d.difficulty}`)}`}
          actions={<div className="flex flex-wrap items-center gap-2"><HowItWorks id="flair.cbc" /><Badge tone={w.tone}>{w.text}</Badge>{d.moment && <Badge>{d.moment.name}</Badge>}</div>} />
      </div>
      {d.description && <p className="type-body-lg mb-4 max-w-prose">{d.description}</p>}
      {d.status === "UPCOMING" && <p className="cbc-note" role="note">{t("cbc.note.upcoming")}</p>}
      {d.status === "ENDED" && <p className="cbc-note" role="note">{t("cbc.note.ended")}</p>}
      {delivered && d.status !== "ENDED" && (
        <p className="cbc-note" role="note">{t("cbc.note.delivered", { attempt: delivered.attempt, sintonia: delivered.sintonia, max: delivered.sintoniaMax })}</p>
      )}

      {m.readOnly && delivered ? (
        <div className="grid gap-3">
          <div className={cn("cbc-stage-art is-done", vestir && "is-vestir")}>
            {vestir ? <CenaVestir cena={vestir} nome={d.name} vestidos={vestir.pessoas.map(() => true)} /> : <CenaViva cena={cena} pecas={d.slots.map(() => "verde")} completa />}
          </div>
          <SubmissionView s={delivered} scenario={d.scenario} slots={d.slots} />
        </div>
      ) : (
        <div className="cbc-play">
          <div className="cbc-play-stage">
            <div className="cbc-stage">
              <div className={cn("cbc-stage-art", vestir && "is-vestir")}>
                {vestir ? <CenaVestir cena={vestir} nome={d.name} vestidos={vestidos(vestir, m.placed, julgadas)} /> : <CenaViva cena={cena} pecas={j.pecas} completa={!!m.result} />}
              </div>
              <CbcVagas slots={d.slots} placed={postas} sintonia={sintonia} recusadas={recusadas} selecionada={j.atual?.key} labelOf={(s) => slotLabel(d.scenario, s)}
                onVaga={m.readOnly ? undefined : j.selecionar} pegar={m.readOnly ? undefined : j.pegar} />
            </div>
            {semCartas && (
              <EmptyState title={t("cbc.no_cards.title")} hint={t("cbc.no_cards.hint")}
                action={<Link href="/pieces/new" className="btn btn-sm btn-primary">{t("common.cadastrar_peca")}</Link>} />
            )}
            {m.check && m.check.story.length > 0 && <Story lines={m.check.story} text={storyText} />}
            {bandeja && j.atual && (
              <Bandeja vagaId={j.atual.key} vaga={j.nomeDaVaga(j.atual.key)} aceita={j.atual.accepts && Object.keys(j.atual.accepts).length > 0 ? j.nomeDaVaga(j.atual.key) : posicao(j.atual.position)} opcoes={j.opcoes} estrita={false} foco={foco}
                temCarta={!!m.placed[j.atual.key]} podeDesfazer={m.mesa.podeDesfazer} onEscolher={j.escolher} onTirar={() => j.atual && j.tirar(j.atual.key)}
                onDesfazer={j.desfazer} onFechar={j.fechar} pegar={j.pegar} posicao={posicao} atributo={(a) => t(`flair3d.elencos.attr.${a}`)} aviso={j.aviso} />
            )}
          </div>
          <CbcPainel m={m} onDesfazer={j.desfazer} />
        </div>
      )}

      {d.communityOpen && d.community.length > 0 && (
        <section className="mt-6" aria-labelledby="cbc-community">
          <h2 id="cbc-community" className="type-h2 mb-3">{t("cbc.community")}</h2>
          <div className="grid gap-3 md:grid-cols-2">{d.community.map((s) => <SubmissionView key={s.id} s={s} scenario={d.scenario} slots={d.slots} compact />)}</div>
        </section>
      )}
      <section className="mt-6" aria-labelledby="cbc-memory">
        <h2 id="cbc-memory" className="type-h2 mb-2">{t("cbc.memory")}</h2>
        <p className="type-body">{t("cbc.memory_numbers", { builds: d.memory.builds, people: d.memory.people, avg: d.memory.averageSintonia ?? 0 })}</p>
        {d.memory.readings && d.memory.readings.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {d.memory.readings.map((r) => (
              <li key={r.key} className={cn("chip", r.rare && "is-rare")}>
                {r.key === OWN_READING ? t("cbc.reading_own") : r.label ?? r.key} · {r.pct}%{r.rare ? ` · ${t("cbc.reading_rare")}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <CbcRewardDialog open={m.rewardOpen} result={m.result} challenge={d} onClose={() => m.setRewardOpen(false)} text={storyText} />
    </>
  );
}
