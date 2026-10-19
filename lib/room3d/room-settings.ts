import { isCameraView, isSavedView, type CameraViewId, type SavedView, type WallMode } from "./camera-views";

/**
 * Configurações do Meu Quarto (aba Configurações, no lugar da antiga lista de posições): câmera e vistas, paredes,
 * ambiente, gráficos, interface e acessibilidade. São preferências deste aparelho (a tela, a GPU, o controle), então
 * ficam no navegador; a luz do quarto continua no servidor (PUT /api/me/room/light). Sem React.
 */
export type DayPeriod = "auto" | "morning" | "afternoon" | "golden" | "night";
export type GraphicsQuality = "auto" | "alta" | "leve";
export type MirrorQuality = "auto" | "alto" | "medio" | "desligado";
export type HudMode = "completo" | "minimo" | "oculto";
export type MotionPref = "sistema" | "reduzido" | "normal";

export const FAVORITE_SLOTS = 5;
export const FOV_RANGE = { min: 50, max: 90 } as const;
export const KELVINS = [2700, 4000, 6500] as const;

export interface RoomSettings {
  /** câmera: vista escolhida e, se houver, a vista salva em uso (1–5) */
  view: CameraViewId; favorite: number | null; favorites: (SavedView | null)[];
  /** lente (null = automática pela tela), sensibilidade 10–100 (50 = a de sempre), eixos, seguir o personagem, troca de vista */
  fov: number | null; sensitivity: number; invertX: boolean; invertY: boolean; follow: boolean; transition: "suave" | "corte";
  walls: WallMode;
  /** ambiente: hora do dia (auto = a do perfil/relógio) e temperatura da lâmpada do teto (null = a do quarto) */
  period: DayPeriod; kelvin: number | null;
  /** gráficos */
  quality: GraphicsQuality; mirror: MirrorQuality; dynamicRes: boolean;
  /** interface: o que fica por cima da cena e o aviso com o nome da vista ao trocar */
  hud: HudMode; viewName: boolean;
  /** acessibilidade: movimento (sistema/perfil, sempre reduzido ou normal) e conforto contra enjoo */
  motion: MotionPref; comfort: boolean;
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  view: "livre", favorite: null, favorites: Array.from({ length: FAVORITE_SLOTS }, () => null),
  fov: null, sensitivity: 50, invertX: false, invertY: false, follow: true, transition: "suave",
  walls: "recortadas", period: "auto", kelvin: null,
  quality: "auto", mirror: "auto", dynamicRes: true,
  hud: "completo", viewName: true,
  motion: "sistema", comfort: false,
};

const STORAGE_KEY = "fai.room.settings.v1";
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const clampInt = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) ? Math.round(Math.min(hi, Math.max(lo, v))) : null);

/** Lê o que veio do navegador (ou de uma versão antiga) sem confiar: campo inválido volta ao padrão. */
export function sanitizeRoomSettings(raw: unknown): RoomSettings {
  const d = DEFAULT_ROOM_SETTINGS, r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const favorites = Array.from({ length: FAVORITE_SLOTS }, (_, i) => { const f = Array.isArray(r.favorites) ? r.favorites[i] : null; return isSavedView(f) ? f : null; });
  const favorite = clampInt(r.favorite, 1, FAVORITE_SLOTS);
  return {
    view: isCameraView(r.view) ? r.view : d.view,
    favorite: favorite && favorites[favorite - 1] ? favorite : null, favorites,
    fov: r.fov === null ? null : clampInt(r.fov, FOV_RANGE.min, FOV_RANGE.max) ?? d.fov,
    sensitivity: clampInt(r.sensitivity, 10, 100) ?? d.sensitivity,
    invertX: bool(r.invertX, d.invertX), invertY: bool(r.invertY, d.invertY), follow: bool(r.follow, d.follow),
    transition: pick(r.transition, ["suave", "corte"] as const, d.transition),
    walls: pick(r.walls, ["inteiras", "recortadas", "baixas"] as const, d.walls),
    period: pick(r.period, ["auto", "morning", "afternoon", "golden", "night"] as const, d.period),
    kelvin: KELVINS.includes(r.kelvin as (typeof KELVINS)[number]) ? (r.kelvin as number) : null,
    quality: pick(r.quality, ["auto", "alta", "leve"] as const, d.quality),
    mirror: pick(r.mirror, ["auto", "alto", "medio", "desligado"] as const, d.mirror),
    dynamicRes: bool(r.dynamicRes, d.dynamicRes),
    hud: pick(r.hud, ["completo", "minimo", "oculto"] as const, d.hud), viewName: bool(r.viewName, d.viewName),
    motion: pick(r.motion, ["sistema", "reduzido", "normal"] as const, d.motion), comfort: bool(r.comfort, d.comfort),
  };
}

