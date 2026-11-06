/**
 * Palco fotográfico do confronto: lê a configuração por modo (lib/flair/match-stages.json — foto real licenciada e seis
 * âncoras por lado, ancoradas em objetos da foto: lado A à esquerda, lado B à direita) e transforma os momentos revelados
 * em inserções da cena do FLAIR 3D (PhotoSceneHit): uma carta por lado e por momento, com Flair3dSlot (faixa real, faixa
 * de partida, efeito e texto) e CbcSlotResult (sintonia 3 vencedor / 1 empate / 0 perdedor; `neighbor` = o lado tem
 * sinergia na rodada, o que liga por luz as cartas vizinhas do mesmo lado). Puro: sem texto de interface.
 */
import STAGES from "@/lib/flair/match-stages.json";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import type { PhotoPin } from "@/components/flair/games/photo-scene";
import type { CbcSlotResult } from "@/lib/flair/cbc";
import { HYPE_BANDS, type GameSceneCredit, type Flair3dSlot, type SceneFx } from "@/lib/flair/games";
import { sideEffect, type AuraPermissions, type MatchCard, type MatchData, type MatchMoment, type MatchSide, type SideEffect } from "@/lib/flair/match-stage";
import { stageMode } from "@/lib/flair/match-modes";

export interface StageAnchor { x: number; y: number; fx: SceneFx; size: number; on?: string }
export interface MatchStageConfig { photo: string; credit?: GameSceneCredit | null; a: StageAnchor[]; b: StageAnchor[] }

const CONFIG = STAGES as unknown as Record<string, MatchStageConfig>;
/** Palco padrão quando o modo não tem foto própria (ou a foto não carregou): a passarela, senão o palco de show. */
export const FALLBACK_MODES = ["RUNWAY", "LEAGUE"];

export function photoUrl(id: string): string {
  return `/flair/games/scenes/${id}.webp`;
}

/** Configuração do palco do modo; `fallback` força o palco padrão (foto ausente). Nunca devolve o desenho 2D. */
export function stageConfig(mode: string, fallback = false): MatchStageConfig {
  const own = fallback ? undefined : CONFIG[stageMode(mode)];
  return own ?? FALLBACK_MODES.map((m) => CONFIG[m]).find(Boolean)!;
}

export interface SceneHit {
  key: string; side: MatchSide; moment: MatchMoment; anchor: StageAnchor; pin: PhotoPin; card: FlairCollectionCard;
  effect: SideEffect; flair3d: Flair3dSlot; result: CbcSlotResult; latest: boolean;
}
export interface MatchScene { hits: SceneHit[]; pins: Record<MatchSide, PhotoPin[]>; score: Record<MatchSide, number> }

/** A carta do momento no formato que a cena do FLAIR 3D desenha (só id, nome, nível e imagem importam ali). */
export function sceneCard(c: MatchCard): FlairCollectionCard {
  return {
    id: c.id, originType: "PIECE", originId: c.id, season: "", tier: c.tier, ovr: 0, rare: c.tier === "ESPECIAL", position: "", name: c.name,
    imageUrl: c.imageUrl, priceVerified: true, state: "MATCH", tradeable: false, acquiredVia: "MATCH",
  };
}

function hitOf(m: MatchMoment, side: MatchSide, cfg: MatchStageConfig, perms: AuraPermissions, latest: boolean): SceneHit | null {
  const card = side === "A" ? m.a : m.b;
  const effect = sideEffect(m, side, perms);
  const anchors = side === "A" ? cfg.a : cfg.b;
  if (!card || !effect || !anchors.length) return null;
  const anchor = anchors[m.index % anchors.length];
  const key = `${side}${m.index}`;
  const text = m.notes[0] || m.label;
  return {
    key, side, moment: m, anchor, latest, effect, card: sceneCard(card),
    pin: { key, n: m.index + 1, x: anchor.x, y: anchor.y, label: card.name, fx: anchor.fx, size: anchor.size },
    flair3d: {
      slot: key, cardId: card.id, hypeBand: HYPE_BANDS[effect.band], hypeBonus: 0, effect: { kind: effect.kind, bonus: 0, text },
      matchBand: HYPE_BANDS[effect.matchBand], matchDelta: effect.matchBand - effect.band,
    },
    result: { slot: key, position: "", cardId: card.id, positionOk: true, neighbor: m.meta[side], theme: m.notes.length > 0, sintonia: effect.sintonia },
  };
}

/** Inserções dos `shown` primeiros momentos e o placar ao vivo (rodadas ganhas até ali). */
export function buildScene(data: MatchData, shown: number, cfg: MatchStageConfig, perms: AuraPermissions): MatchScene {
  const visible = data.moments.slice(0, shown);
  const hits = visible.flatMap((m) => (["A", "B"] as MatchSide[]).map((s) => hitOf(m, s, cfg, perms, m.index === shown - 1)).filter((h): h is SceneHit => !!h));
  return {
    hits,
    pins: { A: hits.filter((h) => h.side === "A").map((h) => h.pin), B: hits.filter((h) => h.side === "B").map((h) => h.pin) },
    score: { A: visible.filter((m) => m.winner === "A").length, B: visible.filter((m) => m.winner === "B").length },
  };
}
