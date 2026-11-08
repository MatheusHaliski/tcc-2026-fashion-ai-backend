"use client";
import type { CSSProperties } from "react";
import { cn } from "@/components/ui";
import { PhotoSceneHit } from "@/components/flair/games/photo-scene-hit";
import { PhotoSceneLinks } from "@/components/flair/games/photo-scene-links";
import type { MatchScene } from "@/lib/flair/match-scene";
import type { MatchWinner } from "@/lib/flair/match-stage";

/**
 * A fotografia do palco do confronto com as inserções das cartas, reaproveitando a cena do FLAIR 3D: cada carta é
 * uma PhotoSceneHit (clarão → cone → a foto reacende → Aura Hype → efeito → legenda) dentro de um invólucro que diz o
 * papel dela na rodada — vencedora (inserção completa), perdedora (apagada, sem reacender a foto) ou empate (média).
 * As cartas do mesmo lado com sinergia na rodada se ligam por fios de luz (um conjunto de ligações por lado). A cena
 * acorda à medida que as rodadas entram; no fim, o lado vencedor recebe a luz dourada e o perdedor fica dessaturado.
 * Arte decorativa (aria-hidden): o anúncio das rodadas fica na região viva do palco.
 */
export function MatchStageArt({ photo, scene, progress, final, onPhotoError }: {
  photo: string; scene: MatchScene; progress: number; final: MatchWinner | null; onPhotoError?: () => void;
}) {
  const crowd = Math.max(0.35, Math.min(1, 1 / Math.sqrt(Math.max(1, scene.hits.length / 2))));
  const perfect = final === "A" || final === "B";
  const style = { "--gep-life": progress.toFixed(3), "--gep-crowd": crowd.toFixed(2) } as CSSProperties;
  return (
    <div className={cn("gep", "gms-scene", scene.hits.length > 0 && "is-awake", perfect && "is-perfect", final && `is-final win-${final.toLowerCase()}`)} style={style} aria-hidden>
      <img className="gep-photo" src={photo} alt="" decoding="async" onError={onPhotoError} />
      <span className="gep-grade" />
      <span className="gms-divide" />
      {(["A", "B"] as const).map((side) => {
        const hits = scene.hits.filter((h) => h.side === side);
        return (
          <PhotoSceneLinks key={side} pins={scene.pins[side]} results={hits.map((h) => h.result)} flair3d={hits.map((h) => h.flair3d)}
            filledKeys={new Set(hits.map((h) => h.key))} />
        );
      })}
      {scene.hits.map((h) => (
        <div key={`${h.key}:${h.card.id}`} className={cn("gms-hit", `is-${h.effect.role}`, `side-${h.side.toLowerCase()}`, h.moment.decisive && "is-decisive")}
          data-effect={h.effect.kind} style={{ "--x": `${h.anchor.x}%`, "--y": `${h.anchor.y}%`, "--s": `${h.anchor.size}%` } as CSSProperties}>
          <PhotoSceneHit photo={photo} x={h.anchor.x} y={h.anchor.y} size={h.anchor.size} fx={h.anchor.fx} card={h.card} label={h.card.name}
            result={h.result} flair3d={h.flair3d} latest={h.latest} />
        </div>
      ))}
      <span className="gep-vignette" />
      {final && <span className="gms-veil" />}
      {perfect && <span className="gep-flare" />}
    </div>
  );
}
