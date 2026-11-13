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
