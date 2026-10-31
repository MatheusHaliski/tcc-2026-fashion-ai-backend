/*
 * MET Gala Heist v2 — preferências da pessoa (guardadas neste navegador): câmera (sensibilidade, eixo invertido, campo de
 * visão, ombro, distância, tremida), jogo (assistência de mira, alternar/segurar, lasers mais lentos), áudio (música,
 * efeitos, vozes sintetizadas), interface (escala, HUD mínimo, legendas: tamanho e fundo, reduzir clarões), vídeo
 * (qualidade, FPS) e o
 * remapeamento de todos os comandos do teclado e do controle (MH-04-09, MH-13-10, MH-14-14/16, MH-15-10, MH-17).
 */
import { PAD } from "@/lib/input/gamepad";

export type KeyAction = "forward" | "back" | "left" | "right" | "sprint" | "crouch" | "discreet" | "interact" | "dodge" | "reload" | "melee" | "heal" | "throw" | "wheel" | "map" | "pause" | "weapon1" | "weapon2" | "weapon3" | "skip" | "shoulder";
export type PadAction = "interact" | "crouch" | "dodge" | "melee" | "throw" | "wheel" | "discreet" | "aim" | "fire" | "sprint" | "heal" | "map" | "pause" | "weaponNext" | "weaponPrev" | "shoulder";

export const DEFAULT_KEYS: Record<KeyAction, string[]> = {
  forward: ["KeyW", "ArrowUp"], back: ["KeyS", "ArrowDown"], left: ["KeyA", "ArrowLeft"], right: ["KeyD", "ArrowRight"],
  sprint: ["ShiftLeft", "ShiftRight"], crouch: ["KeyC", "ControlLeft"], discreet: ["KeyQ"], interact: ["KeyE"], dodge: ["Space"],
  reload: ["KeyR"], melee: ["KeyF"], heal: ["KeyH"], throw: ["KeyG"], wheel: ["Tab"], map: ["KeyM"], pause: ["Escape", "KeyP"],
  weapon1: ["Digit1"], weapon2: ["Digit2"], weapon3: ["Digit3"], skip: ["Enter"], shoulder: ["KeyX"],
};
/** Controle de PS5 no mapeamento padrão: ✕ interage, ○ esquiva, □ golpe (recarrega mirando), △ garrafa, R3 agacha. */
export const DEFAULT_PAD: Record<PadAction, number> = {
  interact: PAD.cross, dodge: PAD.circle, melee: PAD.square, throw: PAD.triangle, crouch: PAD.r3, wheel: PAD.l1, discreet: PAD.r1,
  aim: PAD.l2, fire: PAD.r2, sprint: PAD.l3, heal: PAD.up, map: PAD.share, pause: PAD.options, weaponNext: PAD.right, weaponPrev: PAD.left, shoulder: PAD.down,
};
export const PAD_GLYPH: Record<number, string> = { 0: "✕", 1: "○", 2: "□", 3: "△", 4: "L1", 5: "R1", 6: "L2", 7: "R2", 8: "Create", 9: "Options", 10: "L3", 11: "R3", 12: "↑", 13: "↓", 14: "←", 15: "→" };

export interface HeistSettings {
  sensitivity: number; invertY: boolean; vibration: boolean; fov: number; shoulder: "right" | "left"; camDistance: number; shake: boolean;
  aimAssist: boolean; toggleCrouch: boolean; toggleDiscreet: boolean; toggleAim: boolean; slowLasers: boolean; regen: boolean; beats: boolean;
  music: number; sfx: number; voices: boolean; voiceVolume: number;
  subtitleSize: "s" | "m" | "l" | "xl"; subtitleBg: number; uiScale: number; minimalHud: boolean; reduceFlashes: boolean;
  quality: "high" | "low"; showFps: boolean;
  keys: Record<KeyAction, string[]>; pad: Record<PadAction, number>;
}
export const DEFAULT_SETTINGS: HeistSettings = {
  sensitivity: 1, invertY: false, vibration: true, fov: 62, shoulder: "right", camDistance: 1, shake: true,
  aimAssist: false, toggleCrouch: true, toggleDiscreet: false, toggleAim: false, slowLasers: false, regen: false, beats: true,
  music: 0.5, sfx: 0.8, voices: false, voiceVolume: 0.8,
  subtitleSize: "m", subtitleBg: 0.6, uiScale: 1, minimalHud: false, reduceFlashes: false,
  quality: "high", showFps: false,
  keys: DEFAULT_KEYS, pad: DEFAULT_PAD,
};