/** Preferências salvas neste navegador (aba anônima, armazenamento bloqueado: o padrão, sem quebrar a página). */
export function loadRoomSettings(storage: Pick<Storage, "getItem"> | null = safeStorage()): RoomSettings {
  try { const raw = storage?.getItem(STORAGE_KEY); return sanitizeRoomSettings(raw ? JSON.parse(raw) : null); } catch { return { ...DEFAULT_ROOM_SETTINGS }; }
}
export function saveRoomSettings(s: RoomSettings, storage: Pick<Storage, "setItem"> | null = safeStorage()): void {
  try { storage?.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* sem armazenamento: vale só nesta visita */ }
}
function safeStorage(): Storage | null { try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; } }

/** Movimento reduzido de fato: a escolha aqui vence; "sistema" segue o aparelho e o perfil. */
export const reducedMotionOf = (s: RoomSettings, system: boolean, profile: boolean) => s.motion === "reduzido" || (s.motion === "sistema" && (system || profile));

/** O que a câmera precisa saber (órbita e modo andar), já com o movimento reduzido e o conforto aplicados. */
export interface CameraOptions {
  view: CameraViewId; saved: SavedView | null; fov: number | null;
  /** multiplicador da velocidade do analógico (1 = a de sempre) */
  speed: number; invertX: boolean; invertY: boolean; follow: boolean;
  /** troca de vista por corte seco (sem o percurso) e câmera parada (a cinematográfica não gira) */
  cut: boolean; still: boolean;
}
export const DEFAULT_CAMERA_OPTIONS: CameraOptions = { view: "livre", saved: null, fov: null, speed: 1, invertX: false, invertY: false, follow: true, cut: false, still: false };

export function cameraOptionsOf(s: RoomSettings, reduced: boolean): CameraOptions {
  const saved = s.favorite ? s.favorites[s.favorite - 1] ?? null : null;
  // conforto contra enjoo: lente aberta (≥ 70°), corte seco, nada girando sozinho
  const fov = s.comfort ? Math.max(70, s.fov ?? 70) : s.fov;
  return { view: s.view, saved, fov, speed: s.sensitivity / 50, invertX: s.invertX, invertY: s.invertY, follow: s.follow,
    cut: s.transition === "corte" || reduced || s.comfort, still: reduced || s.comfort };
}

/** Densidade de pixels e sombras pela qualidade (automática: a de sempre — mais leve com o personagem andando). */
export function graphicsOf(q: GraphicsQuality, walking: boolean): { dpr: [number, number]; shadows: boolean; shadowMap: number } {
  if (q === "leve") return { dpr: [1, 1], shadows: false, shadowMap: 512 };
  if (q === "alta") return { dpr: [1, 2], shadows: true, shadowMap: 2048 };
  return { dpr: walking ? [1, 1.5] : [1, 2], shadows: true, shadowMap: walking ? 1024 : 2048 };
}

/** Resolução do reflexo do espelho (textura do Reflector); null = espelho sem reflexo ao vivo (a prévia 2D faz o papel). */
export function mirrorTextureOf(q: MirrorQuality, coarse: boolean): { width: number; height: number } | null {
  const level = q === "auto" ? (coarse ? "medio" : "alto") : q;
  if (level === "desligado") return null;
  return level === "alto" ? { width: 512, height: 1024 } : { width: 256, height: 512 };
}
