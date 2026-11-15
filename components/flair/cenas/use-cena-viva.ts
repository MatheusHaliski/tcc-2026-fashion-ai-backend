"use client";
/**
 * Liga uma cena dinâmica a um <canvas>: monta o palco na largura da tela, entra na batida compartilhada enquanto a
 * cena está visível (fora da tela ou com a aba escondida, nada roda) e repassa o estado das peças. Com "reduzir
 * movimento" (do sistema ou do app) ou `parada`, pinta só o quadro parado da cena e as peças mudam de lugar na hora.
 */
import { useEffect, useRef, useState } from "react";
import { naBatida } from "@/lib/flair/cenas/batida";
import { criarPalco, type Palco } from "@/lib/flair/cenas/palco";
import { agora } from "@/lib/flair/cenas/relogio";
import type { Tela } from "@/lib/flair/cenas/sprites";
import type { Cena, Ctx } from "@/lib/flair/cenas/tipos";
import type { PecaEstado } from "@/lib/flair/elencos/board";

function criarTela(largura: number, altura: number): Tela | null {
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d") as Ctx | null;
  return ctx ? { canvas, ctx } : null;
}

/** "Reduzir movimento": a preferência do sistema ou a do app (html[data-reduce-motion]). */
export function useMovimentoReduzido(): boolean {
  const [reduzido, setReduzido] = useState(false);
  useEffect(() => {
    const midia = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
    const ler = () => setReduzido(!!midia?.matches || document.documentElement.dataset.reduceMotion === "true");
    ler();
    midia?.addEventListener?.("change", ler);
    const olho = new MutationObserver(ler);
    olho.observe(document.documentElement, { attributes: true, attributeFilter: ["data-reduce-motion"] });
    return () => {
      midia?.removeEventListener?.("change", ler);
      olho.disconnect();
    };
  }, []);
  return reduzido;
}

/** Largura da tela de pintura em pixels: a do elemento vezes a densidade (até 2), em passos de 32, de 160 a 1280. */
export function larguraDaTela(elemento: number, densidade: number): number {
  const alvo = Math.round(((elemento || 320) * Math.min(2, densidade || 1)) / 32) * 32;
  return Math.min(1280, Math.max(160, alvo));
}

/** Custo médio de pintura (ms) acima do qual a cena passa a ~30 quadros por segundo (o tempo segue o relógio). */
export const CUSTO_PARA_MEIA_TAXA = 9;

/**
 * Taxa adaptativa: acompanha o custo de cada pintura (média móvel) e, num aparelho em que pintar sai caro, pinta um
 * quadro sim, outro não. O movimento continua no ritmo certo porque cada quadro mostra o instante do relógio.
 */
export function criarRitmo(medir: () => number = () => performance.now()) {
  let media = 0;
  let ultimo = -Infinity;
  return (relogio: number, pintar: () => void): boolean => {
    if (media > CUSTO_PARA_MEIA_TAXA && relogio - ultimo < 0.03) return false;
    const t0 = medir();
    pintar();
    media = media * 0.9 + (medir() - t0) * 0.1;
    ultimo = relogio;
    return true;
  };
}

/** `leve`: miniatura (lista), pintada na densidade 1, que basta ao tamanho dela. */
export function useCenaViva(cena: Cena, pecas: PecaEstado[] | null, completa: boolean, parada = false, leve = false) {
  const ref = useRef<HTMLCanvasElement>(null);
  const palco = useRef<Palco | null>(null);
  const pintar = useRef<(relogio: number) => void>(() => {});
  const entrada = useRef({ pecas, completa });
  entrada.current = { pecas, completa };
  const reduzido = useMovimentoReduzido();
  const parado = reduzido || parada;
  const chave = pecas ? pecas.join(",") : "";

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d") as Ctx | null | undefined;
    if (!canvas || !ctx) return;
    let visivel = typeof IntersectionObserver === "undefined";
    let sair: (() => void) | null = null;
    pintar.current = (relogio) => palco.current?.pintar(ctx, relogio, parado);
    const ritmo = criarRitmo();
    const quadro = (relogio: number) => {
      if (!ritmo(relogio, () => pintar.current(relogio))) return;
      // parada, a cena só precisa de novos quadros enquanto uma peça ainda se move
      if (parado && !palco.current?.emMovimento(relogio)) desligar();
    };
    const desligar = () => {
      sair?.();
      sair = null;
      canvas.dataset.animando = "nao";
    };
    const ligar = () => {
      if (sair || !visivel) return;
      sair = naBatida(quadro);
      canvas.dataset.animando = parado ? "nao" : "sim";
    };
    const montar = () => {
      const largura = larguraDaTela(canvas.clientWidth, leve ? 1 : window.devicePixelRatio);
      if (palco.current?.largura === largura) return;
      const novo = criarPalco(cena, criarTela, largura, ligar);
      if (!novo) return;
      canvas.width = novo.largura;
      canvas.height = novo.altura;
      novo.definir(entrada.current.pecas, entrada.current.completa, agora(), true);
      palco.current = novo;
      pintar.current(agora());
    };
    montar();
    const tamanho = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(montar);
    tamanho?.observe(canvas);
    const vista = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(([e]) => {
      visivel = e.isIntersecting;
      if (visivel) ligar();
      else desligar();
    });
    vista?.observe(canvas);
    ligar();
    return () => {
      desligar();
      tamanho?.disconnect();
      vista?.disconnect();
      palco.current = null;
    };
  }, [cena, parado, leve]);

  useEffect(() => {
    palco.current?.definir(entrada.current.pecas, completa, agora(), parado);
    pintar.current(agora());
  }, [chave, completa, parado]);

  return ref;
}
