"use client";
/**
 * Controles da tela de jogo: teclado, botões na tela e gamepad (Gamepad API, layout padrão) viram os mesmos comandos
 * (lib/flair/nucleos/controls.ts). O gamepad é lido por requestAnimationFrame só enquanto a tela está montada e há um
 * controle conectado. Comandos de ações fora da lista do núcleo são ignorados.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { TECLAS_DE_ANDAR } from "@/components/flair/nucleos/use-eixo-de-andar";
import { codigoDoCaractere, comandoDaTecla, comandoDoJogo, lerGamepad, PAD_INICIAL, type Comando, type PadEstado } from "@/lib/flair/nucleos/controls";
import type { NucleoAcao } from "@/lib/flair/nucleos/types";

export interface NucleoControlsOptions {
  acoes: NucleoAcao[];
  onComando: (c: Comando) => void;
  /** false = pausa teclado e gamepad (ex.: resultado aberto) */
  ativo?: boolean;
  /** o jogo anda livre agora: WASD e o analógico esquerdo são do corpo (use-eixo-de-andar), as setas do menu */
  andar?: boolean;
}

const CAMPOS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function ignorarTecla(e: KeyboardEvent): boolean {
  if (e.altKey || e.ctrlKey || e.metaKey) return true;
  const alvo = e.target as HTMLElement | null;
  if (!alvo || !alvo.tagName) return false;
  if (CAMPOS.has(alvo.tagName) || alvo.isContentEditable) return true;
  // Espaço/Enter num botão focado já disparam o clique dele: não repetir como comando
  // Espaço/Enter num botão focado já disparam o clique dele: não repetir como comando (o botão do jogo é o ✕)
  return (e.key === " " || e.key === "Enter") && (alvo.tagName === "BUTTON" || alvo.tagName === "A");
}

function padsConectados(): Gamepad[] {
  if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return [];
  return Array.from(navigator.getGamepads() ?? []).filter((p): p is Gamepad => !!p);
}

export function useNucleoControls({ acoes, onComando, ativo = true, andar = false }: NucleoControlsOptions) {
  const ref = useRef({ acoes, onComando, ativo, andar });
  ref.current = { acoes, onComando, ativo, andar };
  const [gamepad, setGamepad] = useState(false);

  const disparar = useCallback((c: Comando) => {
    const atual = ref.current;
    const doJogo = comandoDoJogo(c, atual.acoes);
    if (!atual.ativo || !atual.acoes.includes(doJogo.acao)) return false;
    atual.onComando(doJogo);
    return true;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat && e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      if (ignorarTecla(e)) return;
      if (ref.current.andar && TECLAS_DE_ANDAR.has(e.code || codigoDoCaractere(e.key))) return;
      const c = comandoDaTecla(e.key, e.code);
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
        const { comandos, estado } = lerGamepad(pad, estados.get(pad.index) ?? PAD_INICIAL, agora, ref.current.andar);
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
