"use client";
/**
 * Painel lateral da montagem de um Desafio de Montagem: a leitura do tema, os requisitos (do /check), a sintonia, a
 * prévia de pontos e as ações (entregar, desfazer, limpar). Tudo o que aparece como cumprido veio do servidor.
 */
import { useI18n } from "@/lib/i18n/i18n";
import { OWN_READING, type CbcRequirementResult } from "@/lib/flair/cbc";
import { Button, Chip, cn } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { PointsLine } from "@/components/flair/cbc-partes";
import { useCbcLabels } from "@/components/flair/use-cbc-labels";
import type { CbcMesa } from "@/components/flair/use-cbc-mesa";

export function CbcPainel({ m, onDesfazer }: { m: CbcMesa; onDesfazer: () => void }) {
  const { t } = useI18n();
  const { requirement } = useCbcLabels();
  const d = m.d;
  if (!d) return null;
  const ev = m.check?.evaluation;
  const canSubmit = !m.readOnly && d.status === "OPEN" && m.fresca && !!ev?.ok && ev.complete && (m.check?.canSubmit ?? true) && !m.submitting;
  const requisitos = ev?.requirements ?? d.requirements.map((r) => ({ ...r, ok: false, have: 0, need: 0, args: r }) as CbcRequirementResult);
  const linhas = m.check?.points.lines ?? [{ action: "FLAIR_CBC", points: d.pointsPreview, ref: d.id, label: t("cbc.line.FLAIR_CBC") }];
  return (
    <aside className="cbc-play-side" aria-label={t("cbc.side_label")}>
      {d.interpretations.length > 0 && (
        <div className="cbc-block">
          <p className="label">{t("cbc.reading")}</p>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("cbc.reading")}>
            {d.interpretations.map((i) => (
              <Chip key={i.key} role="radio" aria-checked={m.interpretation === i.key} active={m.interpretation === i.key} onClick={() => m.setReading(i.key)}>
                {i.label ?? i.key}
              </Chip>
            ))}
            <Chip role="radio" aria-checked={m.interpretation === OWN_READING} active={m.interpretation === OWN_READING} onClick={() => m.setReading(OWN_READING)}>
              {t("cbc.reading_own")}
            </Chip>
          </div>
        </div>
      )}
      <div className="cbc-block">
        <div className="flex items-center justify-between gap-2">
          <p className="label">{t("cbc.requirements")}</p>
          {m.checking && <span className="type-caption text-muted" aria-live="polite">{t("cbc.checking")}</span>}
        </div>
        <ul className="cbc-reqs">
          <li className={cn(ev && ev.complete && "is-ok")}>
            <span className="cbc-req-mark" aria-hidden>{ev?.complete ? "✓" : "○"}</span>
            <span>{t("cbc.req.fill_all", { n: d.slots.length })}</span>
            <b className="tabular">{m.filled}/{d.slots.length}</b>
          </li>
          {requisitos.map((r, i) => (
            <li key={i} className={cn(r.ok && "is-ok")}>
              <span className="cbc-req-mark" aria-hidden>{r.ok ? "✓" : "○"}</span>
              <span>{requirement(r)}</span>
              {ev && <b className="tabular">{r.have}/{r.need}</b>}
              <span className="sr-only">{r.ok ? t("flair.cumprido") : t("flair.faltando")}</span>
            </li>
          ))}
          {d.requirements.length === 0 && (
            <li className="is-ok">
              <span className="cbc-req-mark" aria-hidden>✓</span>
              <span>{t("cbc.any_level")}</span>
            </li>
          )}
        </ul>
      </div>
      <div className="cbc-block">
        <p className="label">{t("cbc.sintonia")}</p>
        <div className="cbc-sync">
          <div className="hype-bar"><i style={{ width: `${ev && ev.sintoniaMax ? (ev.sintonia / ev.sintoniaMax) * 100 : 0}%`, background: "var(--thread)" }} /></div>
          <b className="tabular">{ev ? `${ev.sintonia}/${ev.sintoniaMax}` : `0/${d.slots.length * 3}`}</b>
        </div>
        <p className="type-caption text-muted">{t("cbc.sintonia_hint")}</p>
      </div>
      <div className="cbc-block">
        <p className="label">{t("cbc.points_preview")}</p>
        <ul className="cbc-lines">{linhas.map((l, i) => <PointsLine key={i} l={l} />)}</ul>
        <p className="cbc-total">
          <FaiIcon id="ACT-40" size={24} decorative />
          <b className="tabular">+{m.check?.points.total ?? d.pointsPreview}</b>
          <span className="type-caption text-muted">{t("cbc.points_after_confirm")}</span>
        </p>
        {d.locksCards && <p className="type-caption text-muted">{t("cbc.locks_note")}</p>}
        {d.mine && d.repeatLimit > 1 && <p className="type-caption text-muted tabular">{t("cbc.attempts_left", { n: d.mine.attemptsLeft })}</p>}
      </div>
      <div className="cbc-actions">
        <Button variant="primary" size="lg" disabled={!canSubmit} loading={m.submitting} onClick={m.submit}>
          {d.status === "UPCOMING" ? t("cbc.submit_when_open") : t("cbc.submit")}
        </Button>
        <Button size="lg" disabled={!m.mesa.podeDesfazer} onClick={onDesfazer}>{t("flair.mesa.undo")}</Button>
        <Button size="lg" disabled={m.filled === 0} onClick={m.mesa.limpar}>{t("cbc.clear")}</Button>
      </div>
    </aside>
  );
}