const STORE = "fai-heist-v2-settings";
export function loadSettings(): HeistSettings {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORE) : null;
    // primeira vez: quem pediu menos movimento ao sistema já começa com os clarões reduzidos
    if (!raw) return { ...DEFAULT_SETTINGS, reduceFlashes: typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches };
    const v = JSON.parse(raw) as Partial<HeistSettings>;
    return { ...DEFAULT_SETTINGS, ...v, keys: { ...DEFAULT_KEYS, ...(v.keys ?? {}) }, pad: { ...DEFAULT_PAD, ...(v.pad ?? {}) } };
  } catch { return { ...DEFAULT_SETTINGS }; }
}
export function saveSettings(s: HeistSettings) { try { localStorage.setItem(STORE, JSON.stringify(s)); } catch { /* armazenamento bloqueado: vale só nesta sessão */ } }

/** Nome legível de uma tecla (KeyW → W, ArrowUp → ↑, ShiftLeft → Shift). */
export function keyName(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  const map: Record<string, string> = { ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", ShiftLeft: "Shift", ShiftRight: "Shift", ControlLeft: "Ctrl", ControlRight: "Ctrl", Space: "Space", Escape: "Esc", Enter: "Enter", Tab: "Tab", AltLeft: "Alt", Backquote: "`" };
  return map[code] ?? code.replace(/^Numpad/, "Num ");
}

/**
 * Rótulo do comando no aparelho em uso, já com o remapeamento: tecla (W, Shift, Espaço…) ou botão do controle de PS5
 * (✕ ○ □ △, L1…). Mira e tiro no teclado são os botões do mouse; recarregar no controle é □ mirando; pular cena é ✕.
 */
export function bindLabel(st: HeistSettings, action: KeyAction | PadAction | "aim" | "fire", pad: boolean, t: (k: string) => string): string {
  if (pad) {
    if (action === "reload") return `${PAD_GLYPH[st.pad.aim]} + ${PAD_GLYPH[st.pad.melee]}`;
    if (action === "skip") return PAD_GLYPH[st.pad.interact];
    const b = st.pad[action as PadAction];
    if (b !== undefined) return PAD_GLYPH[b] ?? `#${b}`;
    if (action === "forward" || action === "back" || action === "left" || action === "right") return t("heist.key.leftStick");
    if (action === "weapon1" || action === "weapon2" || action === "weapon3") return `${PAD_GLYPH[st.pad.weaponPrev]} ${PAD_GLYPH[st.pad.weaponNext]}`;
    return "";
  }
  if (action === "aim") return t("heist.key.mouseRight");
  if (action === "fire") return t("heist.key.mouseLeft");
  const code = st.keys[action as KeyAction]?.[0];
  if (!code) return t("heist.key.none");
  return code === "Space" ? t("heist.key.space") : keyName(code);
}

/* ---------- partida salva neste navegador (o checkpoint mais recente) ---------- */
const SAVE = "fai-heist-v2-save";
export interface SavedRun { version: number; savedAt: number; checkpoint: string; deck: string[]; snap: unknown }
export function loadSave(version: number): SavedRun | null {
  try { const raw = localStorage.getItem(SAVE); if (!raw) return null; const v = JSON.parse(raw) as SavedRun; return v.version === version ? v : null; } catch { return null; }
}
export function writeSave(run: SavedRun) { try { localStorage.setItem(SAVE, JSON.stringify(run)); } catch { /* sem espaço ou bloqueado */ } }
export function clearSave() { try { localStorage.removeItem(SAVE); } catch { /* nada */ } }
