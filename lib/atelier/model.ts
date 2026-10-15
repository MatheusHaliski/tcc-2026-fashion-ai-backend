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
  { key: "auraSignature", title: "Assinatura de Aura", how: "Descobrir combinações em partidas", effect: "Efeitos para suas peças: constelações, circuitos, holografia e animações de entrada." },
  { key: "garmentMemory", title: "Memória da peça", how: "Reutilizar uma roupa em desafios diferentes", effect: "A carta ganha capítulos visuais: onde participou, combinações e colaborações." },
  { key: "habitableTrofeus", title: "Troféu habitável", how: "Completar uma temporada", effect: "Objeto funcional para o quarto: vitrine, luminária, espelho ou mesa." },
  { key: "directorPower", title: "Poder de direção", how: "Cumprir missões criativas", effect: "Escolher condições de uma rodada, personalizar um cenário ou organizar um desafio." },
  { key: "collectiveWork", title: "Obra coletiva", how: "Concluir desafios em equipe", effect: "Partes de uma instalação que se completa ao colaborar." },
  { key: "seasonPasses", title: "Convite de temporada", how: "Participar de uma jornada de marca ou celebridade", effect: "Cenários, histórias e desafios exclusivos daquele perfil." },
] as const;

export const SAMPLE_PROJECT: AtelierProject = {
  id: "espelho-constelacao", name: "Espelho Constelação FAI", reward: "O espelho aparece no seu quarto e reproduz as apresentações dos looks que você criou.",
  goals: [{ label: "Descubra três combinações cromáticas", done: false }, { label: "Reutilize uma peça em dois cenários", done: false }, { label: "Conclua um dueto", done: false }],
};

export function rewardCount(m: AtelierRewardModel) {
  return m.auraSignature.unlocked.length + m.garmentMemory.reduce((n, g) => n + g.chapters.length, 0) + m.habitableTrofeus.length
    + m.directorPower.permissions.length + m.collectiveWork.reduce((n, c) => n + c.fragments, 0) + m.seasonPasses.length;
}
export function projectProgress(p: AtelierProject) { return p.goals.length ? Math.round(100 * p.goals.filter((g) => g.done).length / p.goals.length) : 0; }
export function toggleTrophy(m: AtelierRewardModel, id: string): AtelierRewardModel {
  return { ...m, habitableTrofeus: m.habitableTrofeus.map((t) => t.id === id ? { ...t, equipped: !t.equipped } : t) };
}
