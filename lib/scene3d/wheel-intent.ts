/*
 * Rolagem inteligente sobre o provador 3D: a mesma roda/trackpad serve à página e à câmera. Antes, a câmera tomava toda
 * rolagem que passava por cima do palco — a página "prendia" no provador. Agora a câmera só recebe a rolagem quando a
 * intenção é clara, e devolve à página quando chega no limite (zoom máximo/mínimo, fim do percurso pelo corpo):
 *
 *   câmera  · gesto de pinça no trackpad (ctrlKey) — é zoom de propósito
 *           · a pessoa acabou de mexer no palco (clicou, arrastou, usou um botão): por alguns segundos
 *           · o ponteiro parou em cima do palco antes de rolar (≥ 600 ms sem a página rolar)
 *   página  · a página estava rolando há pouco (o ponteiro só "passou" pelo palco no meio do gesto)
 *           · rolagem "fria" ao entrar no palco, sem nenhum dos sinais acima
 *           · rolagem horizontal pura (trackpad de lado) — não é câmera nem desce a página: fica com o navegador
 *
 * Funções puras com o relógio injetado: o hook (FittingStage) só alimenta eventos e aplica a decisão.
 */
export interface WheelState { engagedUntil: number; lastPageScrollAt: number; hoverSince: number | null }
export interface WheelLike { deltaX: number; deltaY: number; deltaMode: number; ctrlKey: boolean }
export type WheelIntent = "camera" | "page";

export const ENGAGE_MS = 4000, CONTINUE_MS = 1500, PAGE_MOMENTUM_MS = 450, HOVER_INTENT_MS = 600;

export const initialWheelState = (): WheelState => ({ engagedUntil: 0, lastPageScrollAt: -Infinity, hoverSince: null });

/** deltaY em pixels (linhas ×16, páginas ×400), como o navegador entrega em cada modo. */
export const wheelPixels = (e: WheelLike) => e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);

export function wheelIntent(e: WheelLike, now: number, s: WheelState): WheelIntent {
  if (e.ctrlKey) return "camera";
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.5) return "page";
  if (now < s.engagedUntil) return "camera";
  if (now - s.lastPageScrollAt < PAGE_MOMENTUM_MS) return "page";
  if (s.hoverSince !== null && now - s.hoverSince >= HOVER_INTENT_MS && s.hoverSince > s.lastPageScrollAt) return "camera";
  return "page";
}

/** Depois de decidir: câmera que andou prolonga o engajamento; câmera no limite devolve a rolagem à página. */
export function afterWheel(s: WheelState, intent: WheelIntent, consumed: boolean, now: number): WheelState {
  if (intent === "camera" && consumed) return { ...s, engagedUntil: Math.max(s.engagedUntil, now + CONTINUE_MS) };
  if (intent === "camera") return { ...s, engagedUntil: 0, lastPageScrollAt: now };
  return s;
}
