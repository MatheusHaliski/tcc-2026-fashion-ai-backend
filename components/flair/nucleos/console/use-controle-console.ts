"use client";
/**
 * Liga o perfil de controles "console" (lib/flair/nucleos/controle/perfil-console.ts) enquanto `ativo`: as setas e o
 * analógico esquerdo escrevem o vetor de andar (Shift ou L3 corre) em estado-do-console.ts, lido pela cena a cada
 * quadro; as outras teclas e botões viram ações (`onAcao(acao, "desce" | "sobe")`; "sobe" só para as seguradas, A e
 * X). Reutilizável: o jogo decide o que cada ação faz.
 */
import { useEffect, useRef } from "react";
import { PARADO, limitar } from "@/lib/flair/entrada/acoes";
import { ignorarTecla } from "@/lib/flair/entrada/teclado";
import { definirMovimento } from "@/lib/flair/nucleos/controle/estado-do-console";
import { acaoDoConsole, BOTAO_CORRER, BOTOES_CONSOLE, ehCorrer, ehSeta, SEGURADAS, vetorDasSetas, type AcaoConsole } from "@/lib/flair/nucleos/controle/perfil-console";

export type FaseDaTecla = "desce" | "sobe";
const ZONA_MORTA = 0.2;

export interface OpcoesDoConsole {
  ativo: boolean;
  onAcao: (acao: AcaoConsole, fase: FaseDaTecla) => void;
}

function controle(): Gamepad | null {
  if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return null;
  return Array.from(navigator.getGamepads() ?? []).find((p): p is Gamepad => !!p) ?? null;
}

export function useControleConsole({ ativo, onAcao }: OpcoesDoConsole): void {
  const acao = useRef(onAcao);
  acao.current = onAcao;
  useEffect(() => {
    if (!ativo || typeof window === "undefined") return;
    const setas = new Set<string>();
    const seguradas = new Set<AcaoConsole>();
    let correr = false;
    const publicar = () => definirMovimento(vetorDasSetas(setas), correr);
    const desce = (e: KeyboardEvent) => {
      if (ehCorrer(e.code)) {
        correr = true;
        return publicar();
      }
      if (ehSeta(e.code)) {
        if (ignorarTecla(e)) return;
        e.preventDefault();
        setas.add(e.code);
        return publicar();
      }
      const a = acaoDoConsole(e.code, e.key);
      // Esc vale até num campo; Enter num botão em foco fica com o clique do botão
      if (!a || (a !== "PAUSA" && ignorarTecla(e))) return;
      e.preventDefault();
      if (e.repeat) return;
      if (SEGURADAS.has(a)) seguradas.add(a);
      acao.current(a, "desce");
    };
    const sobe = (e: KeyboardEvent) => {
      if (ehCorrer(e.code)) correr = false;
      setas.delete(e.code);
      publicar();
      const a = acaoDoConsole(e.code, e.key);
      if (a && seguradas.delete(a)) acao.current(a, "sobe");
    };
    const solta = () => {
      setas.clear();
      correr = false;
      publicar();
      for (const a of seguradas) acao.current(a, "sobe");
      seguradas.clear();
    };
    // o controle: analógico esquerdo e os botões, por borda (apertou / soltou)
    let frame = 0;
    let antes: boolean[] = [];
    const ler = () => {
      const pad = controle();
      if (pad) {
        const agora = pad.buttons.map((b) => b.pressed);
        for (const [i, a] of Object.entries(BOTOES_CONSOLE)) {
          const n = Number(i);
          if (agora[n] && !antes[n]) acao.current(a, "desce");
          if (!agora[n] && antes[n] && SEGURADAS.has(a)) acao.current(a, "sobe");
        }
        antes = agora;
        const [x = 0, y = 0] = pad.axes;
        if (setas.size === 0) {
          const v = Math.hypot(x, y) < ZONA_MORTA ? PARADO : limitar({ x, y: -y });
          definirMovimento(v, correr || !!agora[BOTAO_CORRER]);
        }
      }
      frame = window.requestAnimationFrame(ler);
    };
    window.addEventListener("keydown", desce);
    window.addEventListener("keyup", sobe);
    window.addEventListener("blur", solta);
    if (typeof window.requestAnimationFrame === "function") frame = window.requestAnimationFrame(ler);
    return () => {
      window.removeEventListener("keydown", desce);
      window.removeEventListener("keyup", sobe);
      window.removeEventListener("blur", solta);
      if (frame) window.cancelAnimationFrame(frame);
      definirMovimento(PARADO, false);
    };
  }, [ativo]);
}
