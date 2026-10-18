/*
 * Controle de videogame (DualSense/DualShock e qualquer controle no mapeamento padrão do navegador): a mesma leitura no
 * Meu Quarto, no Provador e no FLAIR. O navegador só mostra o controle depois que a pessoa aperta um botão dele com a
 * página aberta (regra da Gamepad API), e só controles com `mapping === "standard"` têm os botões nos índices abaixo.
 */
import { useEffect, useRef } from "react";

/** Índices do mapeamento padrão: × ○ □ △, L1 R1 L2 R2, Share Options, L3 R3 e o direcional. */
export const PAD = {
  cross: 0, circle: 1, square: 2, triangle: 3, l1: 4, r1: 5, l2: 6, r2: 7,
  share: 8, options: 9, l3: 10, r3: 11, up: 12, down: 13, left: 14, right: 15,
} as const;

export interface Axis { x: number; y: number }
const DEAD = .08;

/** Analógico com zona morta (8%) e escala que volta a ir de 0 a 1 depois dela; y positivo = para baixo/para trás. */
export function deadzone(x: number, y: number): Axis {
  const length = Math.hypot(x, y), magnitude = Math.min(1, length);
  if (!length || magnitude <= DEAD) return { x: 0, y: 0 };
  const k = (magnitude - DEAD) / (1 - DEAD) / length;
  return { x: x * k, y: y * k };
}

/** O primeiro controle conectado no mapeamento padrão; null sem controle (ou sem a Gamepad API). */
export function standardPad(pads: ReadonlyArray<Gamepad | null> | null | undefined = typeof navigator !== "undefined" ? navigator.getGamepads?.() : null): Gamepad | null {
  return Array.from(pads ?? []).find((p): p is Gamepad => !!p && p.connected !== false && p.mapping === "standard") ?? null;
}

const pressed = (pad: Gamepad, i: number) => !!pad.buttons[i]?.pressed;

/** Andar: analógico esquerdo, ou o direcional quando o analógico está parado (diagonais com o mesmo tamanho). */
export function padMove(pad: Gamepad): Axis {
  const stick = deadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
  if (stick.x || stick.y) return stick;
  const x = Number(pressed(pad, PAD.right)) - Number(pressed(pad, PAD.left)), y = Number(pressed(pad, PAD.down)) - Number(pressed(pad, PAD.up));
  const n = Math.hypot(x, y) || 1;
  return { x: x / n, y: y / n };
}
/** Câmera: analógico direito; L1/R1 somam um giro inteiro para a esquerda/direita. */
export function padLook(pad: Gamepad): Axis {
  const stick = deadzone(pad.axes[2] ?? 0, pad.axes[3] ?? 0);
  return { x: stick.x + Number(pressed(pad, PAD.r1)) - Number(pressed(pad, PAD.l1)), y: stick.y };
}

export interface PadFrame { pad: Gamepad; move: Axis; look: Axis; held: (i: number) => boolean; tapped: (i: number) => boolean; dt: number }

/**
 * Lê o controle a cada quadro (requestAnimationFrame) enquanto `enabled`: `onFrame` recebe andar, câmera, o que está
 * apertado e o que acabou de ser apertado (borda, para ações de um toque). Sem controle, chama `onIdle` uma vez.
 */
export function usePad(enabled: boolean, onFrame: (frame: PadFrame) => void, onIdle?: () => void) {
  const handlers = useRef({ onFrame, onIdle }); handlers.current = { onFrame, onIdle };
  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof navigator === "undefined" || !navigator.getGamepads) return;
    let frame = 0, last = performance.now(), idle = true;
    const before = new Set<number>();
    const tick = (now: number) => {
      const dt = Math.min(.1, (now - last) / 1000); last = now;
      const pad = document.visibilityState === "visible" ? standardPad() : null;
      if (pad) {
        idle = false;
        const down = new Set<number>(); pad.buttons.forEach((b, i) => { if (b?.pressed) down.add(i); });
        handlers.current.onFrame({ pad, move: padMove(pad), look: padLook(pad), held: (i) => down.has(i), tapped: (i) => down.has(i) && !before.has(i), dt });
        before.clear(); down.forEach((i) => before.add(i));
      } else if (!idle) { idle = true; before.clear(); handlers.current.onIdle?.(); }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); if (!idle) handlers.current.onIdle?.(); };
  }, [enabled]);
}
