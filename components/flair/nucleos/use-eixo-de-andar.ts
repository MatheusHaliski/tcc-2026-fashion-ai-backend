"use client";
/**
 * Lê o eixo de andar enquanto o jogo anda livre: WASD seguradas e o analógico esquerdo do controle (com a zona morta
 * de lib/flair/entrada/gamepad.ts). Publica em lib/flair/entrada/eixo-de-andar.ts, que a cena 3D lê a cada quadro.
 * As setas continuam com o menu (cartas, vagas); WASD e o analógico ficam com o corpo.
 */
import { useEffect } from "react";
import { PARADO, limitar } from "@/lib/flair/entrada/acoes";
import { definirAndar, definirEixo } from "@/lib/flair/entrada/eixo-de-andar";
import { lerControle } from "@/lib/flair/entrada/gamepad";
import { ignorarTecla, vetorDasTeclas } from "@/lib/flair/entrada/teclado";

/** As teclas de andar (por posição): só WASD; as setas são do menu. */
export const TECLAS_DE_ANDAR = new Set(["KeyW", "KeyA", "KeyS", "KeyD"]);

export function useEixoDeAndar(ativo: boolean): void {
  useEffect(() => {
    definirAndar(ativo);
    if (!ativo || typeof window === "undefined") return;
    const apertadas = new Set<string>();
    const doTeclado = () => vetorDasTeclas(apertadas);
    let frame = 0;
    const ler = () => {
      const pads = typeof navigator !== "undefined" && navigator.getGamepads ? Array.from(navigator.getGamepads() ?? []).filter(Boolean) : [];
      const pad = pads[0];
      const analogico = pad ? lerControle(pad, []).mover : PARADO;
      const t = doTeclado();
      definirEixo(limitar({ x: t.x + analogico.x, y: t.y + analogico.y }));
      frame = window.requestAnimationFrame(ler);
    };
    const desce = (e: KeyboardEvent) => {
      if (!TECLAS_DE_ANDAR.has(e.code) || ignorarTecla(e)) return;
      apertadas.add(e.code);
    };
    const sobe = (e: KeyboardEvent) => apertadas.delete(e.code);
    const solta = () => apertadas.clear();
    window.addEventListener("keydown", desce);
    window.addEventListener("keyup", sobe);
    window.addEventListener("blur", solta);
    if (typeof window.requestAnimationFrame === "function") frame = window.requestAnimationFrame(ler);
    return () => {
      window.removeEventListener("keydown", desce);
      window.removeEventListener("keyup", sobe);
      window.removeEventListener("blur", solta);
      if (frame) window.cancelAnimationFrame(frame);
      definirAndar(false);
    };
  }, [ativo]);
}
