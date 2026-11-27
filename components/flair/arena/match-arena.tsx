"use client";
import { useMemo } from "react";
import { mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { MatchStage } from "@/components/flair/match/match-stage";
import { ReplayVideo } from "@/components/flair/arena/replay-video";
import { ChallengeNetwork } from "@/components/flair/arena/challenge-network";
import type { MatchData } from "@/lib/flair/match-stage";
import { modeMeta, scenePhoto } from "@/lib/flair/modes/registry";
import { mvpMoment } from "@/lib/flair/modes/tactics";

/**
 * Arena do resultado, igual em todos os modos: o palco fotográfico do modo com as cartas de roupa entrando rodada a
 * rodada (efeito de cada carta no cenário, Aura Hype, placar ao vivo), a carta MVP da pessoa, o vídeo da partida para
 * baixar e o convite à rede FAI (revanche ou desafio de placar). `score` é a nota a superar nos modos contra a IA.
 */
export function MatchArena({ data, labelA, labelB, score }: { data: MatchData | null; labelA: string; labelB: string; score?: number | null }) {
  const { t } = useI18n();
  const mvp = useMemo(() => mvpMoment(data), [data]);
  if (!data || data.moments.length === 0) return null;
  const meta = modeMeta(data.mode);
  const finalText = data.winner === "DRAW" ? t("common.empate") : data.winner === "A" ? t("flair.arena.vitoria_de", { side: labelA }) : t("flair.arena.vitoria_de", { side: labelB });
  const texts = {
    title: t("flair.arena.video_titulo", { a: labelA, b: labelB }), labelA, labelB, finalText,
    theme: data.theme ? `${data.theme.emoji ?? ""} ${data.theme.label}`.trim() : null,
    round: (n: number, label: string) => label || t("flair.match.round", { n }),
  };
  return (
    <section className="arena" aria-label={t("flair.arena.titulo")}>
      <MatchStage data={data} labelA={labelA} labelB={labelB} />
      <div className="arena-side">
        {mvp?.a && (
          <div className="arena-mvp">
            {mvp.a.imageUrl && <img src={mediaUrl(mvp.a.imageUrl)} alt="" />}
            <div><p className="type-caption text-muted">{t("flair.arena.mvp")}</p><p className="type-body-sm font-semibold">{mvp.a.name}</p>
              <p className="type-caption">{mvp.label || t("flair.match.round", { n: mvp.index + 1 })} · {mvp.scoreA} × {mvp.scoreB}</p></div>
          </div>
        )}
        <ReplayVideo data={data} scene={scenePhoto(data.mode)} texts={texts} />
        <ChallengeNetwork mode={data.mode} target={meta.multi === "score" ? score ?? null : null} />
      </div>
    </section>
  );
}
