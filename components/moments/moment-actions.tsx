"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import type { CandidateLook, MatchExplanation, MomentApproach, MomentChallenge, MomentDetail, MomentMatchResult, MomentScores, PointsLine } from "@/lib/moments/types";
import { Button, Chip, Dialog, Skeleton, cn, useToast } from "@/components/ui";
import { MomentMatchBreakdown, MomentScoreGrid } from "./moment-scores";

/** "Como quer participar?" (§58): meu estilo / descoberta / experimental + "somente meu guarda-roupa". */
export function JoinDialog({ moment, open, onClose, onJoined }: { moment: MomentDetail; open: boolean; onClose: () => void; onJoined: () => void }) {
  const { t } = useI18n(); const toast = useToast();
  const [approach, setApproach] = useState<MomentApproach>(moment.me?.approach ?? "MY_STYLE");
  const [wardrobeOnly, setWardrobeOnly] = useState<boolean>(moment.me?.wardrobeOnly ?? true);
  const [busy, setBusy] = useState(false);
  const wardrobeBonus = moment.bonusRules?.wardrobe ?? 25;
  async function join() {
    setBusy(true);
    try { const r = await api.post<{ message?: string }>(`/api/moments/${encodeURIComponent(moment.slug)}/join`, { approach, wardrobeOnly }); toast.success(r.message ?? t("moments.join.done")); onJoined(); onClose(); } catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  const approaches: { id: MomentApproach; title: string; hint: string }[] = [
    { id: "MY_STYLE", title: t("moments.join.my_style"), hint: t("moments.join.my_style_hint") },
    { id: "DISCOVERY", title: t("moments.join.discovery"), hint: t("moments.join.discovery_hint") },
    { id: "EXPERIMENTAL", title: t("moments.join.experimental"), hint: t("moments.join.experimental_hint") },
  ];
  return (
    <Dialog open={open} onClose={onClose} title={t("moments.join.title", { name: moment.name })} footer={<><Button onClick={onClose}>{t("common.cancel")}</Button><Button variant="primary" onClick={join} loading={busy}>{t("moments.cta.join")}</Button></>}>
      <p className="label">{t("moments.join.how")}</p>
      <div className="grid gap-2 mb-4" role="radiogroup" aria-label={t("moments.join.how")}>
        {approaches.map((a) => <button key={a.id} type="button" role="radio" aria-checked={approach === a.id} className={cn("moment-option", approach === a.id && "is-active")} onClick={() => setApproach(a.id)}><b>{a.title}</b><span className="type-caption text-muted block">{a.hint}</span></button>)}
      </div>
      {moment.pointsEnabled && <>
        <p className="label">{t("moments.join.use")}</p>
        <div className="grid gap-2" role="radiogroup" aria-label={t("moments.join.use")}>
          <button type="button" role="radio" aria-checked={wardrobeOnly} className={cn("moment-option", wardrobeOnly && "is-active")} onClick={() => setWardrobeOnly(true)}><b>{t("moments.join.wardrobe_only", { pts: wardrobeBonus })}</b><span className="type-caption text-muted block">{t("moments.join.wardrobe_only_hint")}</span></button>
          <button type="button" role="radio" aria-checked={!wardrobeOnly} className={cn("moment-option", !wardrobeOnly && "is-active")} onClick={() => setWardrobeOnly(false)}><b>{t("moments.join.wardrobe_plus")}</b><span className="type-caption text-muted block">{t("moments.join.wardrobe_plus_hint")}</span></button>
        </div>
      </>}
      {moment.sensitive && <p className="type-caption text-muted mt-3">{t("moments.sensitive_note")}</p>}
    </Dialog>
  );
}

interface Preview { match?: MomentMatchResult | null; scores?: MomentScores; points: PointsLine[]; pointsTotal: number; explanation: MatchExplanation[]; alreadySubmitted: boolean; wardrobeOnly: boolean; rediscovered: string[]; newStyles: string[] }

/** Enviar look (§58): escolhe o look (e um desafio), vê MomentMatch + FAI Points previstos e envia. */
export function SubmitDialog({ moment, open, onClose, onSubmitted }: { moment: MomentDetail; open: boolean; onClose: () => void; onSubmitted: () => void }) {
  const { t } = useI18n(); const toast = useToast();
  const [looks, setLooks] = useState<CandidateLook[] | null>(null);
  const [schemeId, setSchemeId] = useState(""); const [challengeId, setChallengeId] = useState<string>("");
  const [preview, setPreview] = useState<Preview | null>(null); const [busy, setBusy] = useState<"preview" | "submit" | null>(null);
  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    api.get<CandidateLook[]>(`/api/moments/${encodeURIComponent(moment.slug)}/looks`, { signal: ctrl.signal }).then(setLooks).catch(() => setLooks([]));
    return () => ctrl.abort();
  }, [open, moment.slug]);
  useEffect(() => { setPreview(null); }, [schemeId, challengeId]);
  async function doPreview() {
    if (!schemeId) return;
    setBusy("preview");
    try { setPreview(await api.post<Preview>(`/api/moments/${encodeURIComponent(moment.slug)}/preview`, { schemeId, challengeId: challengeId || null })); } catch (e) { toast.fromError(e); } finally { setBusy(null); }
  }
  async function submit() {
    setBusy("submit");
    try { const r = await api.post<{ message?: string; completed?: boolean; badge?: string | null; pointsTotal?: number }>(`/api/moments/${encodeURIComponent(moment.slug)}/submit`, { schemeId, challengeId: challengeId || null }); toast.success(r.message ?? t("moments.submit.done")); onSubmitted(); onClose(); } catch (e) { toast.fromError(e); } finally { setBusy(null); }
  }
  const challenges: MomentChallenge[] = moment.challenges ?? [];
  return (
    <Dialog open={open} onClose={onClose} title={t("moments.submit.title", { name: moment.name })} size="lg" footer={<><Button onClick={onClose}>{t("common.cancel")}</Button>{preview ? <Button variant="primary" onClick={submit} loading={busy === "submit"} disabled={preview.alreadySubmitted}>{t("moments.submit.send")}</Button> : <Button variant="primary" onClick={doPreview} loading={busy === "preview"} disabled={!schemeId}>{t("moments.submit.preview")}</Button>}</>}>
      <p className="label">{t("moments.submit.pick_look")}</p>
      {looks === null ? <Skeleton className="h-24" /> : looks.length === 0 ? <p className="type-body-sm text-muted">{t("moments.submit.no_looks")}</p> : (
        <div className="moment-look-picker" role="radiogroup" aria-label={t("moments.submit.pick_look")}>
          {looks.map((l) => <button key={l.id} type="button" role="radio" aria-checked={schemeId === l.id} disabled={l.sent} className={cn("moment-look-tile", schemeId === l.id && "is-active", l.sent && "is-sent")} onClick={() => setSchemeId(l.id)} title={l.sent ? t("moments.submit.already_sent") : l.title}>
            <span className="moment-look-thumb">{l.coverImageUrl ? <img src={l.coverImageUrl} alt="" /> : null}</span><span className="type-caption truncate">{l.title}</span>{l.sent && <span className="badge">{t("moments.submit.sent")}</span>}
          </button>)}
        </div>
      )}
      {challenges.length > 0 && <>
        <p className="label mt-3">{t("moments.submit.pick_challenge")}</p>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("moments.submit.pick_challenge")}>
          <Chip role="radio" aria-checked={challengeId === ""} active={challengeId === ""} onClick={() => setChallengeId("")}>{t("moments.submit.no_challenge")}</Chip>
          {challenges.map((c) => <Chip key={c.id} role="radio" aria-checked={challengeId === c.id} active={challengeId === c.id} onClick={() => setChallengeId(c.id)} title={c.description ?? undefined}>{c.name} · +{c.points}</Chip>)}
        </div>
        <p className="type-caption text-muted mt-1">{t("moments.submit.challenge_hint")}</p>
      </>}
      {preview && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div><MomentMatchBreakdown match={preview.match} explanation={preview.explanation} /><MomentScoreGrid scores={preview.scores} /></div>
          <div>
            <p className="label">{t("moments.submit.points_preview")}</p>
            {preview.points.length === 0 ? <p className="type-body-sm text-muted">{moment.pointsEnabled ? t("moments.submit.no_points_yet") : t("moments.submit.points_off")}</p> : <ul className="fai-list">{preview.points.map((p) => <li key={p.action + p.ref} className="flex justify-between py-1 type-body-sm"><span>{p.label.startsWith("challenge:") ? t("moments.submit.challenge_line", { code: p.label.slice(10) }) : t(`moments.points_line.${p.label}`)}</span><b className="tabular">+{p.points}</b></li>)}</ul>}
            <p className="type-h3 mt-2 tabular">{t("moments.submit.points_total", { n: preview.pointsTotal })}</p>
            {preview.wardrobeOnly && <p className="type-caption text-thread">{t("moments.submit.wardrobe_only_ok")}</p>}
            {preview.rediscovered.length > 0 && <p className="type-caption text-thread">{t("moments.submit.rediscovered", { n: preview.rediscovered.length })}</p>}
            {preview.alreadySubmitted && <p className="type-caption text-mark">{t("moments.submit.already_sent")}</p>}
          </div>
        </div>
      )}
    </Dialog>
  );
}
