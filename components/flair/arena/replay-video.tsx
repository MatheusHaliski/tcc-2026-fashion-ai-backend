"use client";
import { useI18n } from "@/lib/i18n/i18n";
import { Button } from "@/components/ui";
import type { MatchData } from "@/lib/flair/match-stage";
import type { ReplayTexts } from "@/lib/flair/replay/draw";
import { useReplayRecorder } from "@/components/flair/arena/use-replay-recorder";

/**
 * Vídeo da partida: gera no navegador um replay curto (cenário do modo, cartas de roupa entrando, luz na vencedora,
 * placar e resultado), mostra no player e oferece o download para compartilhar. Sem suporte a gravação, não aparece.
 */
export function ReplayVideo({ data, scene, texts }: { data: MatchData; scene: string; texts: ReplayTexts }) {
  const { t } = useI18n();
  const { state, url, progress, record, supported } = useReplayRecorder(data, scene, texts);
  if (!supported) return null;
  return (
    <div className="arena-replay">
      {url ? (
        <>
          <video src={url} controls playsInline className="arena-replay-video" aria-label={t("flair.arena.video_aria")} />
          <div className="flex flex-wrap gap-2">
            <a className="btn btn-sm btn-primary" href={url} download={`flair-${data.mode.toLowerCase()}.webm`}>{t("flair.arena.baixar_video")}</a>
            <Button size="sm" onClick={record}>{t("flair.arena.gerar_de_novo")}</Button>
          </div>
        </>
      ) : (
        <Button size="sm" onClick={record} loading={state === "recording"} disabled={state === "recording"}>
          {state === "recording" ? t("flair.arena.gravando", { p: Math.round(progress * 100) }) : t("flair.arena.gerar_video")}
        </Button>
      )}
      {state === "error" && <p className="type-caption text-mark" role="alert">{t("flair.arena.video_erro")}</p>}
    </div>
  );
}
