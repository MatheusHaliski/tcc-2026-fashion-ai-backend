"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { lensApi } from "@/lib/lens/api";
import { createLookHref } from "@/lib/lens/model";
import type { LensMode, LensSlot, LensSlotKind } from "@/lib/lens/types";
import type { PieceView } from "@/lib/api/types";
import { PieceCard } from "@/components/piece-card";
import { Button, EmptyState, ErrorState, SegmentPicker, SkeletonGrid, cn, useToast } from "@/components/ui";
import { useLens } from "./lens-context";
import { LensGapCard, LensScoresRow } from "./lens-parts";

const MODES: LensMode[] = ["SAFE", "DISCOVERY", "EXPERIMENTAL"];

/** Opções de um slot: a peça escolhida pelo plano e as alternativas (sem repetir). */
const optionsOf = (s: LensSlot): PieceView[] => {
  const seen = new Set<string>();
  return [s.piece, ...s.alternatives].filter((p): p is PieceView => !!p && !seen.has(p.id) && !!seen.add(p.id));
};

/**
 * Um slot do plano (§8.4): peça sua, alternativa sua (outra subcategoria) ou lacuna. As setas trocam a alternativa;
 * Fixar prende o slot — trocar o modo refaz só os soltos.
 */
function SlotCard({ slot, index, onIndex, locked, onLock, useAlt, onUseAlt }: {
  slot: LensSlot; index: number; onIndex: (i: number) => void; locked: boolean; onLock: () => void; useAlt: boolean; onUseAlt: () => void;
}) {
  const { t } = useI18n(); const toast = useToast();
  const { scan, goTab, updateDetection } = useLens();
  const [wantBusy, setWantBusy] = useState(false);
  const options = slot.state === "gap" ? slot.alternatives : optionsOf(slot);
  const detection = scan.detections.find((d) => d.id === slot.detectionId) ?? null;
  const name = t(`lens.slot.${slot.slot}`);
  const showGap = slot.state === "gap" && (!useAlt || !options.length);
  const piece = showGap ? null : options[Math.min(index, options.length - 1)] ?? null;
  async function want() {
    if (!detection) return;
    setWantBusy(true);
    try { updateDetection(await lensApi.setWanted(scan.id, detection.id, !detection.wanted)); }
    catch (e) { toast.fromError(e); } finally { setWantBusy(false); }
  }
  const state = showGap ? "gap" : slot.state === "gap" || index > 0 ? "alternative" : slot.state;
  return (
    <section className={cn("lens-slot", `is-${state}`, locked && "is-locked")} aria-label={name}>
      <header className="lens-slot-head">
        <b>{name}</b>
        <span className={cn("badge", state === "own" ? "badge-thread" : state === "alternative" ? "badge-chalk" : "badge-mark")}>{t(`lens.slot_state.${state}`)}</span>
      </header>
      {showGap ? (
        detection
          ? <LensGapCard detection={detection} wantBusy={wantBusy} onWant={want} onDiscover={() => goTab("discover", detection.id)} onAlternative={options.length ? onUseAlt : undefined} />
          : <EmptyState title={t("lens.gap.title")} />
      ) : piece ? (
        <>
          <PieceCard piece={piece} flip={false} />
          <div className="lens-slot-tools">
            {options.length > 1 && (
              <span className="lens-slot-cycle" role="group" aria-label={t("lens.recreate.alternatives", { slot: name })}>
                <Button size="sm" variant="ghost" aria-label={t("lens.recreate.prev", { slot: name })} onClick={() => onIndex((index - 1 + options.length) % options.length)}>←</Button>
                <span className="type-caption tabular" aria-live="polite">{t("lens.recreate.option_of", { n: Math.min(index, options.length - 1) + 1, total: options.length })}</span>
                <Button size="sm" variant="ghost" aria-label={t("lens.recreate.next", { slot: name })} onClick={() => onIndex((index + 1) % options.length)}>→</Button>
              </span>
            )}
            <Button size="sm" aria-pressed={locked} onClick={onLock}>{locked ? t("lens.recreate.locked") : t("lens.recreate.lock")}</Button>
          </div>
        </>
      ) : null}
    </section>
  );
}

/**
 * Aba "Recriar" — como eu uso isto com o que tenho? Modo Seguro/Descoberta/Experimental (segmento, não filtro) →
 * POST /recreate. Os seis números do look ficam lado a lado (nunca somados). Salvar como look abre o criador com as
 * peças escolhidas; o Copilot recebe a pergunta pronta.
 */
