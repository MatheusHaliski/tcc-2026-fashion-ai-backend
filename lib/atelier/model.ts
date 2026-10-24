import { tr } from "../i18n/core";
/** FAI Atelier: recompensas de transformação e identidade (substitui "Minhas Fotos"). */
export type AuraEffect = "CONSTELLATION" | "CIRCUIT" | "HOLOGRAM" | "ENTRANCE_ANIMATION";
export type TrophyKind = "SHOWCASE" | "LAMP" | "MIRROR" | "TABLE";
export type DirectorPermission = "ROUND_CONDITIONS" | "CUSTOM_SCENE" | "OWN_CHALLENGE";

export interface GarmentChapter { id: string; kind: "MATCH" | "COLLAB" | "CHALLENGE"; title: string; date: string }
export interface AtelierRewardModel {
  /** Efeitos e animações desbloqueadas. */
  auraSignature: { unlocked: AuraEffect[] };
  /** Capítulos/histórico por peça (partidas, colabs, datas). */
  garmentMemory: { pieceId: string; pieceName: string; chapters: GarmentChapter[] }[];
  /** Objetos 3D desbloqueados para o Quarto; `equipped` marca o que está no quarto. */
  habitableTrofeus: { id: string; kind: TrophyKind; name: string; equipped: boolean }[];
  directorPower: { permissions: DirectorPermission[] };
  /** Fragmentos de instalações artísticas em equipe. */
  collectiveWork: { installationId: string; name: string; fragments: number; total: number }[];
  /** Convites para jornadas exclusivas de marcas/celebridades. */
  seasonPasses: { id: string; owner: string; title: string; expiresAt?: string }[];
}

export interface AtelierProgress { level: number; trophies: number; seasonProgress: number }
export interface AtelierProject { id: string; name: string; goals: { label: string; done: boolean }[]; reward: string }

export const EMPTY_ATELIER_REWARDS: AtelierRewardModel = {
  auraSignature: { unlocked: [] }, garmentMemory: [], habitableTrofeus: [], directorPower: { permissions: [] }, collectiveWork: [], seasonPasses: [],
};

export const REWARD_CATEGORIES = [
  { key: "auraSignature", get title() { return tr("atelier.category.auraSignature"); }, get how() { return tr("atelier.reward.auraSignature.how"); }, get effect() { return tr("atelier.reward.auraSignature.effect"); } },
  { key: "garmentMemory", get title() { return tr("atelier.category.garmentMemory"); }, get how() { return tr("atelier.reward.garmentMemory.how"); }, get effect() { return tr("atelier.reward.garmentMemory.effect"); } },
  { key: "habitableTrofeus", get title() { return tr("atelier.category.habitableTrofeus"); }, get how() { return tr("atelier.reward.habitableTrofeus.how"); }, get effect() { return tr("atelier.reward.habitableTrofeus.effect"); } },
  { key: "directorPower", get title() { return tr("atelier.category.directorPower"); }, get how() { return tr("atelier.reward.directorPower.how"); }, get effect() { return tr("atelier.reward.directorPower.effect"); } },
  { key: "collectiveWork", get title() { return tr("atelier.category.collectiveWork"); }, get how() { return tr("atelier.reward.collectiveWork.how"); }, get effect() { return tr("atelier.reward.collectiveWork.effect"); } },
  { key: "seasonPasses", get title() { return tr("atelier.category.seasonPasses"); }, get how() { return tr("atelier.reward.seasonPasses.how"); }, get effect() { return tr("atelier.reward.seasonPasses.effect"); } },
] as const;

export const SAMPLE_PROJECT: AtelierProject = {
  id: "espelho-constelacao", get name() { return tr("atelier.sampleProject.name"); }, get reward() { return tr("atelier.sampleProject.reward"); },
  goals: [{ get label() { return tr("atelier.sampleProject.goal1"); }, done: false }, { get label() { return tr("atelier.sampleProject.goal2"); }, done: false }, { get label() { return tr("atelier.sampleProject.goal3"); }, done: false }],
};

export function rewardCount(m: AtelierRewardModel) {
  return m.auraSignature.unlocked.length + m.garmentMemory.reduce((n, g) => n + g.chapters.length, 0) + m.habitableTrofeus.length
    + m.directorPower.permissions.length + m.collectiveWork.reduce((n, c) => n + c.fragments, 0) + m.seasonPasses.length;
}
export function projectProgress(p: AtelierProject) { return p.goals.length ? Math.round(100 * p.goals.filter((g) => g.done).length / p.goals.length) : 0; }
export function toggleTrophy(m: AtelierRewardModel, id: string): AtelierRewardModel {
  return { ...m, habitableTrofeus: m.habitableTrofeus.map((t) => t.id === id ? { ...t, equipped: !t.equipped } : t) };
}
