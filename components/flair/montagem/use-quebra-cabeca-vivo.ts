"use client";
/**
 * Liga o quebra-cabeça dinâmico a um <canvas>: cria a fonte (vídeo ou símbolo animado), pinta o quadro numa tela de
 * apoio e recorta as peças dela a cada batida enquanto o canvas está visível (fora da tela, o vídeo pausa e nada roda).
 * Quando o estado de uma peça muda, ela desliza até a nova folga (movimento.ts). Com "reduzir movimento" ou `parado`,
 * o vídeo não toca: pinta-se o pôster e as peças trocam de lugar na hora.
 */
import { useEffect, useMemo, useRef } from "react";
import { naBatida } from "@/lib/flair/cenas/batida";
import { agora } from "@/lib/flair/cenas/relogio";
import type { Ctx } from "@/lib/flair/cenas/tipos";
import type { PecaEstado } from "@/lib/flair/elencos/board";
import { larguraDaTela, useMovimentoReduzido } from "@/components/flair/cenas/use-cena-viva";
import type { QuebraCabecaDinamico } from "@/lib/flair/montagem/dinamico/catalogo";
import { criarFonteViva } from "@/lib/flair/montagem/dinamico/fonte";
import { alfaDaPeca, folgaNoInstante, novosTrajetos, type Trajeto } from "@/lib/flair/montagem/dinamico/movimento";
import { pintarQuebraCabeca } from "@/lib/flair/montagem/dinamico/pintura";
import { pecasDinamicas } from "@/lib/flair/montagem/dinamico/recorte";

export function useQuebraCabecaVivo(qc: QuebraCabecaDinamico, pecas: PecaEstado[] | null, completa: boolean, parada = false, selecionada = -1) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduzido = useMovimentoReduzido();
  const parado = reduzido || parada;
  const n = pecas?.length ?? 0;
  const formas = useMemo(() => pecasDinamicas(qc.forma, n, qc.largura), [qc, n]);
  const entrada = useRef({ pecas, completa, selecionada });
  entrada.current = { pecas, completa, selecionada };
  const trajetos = useRef<{ lista: Trajeto[]; estados: PecaEstado[] }>({ lista: [], estados: [] });
  const pintar = useRef<() => void>(() => {});
  const chave = pecas ? pecas.join(",") : "";

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d") as Ctx | null | undefined;
    if (!canvas || !ctx || typeof Path2D === "undefined") return;
    const apoio = document.createElement("canvas");
    const actx = apoio.getContext("2d") as Ctx | null;
    if (!actx) return;
    let visivel = typeof IntersectionObserver === "undefined";
    let sair: (() => void) | null = null;
    const caminhos = new Map<string, Path2D>();
    const caminho = (d: string) => caminhos.get(d) ?? caminhos.set(d, new Path2D(d)).get(d)!;
    const fonte = criarFonteViva(qc.fonte, () => pintar.current());

    const montar = () => {
      const W = larguraDaTela(canvas.clientWidth, window.devicePixelRatio);
      const H = Math.round((W * 100) / qc.largura);
      if (canvas.width === W && canvas.height === H) return;
      canvas.width = apoio.width = W;
      canvas.height = apoio.height = H;
    };
    pintar.current = () => {
      const t = agora();
      const { pecas: estados, completa: completo, selecionada: sel } = entrada.current;
      const escala = canvas.height / 100;
      fonte.pintar(actx, apoio.width, apoio.height, t, parado);
      const lista = formas.map((p, i) => {
        const estado = estados?.[i] ?? "coberta";
        const tr = trajetos.current.lista[i];
        const folga = tr ? folgaNoInstante(tr, t, parado) : { dx: 0, dy: 0, giro: 0 };
        return { ...p, estado, folga, alfa: alfaDaPeca(estado, parado ? 0.25 : t), selecionada: i === sel };
      });
      pintarQuebraCabeca(ctx, { apoio, escala, largura: qc.largura, completo: completo || !estados }, lista, caminho);
    };
    const ligar = () => {
      if (sair || !visivel || parado) return;
      fonte.tocar();
      sair = naBatida(() => pintar.current());
      canvas.dataset.animando = "sim";
    };
    const desligar = () => {
      sair?.();
      sair = null;
      fonte.pausar();
      canvas.dataset.animando = "nao";
    };
    montar();
    pintar.current();
    const tamanho = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => {
      montar();
      pintar.current();
    });
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
      fonte.soltar();
      pintar.current = () => {};
    };
  }, [qc, formas, parado]);

  useEffect(() => {
    const estados = entrada.current.pecas ?? [];
    const atual = trajetos.current;
    trajetos.current = { lista: novosTrajetos(atual.lista, estados, atual.estados, agora(), parado), estados };
    pintar.current();
  }, [chave, completa, selecionada, parado]);

  return ref;
}