export function LensRecreateTab() {
  const { t } = useI18n();
  const { scan, focusId, version } = useLens();
  const [mode, setMode] = useState<LensMode>("SAFE");
  const [locked, setLocked] = useState<Partial<Record<LensSlotKind, string>>>({});
  const [choice, setChoice] = useState<Partial<Record<LensSlotKind, number>>>({});
  const [alt, setAlt] = useState<Partial<Record<LensSlotKind, boolean>>>({});
  const lockedRef = useRef(locked); lockedRef.current = locked;
  const plan = useApi((signal) => { void signal; return lensApi.recreate(scan.id, { mode, focus: focusId, locked: lockedRef.current }); }, [scan.id, mode, focusId, version]);

  // plano novo: slots soltos voltam à primeira opção; os fixados ficam na peça presa
  useEffect(() => {
    if (!plan.data) return;
    const next: Partial<Record<LensSlotKind, number>> = {};
    plan.data.slots.forEach((s) => {
      const id = lockedRef.current[s.slot];
      const i = id ? (s.state === "gap" ? s.alternatives : optionsOf(s)).findIndex((p) => p.id === id) : -1;
      next[s.slot] = Math.max(0, i);
    });
    setChoice(next);
  }, [plan.data]);

  const selected = useMemo(() => {
    if (!plan.data) return [] as string[];
    return plan.data.slots.flatMap((s) => {
      const options = s.state === "gap" ? (alt[s.slot] ? s.alternatives : []) : optionsOf(s);
      const p = options[Math.min(choice[s.slot] ?? 0, options.length - 1)];
      return p ? [p.id] : [];
    });
  }, [plan.data, choice, alt]);
  const same = !!plan.data && selected.length === plan.data.pieceIds.length && selected.every((id) => plan.data!.pieceIds.includes(id));
  const createHref = plan.data ? (same && plan.data.createHref ? plan.data.createHref : createLookHref(selected)) : "";
  const focused = scan.detections.find((d) => d.id === focusId);
  const ask = focused ? t("lens.recreate.ask_piece", { label: focused.label }) : t("lens.recreate.ask_look");

  const toggleLock = (s: LensSlot) => setLocked((cur) => {
    const next = { ...cur };
    if (next[s.slot]) { delete next[s.slot]; return next; }
    const options = s.state === "gap" ? s.alternatives : optionsOf(s);
    const p = options[Math.min(choice[s.slot] ?? 0, options.length - 1)];
    if (p) next[s.slot] = p.id;
    return next;
  });

  return (
    <div className="lens-tab">
      <div className="lens-tab-tools">
        <SegmentPicker label={t("copilot.mode.label")} value={mode} onChange={setMode} options={MODES.map((m) => ({ id: m, label: t(`copilot.mode.${m}`) }))} />
        <span className="type-caption text-muted">{t(`copilot.mode.${mode}_hint`)}</span>
      </div>
      {plan.loading && !plan.data ? <><span className="sr-only">{t("lens.recreate.loading")}</span><SkeletonGrid n={4} /></>
        : plan.error ? <ErrorState error={plan.error} onRetry={plan.reload} />
        : plan.data ? (
          <div aria-busy={plan.loading || undefined}>
            {plan.data.slots.length ? (
              <div className="lens-slots">
                {plan.data.slots.map((s) => (
                  <SlotCard key={s.slot} slot={s} index={choice[s.slot] ?? 0} onIndex={(i) => setChoice((c) => ({ ...c, [s.slot]: i }))}
                    locked={!!locked[s.slot]} onLock={() => toggleLock(s)} useAlt={!!alt[s.slot]} onUseAlt={() => setAlt((a) => ({ ...a, [s.slot]: true }))} />
                ))}
              </div>
            ) : <EmptyState title={t("lens.recreate.empty")} />}
            <LensScoresRow scores={plan.data.scores} />
            <div className="lens-recreate-cta">
              {selected.length > 0 ? <Link href={createHref} className="btn btn-primary">{t("common.salvar_como_look")}</Link>
                : <Button variant="primary" disabled>{t("common.salvar_como_look")}</Button>}
              <Link href={`/copilot?ask=${encodeURIComponent(ask)}`} className="btn">{t("lens.recreate.ask_copilot")}</Link>
            </div>
          </div>
        ) : null}
    </div>
  );
}
