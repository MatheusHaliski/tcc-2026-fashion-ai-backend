"use client";
/** Partes comuns da lista, da montagem e da entrega dos Desafios de Montagem: história, linha de pontos, entrega e recompensa. */
import Link from "next/link";
import { mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import type { CbcDetail, CbcPointsLine, CbcSlot, CbcStoryLine, CbcSubmission, CbcSubmitResult } from "@/lib/flair/cbc";
import { Badge, Button, cn, Dialog } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { FlairHubIcon } from "@/components/flair/hub-icons";
import { useCbcLabels } from "@/components/flair/use-cbc-labels";
import { MontagemFinal } from "@/components/flair/montagem/montagem-final";

export function Story({ lines, text }: { lines: CbcStoryLine[]; text: (l: CbcStoryLine) => string }) {
  const { t } = useI18n();
  return (
    <div className="cbc-story" aria-live="polite">
      <p className="label">{t("cbc.story")}</p>
      <ol>{lines.map((l, i) => { const s = text(l); return s ? <li key={i} className={cn(l.slot && "is-slot")}>{s}{l.sintonia != null && l.slot && <span className="cbc-story-sync" aria-label={t("cbc.slot.sintonia", { n: l.sintonia })}>{"●".repeat(l.sintonia)}{"○".repeat(Math.max(0, 3 - l.sintonia))}</span>}</li> : null; })}</ol>
    </div>
  );
}

export function PointsLine({ l }: { l: CbcPointsLine }) {
  const { t } = useI18n();
  const state = l.granted ? "credited" : l.capReached ? "cap" : "preview";
  return <li className={cn("cbc-line", `is-${state}`)}><span>{l.label || t(`cbc.line.${l.action}`)}</span><span className="cbc-line-state">{t(`cbc.state.${state}`)}</span><b className="tabular">+{l.points}</b></li>;
}

export function SubmissionView({ s, scenario, slots, compact }: { s: CbcSubmission; scenario: string; slots: CbcSlot[]; compact?: boolean }) {
  const { t, fmtDate } = useI18n(); const { slotLabel, storyText } = useCbcLabels();
  const bySlot = new Map(s.cards.map((c) => [c.slot, c]));
  return (
    <article className={cn("cbc-submission", compact && "is-compact")}>
      <div className="flex flex-wrap items-center gap-2">
        {s.user ? <b>@{s.user.username}</b> : <b>{t("cbc.you")}</b>}
        <span className="type-caption text-muted">{fmtDate(s.createdAt)} · {t("cbc.attempt", { n: s.attempt })}</span>
        <Badge tone="thread">{t("cbc.sintonia")} {s.sintonia}/{s.sintoniaMax}</Badge>
        {s.points != null && <Badge tone="chalk"><FaiIcon id="ACT-40" size={20} decorative /> +{s.points}</Badge>}
      </div>
      <ul className="cbc-snap">{slots.map((sl) => { const c = bySlot.get(sl.key); return (
        <li key={sl.key}><span className="type-caption text-muted">{slotLabel(scenario, sl)}</span>
          {c ? c.hidden ? <span className="cbc-snap-hidden">{t("cbc.hidden_card", { tier: t(`flairCard.tier.${c.tier}`) })}</span> : <span className={cn("cbc-snap-card", `tier-${c.tier.toLowerCase()}`)}>{c.imageUrl && <img src={mediaUrl(c.imageUrl)} alt="" loading="lazy" />}<b className="tabular">{c.ovr}</b><em>{c.name}</em></span> : <span className="text-faint">—</span>}
        </li>); })}</ul>
      {!compact && s.story.length > 0 && <Story lines={s.story} text={storyText} />}
    </article>
  );
}

/**
 * Modal de recompensa: abre uma vez por entrega, com a resposta do servidor. Cada linha mostra o estado real: creditada
 * (o servidor confirmou), teto diário (validada, mas sem crédito) ou prevista. Nada é anunciado como recebido antes
 * da confirmação. Ícone oficial de FAI Points; foco inicial no botão principal; Esc fecha.
 */
export function CbcRewardDialog({ open, result, challenge, onClose, text }: { open: boolean; result: CbcSubmitResult | null; challenge: CbcDetail; onClose: () => void; text: (l: CbcStoryLine) => string }) {
  const { t } = useI18n();
  if (!result) return null;
  const credited = result.points.lines.filter((l) => l.granted).reduce((a, l) => a + l.points, 0);
  const pending = result.points.lines.filter((l) => !l.granted && !l.capReached).reduce((a, l) => a + l.points, 0);
  return (
    <Dialog open={open} onClose={onClose} size="lg" title={t("cbc.reward.title")}
      footer={<><Link href="/flair/desafios" className="btn">{t("cbc.back_to_list")}</Link><Button variant="primary" onClick={onClose} data-autofocus>{t("cbc.reward.close")}</Button></>}>
      <div className="cbc-reward">
        <MontagemFinal cenario={challenge.scenario} nome={challenge.name} />
        <div className="cbc-reward-head">
          <FlairHubIcon id="cbc" size={28} state="selected" />
          <div><p className="type-label text-muted">{challenge.name}</p><p className="type-h2">{t("cbc.reward.sintonia", { n: result.evaluation.sintonia, max: result.evaluation.sintoniaMax })}</p></div>
        </div>
        <ul className="cbc-lines">{result.points.lines.map((l, i) => <PointsLine key={i} l={l} />)}</ul>
        <p className="cbc-total is-big"><FaiIcon id="ACT-40" size={32} decorative /><b className="tabular">+{credited}</b><span className="type-body-sm">{t("cbc.reward.credited")}</span>{pending > 0 && <span className="type-caption text-muted">{t("cbc.reward.pending", { n: pending })}</span>}</p>
        {result.group && <p className="type-body"><b>{result.group.name}</b> · {t("cbc.group_progress", { done: result.group.done, total: result.group.total })}{result.group.completed ? ` · ${t("cbc.done")}` : ""}</p>}
        {result.locked && <p className="type-caption text-muted">{t("cbc.reward.locked")}</p>}
        {result.story.length > 0 && <Story lines={result.story} text={text} />}
        <p className="type-caption text-muted">{t("cbc.reward.where")}</p>
      </div>
    </Dialog>
  );
}
