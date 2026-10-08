"use client";
import { useEffect, useState } from "react";
import { api, mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { Button, Spinner } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { SealSuggestionHype } from "@/components/hype/hype-seals";
import type { HypeLevel } from "@/lib/hype/types";

/** `hype`: HypeScore atual do look avaliado (RF53) — o backend já ordena as sugestões por Hype. */
export interface SealOption { targetOwnerId: string; kind: "BRAND" | "CELEBRITY"; name: string; logoUrl?: string | null; confidence: number; justification?: string; eraLabel?: string | null; hype?: { score: number | null; level: HypeLevel | null } | null }
export interface SealSearch { loading: boolean; list: SealOption[]; message?: string | null; unregisteredMessage?: string | null; failed?: boolean }

/**
 * Selos do look (RF21): a IA procura sozinha, a partir das peças, do estilo e da ocasião, as marcas e celebridades com
 * que o look pode ter selo. Enquanto procura, avisa; a pessoa marca as que quer pedir e o pedido segue ao salvar.
 */
export function SealSuggestions({ search, picked, onToggle, consent, onConsent, onRetry }: { search: SealSearch; picked: string[]; onToggle: (id: string) => void; consent: boolean; onConsent: (v: boolean) => void; onRetry: () => void }) {
  const { t, fmtNumber } = useI18n();
  const celebrityPicked = search.list.some((s) => s.kind === "CELEBRITY" && picked.includes(s.targetOwnerId));
  return (
    <div className="grid gap-2" aria-busy={search.loading}>
      {search.loading ? <p className="flex items-center gap-2 type-body-sm text-muted" role="status"><Spinner size={16} />{t("schemeBuilder.pesquisando_selos")}</p> : (
        <>
          {search.list.map((s) => {
            const on = picked.includes(s.targetOwnerId);
            return (
              <button key={s.targetOwnerId} type="button" role="checkbox" aria-checked={on} onClick={() => onToggle(s.targetOwnerId)} className={`list-row is-action flex items-center gap-3 text-left ${on ? "is-active" : ""}`}>
                <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border border-line-soft bg-surface">{s.logoUrl ? <img src={mediaUrl(s.logoUrl)} alt="" className="h-full w-full object-contain" /> : <FaiIcon id={s.kind === "CELEBRITY" ? "ACT-27" : "ACT-26"} size={20} decorative />}</span>
                <span className="min-w-0 flex-1"><span className="block type-body"><b>{s.name}</b> <span className="text-faint">· {s.kind === "CELEBRITY" ? t("schemeBuilder.selo_celebridade") : t("schemeBuilder.selo_marca")}{s.eraLabel ? ` · ${s.eraLabel}` : ""}</span></span>{s.justification && <span className="block type-caption text-muted">{s.justification}</span>}<SealSuggestionHype hype={s.hype} /></span>
                <span className="type-data text-muted">{fmtNumber(Math.round(s.confidence * 100))}%</span>
                <span aria-hidden className={`grid h-5 w-5 place-items-center rounded border ${on ? "border-ink bg-ink text-surface" : "border-line"}`}>{on ? "✓" : ""}</span>
              </button>
            );
          })}
          {!search.list.length && <p className="type-body-sm text-muted">{search.failed ? t("schemeBuilder.selos_indisponiveis") : search.message ?? t("schemeBuilder.nenhum_selo")}</p>}
          {search.unregisteredMessage && <p className="type-caption text-faint">{search.unregisteredMessage}</p>}
          {celebrityPicked && <label className="flex items-start gap-2 type-body-sm"><input type="checkbox" checked={consent} onChange={(e) => onConsent(e.target.checked)} className="mt-1" />{t("schemeBuilder.consentimento_imagem")}</label>}
        </>
      )}
      <Button size="sm" disabled={search.loading} onClick={onRetry}>{t("lookSeals.verify")}</Button>
      <p className="type-caption text-faint">{t("schemeBuilder.selos_vem_de_marca")}</p>
    </div>
  );
}


export interface SealRequest { targetOwnerId: string; imageRightsConsent?: boolean }
interface VerifiedBond { id: string; name: string; status: string }
interface Preview { suggestions: SealOption[]; message?: string; unregisteredMessage?: string; bonds?: VerifiedBond[] }

/** A changed composition invalidates its old choices, even when the details step is hidden. */
export function useLookSeals({ pieceIds, occasion, style, enabled, schemeId }: { pieceIds: string[]; occasion: string[]; style: string[]; enabled: boolean; schemeId?: string }) {
  const key = JSON.stringify([schemeId, [...pieceIds].sort(), [...occasion].sort(), [...style].sort()]);
  const [result, setResult] = useState<{ key: string; search: SealSearch; bonds: VerifiedBond[] } | null>(null);
  const [choice, setChoice] = useState<{ key: string; picked: string[]; consent: boolean }>({ key, picked: [], consent: false });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled || (!schemeId && !pieceIds.length)) return;
    const controller = new AbortController();
    setResult(null);
    const timer = setTimeout(async () => {
      try {
        const r = schemeId ? await api.get<Preview>(`/api/schemes/${schemeId}/seal-preview`, { signal: controller.signal })
          : await api.post<Preview>("/api/seal-suggestions/preview", { pieceIds, occasion, style }, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setResult({ key, search: { loading: false, list: r.suggestions ?? [], message: r.message, unregisteredMessage: r.unregisteredMessage }, bonds: r.bonds ?? [] });
        setChoice((c) => ({ key, consent: c.key === key && c.consent, picked: c.key === key ? c.picked.filter((id) => r.suggestions.some((s) => s.targetOwnerId === id)) : [] }));
      } catch {
        if (!controller.signal.aborted) { setResult({ key, search: { loading: false, list: [], failed: true }, bonds: [] }); setChoice({ key, picked: [], consent: false }); }
      }
    }, 250);
    return () => { controller.abort(); clearTimeout(timer); };
    // The key contains every request input; arrays can be rebuilt by the caller each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, attempt]);
  const search = result?.key === key ? result.search : { loading: enabled, list: [] };
  const picked = choice.key === key ? choice.picked : [];
  const consent = choice.key === key && choice.consent;
  const valid = !picked.some((id) => search.list.find((s) => s.targetOwnerId === id)?.kind === "CELEBRITY") || consent;
  const requests: SealRequest[] = search.loading || search.failed || !valid ? [] : search.list.filter((s) => picked.includes(s.targetOwnerId)).map((s) => ({ targetOwnerId: s.targetOwnerId, ...(s.kind === "CELEBRITY" ? { imageRightsConsent: consent } : {}) }));
  return { search, picked, consent, valid, requests, bonds: result?.key === key ? result.bonds : [],
    onToggle: (id: string) => setChoice({ key, consent, picked: picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id] }),
    onConsent: (value: boolean) => setChoice({ key, picked, consent: value }),
    onRetry: () => { setChoice({ key, picked: [], consent: false }); setResult(null); setAttempt((n) => n + 1); } };
}

/** RF13 checks each saved look separately, preserving the look's policy and current Hype. */
export function DnaLookSeals({ schemeId, title, onChange }: { schemeId: string; title: string; onChange: (id: string, requests: SealRequest[], valid: boolean) => void }) {
  const { t } = useI18n();
  const verification = useLookSeals({ schemeId, pieceIds: [], occasion: [], style: [], enabled: true });
  const requestKey = JSON.stringify(verification.requests);
  useEffect(() => { onChange(schemeId, verification.requests, verification.valid); }, [schemeId, requestKey, verification.valid, onChange]); // eslint-disable-line react-hooks/exhaustive-deps
  return <section className="surface p-3 grid gap-2" aria-label={title}>
    <h3 className="type-body font-semibold">{title}</h3>
    {verification.bonds.map((b) => <p key={b.id} className="type-body-sm">{b.name} · {t(`lookSeals.status.${b.status}`)}</p>)}
    <SealSuggestions {...verification} />
  </section>;
}
