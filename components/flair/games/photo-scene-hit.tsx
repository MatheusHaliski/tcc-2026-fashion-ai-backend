"use client";
import type { CSSProperties } from "react";
import { mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { cn } from "@/components/ui";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import type { CbcSlotResult } from "@/lib/flair/cbc";
import { bandIndex, type Flair3dSlot, type SceneFx } from "@/lib/flair/games";
import { SceneFxLayers } from "@/components/flair/games/photo-scene-fx";
import { useGameLabels } from "@/components/flair/games/game-card";

/** Cor da luz pelo nível da carta (o metal da carta FLAIR). */
export const TIER_LIGHT: Record<string, string> = { BRONZE: "#f2b27a", PRATA: "#d9eeff", OURO: "#ffd76a", ESPECIAL: "#ff7ad9" };
/** Cor da Aura Hype pela faixa de partida: do sinal baixo (quase sem cor) ao viral (magenta). */
export const BAND_AURA = ["#9aa3ad", "#7fd1c7", "#6fb6ff", "#ffb347", "#ff6b6b", "#ff3df2"];

/**
 * Uma carta inserida no cenário fotográfico. A ordem conta a jogada: (1) clarão de entrada, (2) o cone de luz desce até a
 * vaga, (3) a foto reacende ali (cópia da foto com máscara radial e mais luz, na cor do nível da carta), (4) a Aura Hype
 * se forma com anéis, raios e partículas proporcionais à faixa de partida e uma seta quando a faixa sobe ou desce, e
 * (5) o efeito decidido pelo servidor transforma a cena: Metamorfose tinge a área com a cor do nível, passa um reflexo de
 * vidro e acende brilhos; Impersonation traz a peça em recorte com luz de contorno, sombra de contato e reflexo no
 * piso. A legenda na vaga diz o que aconteceu (efeito, bônus e Aura); a da última carta fica aberta.
 */
export function PhotoSceneHit({ photo, x, y, size, fx, card, label, result, flair3d, latest }: {
  photo: string; x: number; y: number; size: number; fx: SceneFx; card: FlairCollectionCard; label: string; result?: CbcSlotResult; flair3d?: Flair3dSlot; latest: boolean;
}) {
  const { t } = useI18n(); const L = useGameLabels();
  const kind = flair3d?.effect.kind ?? "COMUM";
  const real = flair3d ? bandIndex(flair3d.hypeBand) : -1;
  const match = flair3d ? bandIndex(flair3d.matchBand) : -1;
  const aura = Math.max(0, match);
  const sintonia = result?.sintonia ?? 0;
  const power = 0.6 + aura * 0.1 + sintonia * 0.07 + (kind === "COMUM" ? 0 : 0.15);
  const style = {
    "--x": `${x}%`, "--y": `${y}%`, "--s": `${size}%`, "--gep-light": TIER_LIGHT[card.tier] ?? TIER_LIGHT.PRATA, "--gep-aura": BAND_AURA[aura],
    "--gep-power": power.toFixed(2), "--gep-aura-rings": String(Math.min(3, Math.floor(aura / 2) + 1)), "--gep-rays": aura >= 4 ? "1" : "0",
  } as CSSProperties;
  const dir = match > real ? "up" : match < real ? "down" : "same";
  // erro do jogador: a luz do objeto falha em vermelho e o placar perde os pontos (Flair3dPenalties)
  const errors = flair3d?.penalties ?? [];
  const lost = errors.reduce((sum, e) => sum + e.points, 0);
  const piece = card.imageUrl ? mediaUrl(card.imageUrl) ?? card.imageUrl : null;
  return (
    <div className={cn("gep-hit", `fx-${fx}`, `is-${kind.toLowerCase()}`, `tier-${card.tier.toLowerCase()}`, `band-${aura}`, sintonia >= 2 && "is-tuned", latest && "is-latest", lost > 0 && "is-error")} style={style}>
      <span className="gep-flash" />
      <img className="gep-relight" src={photo} alt="" decoding="async" />
      {fx !== "spot" && <span className="gep-cone" />}
      <span className="gep-floor" />
      {flair3d && (
        <span className={cn("gep-aura", `is-${dir}`)}>
          <i className="gep-ring r1" /><i className="gep-ring r2" /><i className="gep-ring r3" />
          {aura >= 4 && <i className="gep-rays" />}
          {aura >= 3 && <span className="gep-motes">{Array.from({ length: 2 + aura * 2 }, (_, i) => <i key={i} style={{ "--i": i } as CSSProperties} />)}</span>}
        </span>
      )}
      <SceneFxLayers fx={fx} kind={kind} aura={aura} photo={photo} piece={piece} />
      {kind !== "COMUM" && <img className="gep-tint" src={photo} alt="" decoding="async" />}
      {kind !== "COMUM" && <span className="gep-sweep" />}
      {kind !== "COMUM" && <span className="gep-glints"><i /><i /><i /><i /><i /><i /></span>}
      <span className={cn("gep-callout", `is-${kind.toLowerCase()}`)}>
        <b className="gep-callout-slot">{label}</b>
        <span className="gep-callout-mini" title={L.effect(kind)}>{kind === "IMPERSONATION" ? "◉" : kind === "METAMORFOSE" ? "◆" : "●"}{flair3d && flair3d.effect.bonus > 0 ? ` +${flair3d.effect.bonus}` : ""}{flair3d && match > real ? " ↑" : flair3d && match < real ? " ↓" : ""}{lost > 0 ? ` −${lost}` : ""}</span>
        <span className="gep-callout-kind">{L.effect(kind)}{flair3d && flair3d.effect.bonus > 0 ? ` ${t("games.effects.bonus", { n: flair3d.effect.bonus })}` : ""}</span>
        {flair3d && (
          <span className={cn("gep-callout-aura", `is-${dir}`)}>
            {t("games.scene.aura")} · {L.band(flair3d.hypeBand)}{dir !== "same" ? ` ${dir === "up" ? "↑" : "↓"} ${L.band(flair3d.matchBand)}` : ""}{flair3d.hypeBonus > 0 ? ` ${t("games.effects.bonus", { n: flair3d.hypeBonus })}` : ""}
          </span>
        )}
        {lost > 0 && <span className="gep-callout-error">{errors.map((e) => t(`games.penalty.${e.code}`, { n: e.points })).join(" · ")}</span>}
        {latest && flair3d?.effect.text && <span className="gep-callout-text">{flair3d.effect.text}</span>}
      </span>
    </div>
  );
}
