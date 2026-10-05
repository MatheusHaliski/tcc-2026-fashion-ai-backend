"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { lensApi } from "@/lib/lens/api";
import { orderDetections } from "@/lib/lens/model";
import type { LensDetectionView, LensMatchView, LensScope } from "@/lib/lens/types";
import { PieceCard } from "@/components/piece-card";
import { Button, Chip, EmptyState, ErrorState, SkeletonGrid, useToast } from "@/components/ui";
import { useLens, useLensReading } from "./lens-context";
import { LensGapCard, LensMatchBadge } from "./lens-parts";
import { LensCorrectButton } from "./lens-correct";

/** Correspondências de uma peça num escopo, sempre ordenadas só pela semelhança (nada patrocinado entra na lista). */
function useMatches(scanId: string, detectionId: string, scope: LensScope, version: number) {
  const r = useApi((signal) => lensApi.matches(scanId, { detection: detectionId, scope }, signal), [scanId, detectionId, scope, version]);
  const items: LensMatchView[] = [...(r.data?.items ?? [])].sort((a, b) => b.similarity - a.similarity);
  return { ...r, items };
}

/**
 * As correspondências de UMA peça: PieceCard + LensMatchBadge (slot `extra`). Sem correspondência no guarda-roupa:
 * "Sem correspondência no seu guarda-roupa" + a LACUNA — nunca "0%".
 */
function DetectionMatches({ detection, scope, limit, onlyAvailable, heading }: {
  detection: LensDetectionView; scope: LensScope; limit?: number; onlyAvailable?: boolean; heading?: string;
}) {
  const { t } = useI18n(); const toast = useToast();
  const { scan, version, goTab, setFocus, updateDetection } = useLens();
  const m = useMatches(scan.id, detection.id, scope, version);
  const [wantBusy, setWantBusy] = useState(false);
  const shown = m.items.filter((x) => !onlyAvailable || x.piece.disponivel);
  const list = limit ? shown.slice(0, limit) : shown;
  async function want() {
    setWantBusy(true);
    try { updateDetection(await lensApi.setWanted(scan.id, detection.id, !detection.wanted)); }
    catch (e) { toast.fromError(e); } finally { setWantBusy(false); }
  }
  const closet = scope === "MY_CLOSET";
  return (
    <section className="lens-matches" aria-label={heading ?? detection.label} aria-busy={m.loading || undefined}>
      {heading && <h3 className="lens-section-title">{heading}</h3>}
      {m.loading ? <><span className="sr-only">{t("lens.loading_matches")}</span><SkeletonGrid n={3} /></>
        : m.error ? <ErrorState error={m.error} onRetry={m.reload} />
        : list.length ? (
          <>
            <div className="grid-cards">
              {list.map((x) => <PieceCard key={x.targetId} piece={x.piece} extra={<LensMatchBadge match={x} />} />)}
            </div>
            {limit && shown.length > limit && <Button size="sm" className="mt-2" onClick={() => setFocus(detection.id)}>{t("lens.matches.see_all", { n: shown.length, label: detection.label })}</Button>}
          </>
        ) : closet ? (
          <div className="lens-nomatch">
            <EmptyState title={onlyAvailable && m.items.length ? t("lens.closet.none_available") : t("lens.closet.none")} hint={t("lens.closet.none_hint")} />
            <LensGapCard detection={detection} wantBusy={wantBusy} onWant={want} onDiscover={() => goTab("discover", detection.id)} />
          </div>
        ) : <EmptyState title={t("lens.discover.none")} hint={t("lens.discover.none_hint")} />}
    </section>
  );
}

/** Uma seção por peça (look inteiro) ou só a peça em foco. */
function PerDetection({ scope, onlyAvailable }: { scope: LensScope; onlyAvailable?: boolean }) {
  const { t } = useI18n();
  const { scan, focusId } = useLens();
  const list = orderDetections(scan.detections);
  const focused = list.find((d) => d.id === focusId);
  if (focused) return <DetectionMatches detection={focused} scope={scope} onlyAvailable={onlyAvailable} />;
  return <>{list.map((d, i) => <DetectionMatches key={d.id} detection={d} scope={scope} limit={4} onlyAvailable={onlyAvailable} heading={t("lens.matches.heading", { n: i + 1, label: d.label })} />)}</>;
}

/** Resumo closet-first ("Você já tem 2 peças parecidas"), a partir de reading.impact. */
function ImpactLine({ detectionId }: { detectionId: string | null }) {
  const { t } = useI18n();
  const { scan, version } = useLens();
  const reading = useLensReading(scan, detectionId, version);
  const impact = reading.data?.impact;
  if (!impact) return null;
  return (
    <p className="lens-impact" role="status">
      {impact.ownedMatches > 0 ? t("lens.impact.owned", { n: impact.ownedMatches }) : t("lens.impact.none")}
      {impact.redundancy > 0 && <span> · {t("lens.impact.redundancy", { n: impact.redundancy })}</span>}
      {impact.gaps > 0 && <span> · {t("lens.impact.gaps", { n: impact.gaps })}</span>}
    </p>
  );
}

/** Aba "Seu guarda-roupa" — eu já tenho? (closet-first) */
export function LensClosetTab() {
  const { t } = useI18n();
  const { scan, focusId } = useLens();
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const focused = scan.detections.find((d) => d.id === focusId) ?? null;
  return (
    <div className="lens-tab">
      <ImpactLine detectionId={focused?.id ?? null} />
      <div className="lens-tab-tools">
        <Chip active={onlyAvailable} onClick={() => setOnlyAvailable((v) => !v)}>{t("lens.closet.only_available")}</Chip>
        {focused && <span className="lens-tab-tools-end"><span className="type-caption text-muted">{t("lens.closet.wrong_reading")}</span><LensCorrectButton detection={focused} /></span>}
      </div>
      <PerDetection scope="MY_CLOSET" onlyAvailable={onlyAvailable} />
    </div>
  );
}

/** Aba "Descobrir" — onde encontro? Sempre depois do lembrete do que a pessoa já tem. */
export function LensDiscoverTab() {
  const { t } = useI18n();
  const { goTab, focusId } = useLens();
  return (
    <div className="lens-tab">
      <div className="lens-closet-first">
        <ImpactLine detectionId={focusId} />
        <Button size="sm" onClick={() => goTab("closet", focusId)}>{t("lens.discover.see_closet")}</Button>
      </div>
      <p className="type-caption text-muted">{t("lens.discover.order_note")}</p>
      <PerDetection scope="COMMUNITY" />
    </div>
  );
}
