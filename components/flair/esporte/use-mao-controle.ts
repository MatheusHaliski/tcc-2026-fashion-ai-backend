"use client";
/**
 * A mão de cartas do Fashion Sports no teclado e no controle, enquanto a janela da jogada está aberta. Teclado: setas
 * escolhem a carta, Enter ou Espaço jogam, Backspace segue sem carta. Controle (Gamepad API, layout padrão, os mesmos
 * comandos de lib/flair/nucleos/controls.ts): direcional para os lados escolhe, A ou Start jogam, B segue sem carta. O
 * controle é lido por requestAnimationFrame só enquanto a janela está aberta e há um controle conectado.
 */
import { useEffect, useRef } from "react";
import { comandoDaTecla, lerGamepad, PAD_INICIAL, type Comando, type PadEstado } from "@/lib/flair/nucleos/controls";

export interface MaoNoControle {
  /** a janela da jogada está aberta */
  ativo: boolean;
  onMover: (dir: number) => void;
  onJogar: () => void;
  onSeguir: () => void;
}

function conectados(): Gamepad[] {
  if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return [];
  return Array.from(navigator.getGamepads() ?? []).filter((p): p is Gamepad => !!p);
}

export function useMaoNoControle(opcoes: MaoNoControle): void {
  const ref = useRef(opcoes);
  ref.current = opcoes;
  const { ativo } = opcoes;

  useEffect(() => {
    if (!ativo) return;
    /** O comando do teclado ou do controle na mão; devolve se ele foi usado. */
    const usar = (c: Comando | null): boolean => {
      if (!c) return false;
      if (c.acao === "NAVEGAR" && c.eixo === "x") ref.current.onMover(c.dir ?? 1);
      else if (c.acao === "VESTIR" || c.acao === "ENTREGAR") ref.current.onJogar();
      else if (c.acao === "TIRAR") ref.current.onSeguir();
      else return false;
      return true;
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (usar(comandoDaTecla(e.key))) e.preventDefault();
    };
    window.addEventListener("keydown", tecla);

    let frame = 0;
    // os botões que já estavam apertados quando a janela abriu não contam como um aperto novo
    let estados = new Map<number, PadEstado>(conectados().map((pad) => [pad.index, lerGamepad(pad, PAD_INICIAL, 0).estado]));
    const ler = (agora: number) => {
      frame = 0;
      const pads = conectados();
      if (!pads.length) return;
      const proximos = new Map<number, PadEstado>();
      for (const pad of pads) {
        const { comandos, estado } = lerGamepad(pad, estados.get(pad.index) ?? PAD_INICIAL, agora);
        proximos.set(pad.index, estado);
        comandos.forEach(usar);
      }
      estados = proximos;
      frame = window.requestAnimationFrame(ler);
    };
    const iniciar = () => {
      if (!frame && typeof window.requestAnimationFrame === "function") frame = window.requestAnimationFrame(ler);
    };
    if (conectados().length) iniciar();
    window.addEventListener("gamepadconnected", iniciar);
    return () => {
      window.removeEventListener("keydown", tecla);
      window.removeEventListener("gamepadconnected", iniciar);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [ativo]);
}
