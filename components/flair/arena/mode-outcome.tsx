"use client";
import { useMemo } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { ResultView, type ModeLook, type ModeResult } from "@/components/flair/modes-shared";
import { MatchArena } from "@/components/flair/arena/match-arena";
import { fromModeResult } from "@/lib/flair/match-stage";

/**
 * Resultado de um modo de look: primeiro a arena (palco, cartas no cenário, vídeo e convite), depois o detalhe das
 * rodadas com os pesos de cada atributo (ResultView, o mesmo de antes). `myLook` entra quando o servidor não devolve o look.
 */
export function ModeOutcome({ result, myLook, labelA, labelB }: { result: ModeResult | null; myLook?: ModeLook | null; labelA?: string; labelB?: string }) {
  const { t } = useI18n();
  const data = useMemo(() => (result ? fromModeResult(result, myLook ?? null) : null), [result, myLook]);
  if (!result) return null;
  const a = labelA ?? t("flair.voce");
  const b = labelB ?? result.opponent?.label ?? t("flair.modesShared.oponente");
  return (
    <div className="grid gap-3">
      <MatchArena data={data} labelA={a} labelB={b} score={result.scoreA} />
      <ResultView result={result} labelA={labelA} labelB={labelB} />
    </div>
  );
}
