/** Ícones das abas da janela de recursos (traço simples, cor do texto): vagas, zona do editor, maquiagem e resposta. */
import type { AbaIcone } from "@/lib/flair/nucleos/types";

const PATHS: Record<AbaIcone, string> = {
  sup: "M8 4l4 2 4-2 4 4-3 3v9H7v-9L4 8z",
  inf: "M7 4h10l1 16h-4l-2-10-2 10H6z",
  cal: "M4 15c3 0 5-2 6-6h3c0 3 3 5 7 6v4H4z",
  ace: "M8 9V7a4 4 0 018 0v2M5 9h14l-1 11H6z",
  ves: "M9 3h6l-1 5 5 13H5l5-13z",
  zona: "M4 20l4-1 11-11-3-3L5 16zM14 6l3 3",
  labios: "M3 12c3-4 6-5 9-3 3-2 6-1 9 3-3 5-15 5-18 0zM3 12h18",
  olhos: "M2 12c4-6 16-6 20 0-4 6-16 6-20 0zM12 9a3 3 0 110 6 3 3 0 010-6z",
  bochechas: "M12 4a8 8 0 100 16 8 8 0 000-16zM8 14a2 2 0 104 0 2 2 0 00-4 0",
  resposta: "M4 5h16v11H9l-5 4zM9 9h6M9 12h4",
};

export function NucleoIcon({ name, size = 20 }: { name: AbaIcone; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Ícones dos botões sobre o palco e da faixa do deck (câmera, som, efeitos, voltar, fechar, tirar, andar). */
export type HudIconName =
  | "voltar"
  | "girarE"
  | "girarD"
  | "mais"
  | "menos"
  | "pose"
  | "som"
  | "somOff"
  | "efeitos"
  | "fechar"
  | "andar"
  | "tirar";

const HUD_PATHS: Record<HudIconName, string> = {
  voltar: "M15 5l-7 7 7 7",
  girarE: "M5 8a8 8 0 1 1-1 6M5 3v5h5",
  girarD: "M19 8a8 8 0 1 0 1 6M19 3v5h-5",
  mais: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4M8 11h6M11 8v6",
  menos: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4M8 11h6",
  pose: "M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM5 9l7 2 7-2M12 11v5l-3 5M12 16l3 5",
  som: "M4 10v4h4l5 4V6l-5 4zM16 9a4 4 0 0 1 0 6",
  somOff: "M4 10v4h4l5 4V6l-5 4zM16 9l5 6M21 9l-5 6",
  efeitos: "M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z",
  fechar: "M6 6l12 12M18 6L6 18",
  andar: "M13 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM10 21l2-6-3-3 2-4 3 3h3M8 15l-2 5",
  tirar: "M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13",
};

export function HudIcon({ name, size = 20 }: { name: HudIconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      <path d={HUD_PATHS[name]} />
    </svg>
  );
}
