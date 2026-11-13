"use client";
/**
 * Controles da tela de jogo: teclado, botões na tela e gamepad (Gamepad API, layout padrão) viram os mesmos comandos
 * (lib/flair/nucleos/controls.ts). O gamepad é lido por requestAnimationFrame só enquanto a tela está montada e há um
 * controle conectado. Comandos de ações fora da lista do núcleo são ignorados.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { comandoDaTecla, lerGamepad, PAD_INICIAL, type Comando, type PadEstado } from "@/lib/flair/nucleos/controls";
import type { NucleoAcao } from "@/lib/flair/nucleos/types";

export interface NucleoControlsOptions {
  acoes: NucleoAcao[];
  onComando: (c: Comando) => void;
  /** false = pausa teclado e gamepad (ex.: resultado aberto) */
  ativo?: boolean;
}

const CAMPOS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function ignorarTecla(e: KeyboardEvent): boolean {
  if (e.altKey || e.ctrlKey || e.metaKey) return true;
  const alvo = e.target as HTMLElement | null;
  if (!alvo || !alvo.tagName) return false;
  if (CAMPOS.has(alvo.tagName) || alvo.isContentEditable) return true;
  // Espaço/Enter num botão focado já disparam o clique dele: não repetir como comando
  return (e.key === " " || e.key === "Enter") && (alvo.tagName === "BUTTON" || alvo.tagName === "A");
}

function padsConectados(): Gamepad[] {
  if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return [];
  return Array.from(navigator.getGamepads() ?? []).filter((p): p is Gamepad => !!p);
}

export function useNucleoControls({ acoes, onComando, ativo = true }: NucleoControlsOptions) {
  const ref = useRef({ acoes, onComando, ativo });
  ref.current = { acoes, onComando, ativo };
  const [gamepad, setGamepad] = useState(false);

  const disparar = useCallback((c: Comando) => {
    const atual = ref.current;
    if (!atual.ativo || !atual.acoes.includes(c.acao)) return false;
    atual.onComando(c);
    return true;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat && e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      if (ignorarTecla(e)) return;
      const c = comandoDaTecla(e.key);
      if (c && disparar(c)) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disparar]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") return;
    let frame = 0;
    let estados = new Map<number, PadEstado>();
    const ler = (agora: number) => {
      frame = 0;
      const pads = padsConectados();
      if (!pads.length) {
        setGamepad(false);
        return;
      }
      const proximos = new Map<number, PadEstado>();
      for (const pad of pads) {
        const { comandos, estado } = lerGamepad(pad, estados.get(pad.index) ?? PAD_INICIAL, agora);
        proximos.set(pad.index, estado);
        comandos.forEach(disparar);
      }
      estados = proximos;
      frame = window.requestAnimationFrame(ler);
    };
    const iniciar = () => {
      setGamepad(padsConectados().length > 0);
      if (!frame) frame = window.requestAnimationFrame(ler);
    };
    if (padsConectados().length) iniciar();
    window.addEventListener("gamepadconnected", iniciar);
    return () => {
      window.removeEventListener("gamepadconnected", iniciar);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [disparar]);

  return { disparar, gamepad };
}
