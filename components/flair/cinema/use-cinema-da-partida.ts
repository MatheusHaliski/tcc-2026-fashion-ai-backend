"use client";
/**
 * As cutscenes da partida (lib/flair/cinema): a abertura toca quando a partida começa na preparação, uma vez por
 * partida; o final (vitória, empate ou derrota, pelo desfecho do servidor) toca quando o resultado fecha a partida. A
 * cena 3D recebe a cutscene pelos eventos (fx-events) e põe a câmera nas tomadas; aqui ficam o relógio, a legenda da
 * tomada na tela e o pular. Nenhuma cutscene muda a nota.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { cutsceneDe, finalDoResultado } from "@/lib/flair/cinema/catalogo";
import { cameraNoInstante } from "@/lib/flair/cinema/tomada";
import { duracao, type Cutscene } from "@/lib/flair/cinema/types";
import { emitirFx } from "@/lib/flair/nucleos/fx-events";
import type { Momento } from "@/lib/flair/nucleos/moments";
import type { NucleoCodigo, NucleoResultado } from "@/lib/flair/nucleos/types";

/** Com "reduzir movimento" a cena vira um quadro parado com a legenda, até a pessoa seguir ou por este tempo. */
export const PARADO_MS = 6000;
const PASSO_MS = 100;

export interface CinemaNaTela {
  cutscene: Cutscene | null;
  /** a chave do texto da tomada na tela */
  fala: string | null;
  tomada: number;
  pular: () => void;
}

interface Opcoes {
  codigo: NucleoCodigo;
  partida: string | null | undefined;
  momento: Momento;
  resultado: NucleoResultado | null;
  reduzido: boolean;
}

const fecha = (r: NucleoResultado | null) => !!r && (r.status == null || r.status === "ENTREGUE");

export function useCinemaDaPartida({ codigo, partida, momento, resultado, reduzido }: Opcoes): CinemaNaTela {
  const [tocando, setTocando] = useState<{ c: Cutscene; inicio: number } | null>(null);
  const [agora, setAgora] = useState(0);
  const vistas = useRef(new Set<string>());

  const tocar = useCallback((c: Cutscene, chave: string) => {
    if (vistas.current.has(chave)) return;
    vistas.current.add(chave);
    const inicio = typeof performance !== "undefined" ? performance.now() : Date.now();
    setTocando({ c, inicio });
    setAgora(inicio);
    emitirFx({ tipo: "cinema", nucleo: codigo, cutscene: c, reduzido });
  }, [codigo, reduzido]);

  const pular = useCallback(() => {
    setTocando((atual) => {
      if (atual) emitirFx({ tipo: "cinema", nucleo: codigo, cutscene: null, reduzido });
      return null;
    });
  }, [codigo, reduzido]);

  useEffect(() => {
    if (partida && momento === "PREPARACAO") tocar(cutsceneDe(codigo, "ABERTURA"), `abertura:${partida}`);
  }, [partida, momento, codigo, tocar]);

  useEffect(() => {
    if (momento === "RESULTADO" && resultado && fecha(resultado)) tocar(finalDoResultado(codigo, resultado), `final:${partida ?? codigo}:${resultado.resultado}:${resultado.pontos}`);
  }, [momento, resultado, partida, codigo, tocar]);

  useEffect(() => {
    if (!tocando) return;
    const limite = reduzido ? PARADO_MS : duracao(tocando.c) * 1000;
    const timer = window.setInterval(() => {
      const t = performance.now();
      setAgora(t);
      if (t - tocando.inicio >= limite) pular();
    }, PASSO_MS);
    return () => window.clearInterval(timer);
  }, [tocando, reduzido, pular]);

  useEffect(() => () => emitirFx({ tipo: "cinema", nucleo: codigo, cutscene: null, reduzido: false }), [codigo]);

  if (!tocando) return { cutscene: null, fala: null, tomada: 0, pular };
  const cam = cameraNoInstante(tocando.c, (agora - tocando.inicio) / 1000, [0, 0, 0], Infinity, reduzido);
  return { cutscene: tocando.c, fala: cam.fala ?? null, tomada: cam.tomada, pular };
}
