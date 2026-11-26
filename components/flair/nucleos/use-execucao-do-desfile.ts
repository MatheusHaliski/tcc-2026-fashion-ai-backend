"use client";
/**
 * A execução no percurso na tela (lib/flair/nucleos/movimento/execucao.ts): com o pedido do servidor, cada marca que a
 * personagem alcança abre uma deixa — o botão pedido, com a janela de tempo correndo —; o botão certo a tempo vale,
 * o resto é erro e drena o recurso. Com "reduzir movimento" (sem andar), as deixas vêm uma depois da outra. Quando
 * todas as marcas tiveram nota, os toques vão ao servidor, que dá a nota de verdade. Na fase de uso dos jogos de zonas
 * a deixa traz também o lance ousado e a fase tem prazo, contado da primeira deixa: o que faltar quando ele acaba conta
 * como erro. Sem pedido (execução já feita), □ na ponta faz a pose final.
 */
import { useEffect, useRef, useState } from "react";
import { assinarFx, emitirFx } from "@/lib/flair/nucleos/fx-events";
import { definirExecucaoPendente } from "@/lib/flair/nucleos/movimento/execucao-pendente";
import { ehOusado, notaDoToque, pedidoDe, type BotaoDaExecucao, type NotaDoToque, type Toque } from "@/lib/flair/nucleos/movimento/execucao";
import type { NucleoCodigo, NucleoResultado } from "@/lib/flair/nucleos/types";

/** Intervalo entre as deixas sem andar ("reduzir movimento"). */
export const DEIXA_SEM_ANDAR_MS = 900;

export interface Deixa {
  marca: number;
  botao: BotaoDaExecucao;
  desde: number;
  janelaMs: number;
  /** fase de uso: o botão do lance ousado desta marca e a janela (mais curta) dele */
  ousado?: BotaoDaExecucao;
  janelaOusadaMs?: number;
}

/** O prazo da fase de uso correndo: quando começou (performance.now) e quanto dura. */
export interface Prazo {
  desde: number;
  ms: number;
}

export function useExecucaoDoDesfile(codigo: NucleoCodigo, resultado: NucleoResultado | null | undefined, reduzido: boolean, onExecucao?: (toques: Toque[]) => void) {
  const pedido = pedidoDe(resultado);
  const chave = pedido ? pedido.botoes.join(",") + pedido.janelaMs : "";
  const [deixa, setDeixa] = useState<Deixa | null>(null);
  const [notas, setNotas] = useState<NotaDoToque[]>([]);
  const [ousadias, setOusadias] = useState(0);
  const [prazo, setPrazo] = useState<Prazo | null>(null);
  const estado = useRef({ alcancadas: 0, toques: [] as Toque[], notas: [] as NotaDoToque[], enviado: false, deixa: null as Deixa | null, ousadias: 0, prazo: null as Prazo | null });
  const ref = useRef({ pedido, onExecucao });
  ref.current = { pedido, onExecucao };

  useEffect(() => {
    estado.current = { alcancadas: estado.current.alcancadas, toques: [], notas: [], enviado: false, deixa: null, ousadias: 0, prazo: null };
    setDeixa(null);
    setNotas([]);
    setOusadias(0);
    setPrazo(null);
    definirExecucaoPendente(!!chave);
    return () => definirExecucaoPendente(false);
  }, [chave]);

  useEffect(() => {
    const e = estado.current;
    const fechar = (nota: NotaDoToque, toque: Toque | null) => {
      if (toque) e.toques.push(toque);
      const p0 = ref.current.pedido;
      if (toque && p0 && ehOusado(p0, toque.marca, toque.botao)) setOusadias(++e.ousadias);
      emitirFx({ tipo: "desfile-nota", nucleo: codigo, marca: e.notas.length, nota });
      e.notas = [...e.notas, nota];
      e.deixa = null;
      setDeixa(null);
      setNotas(e.notas);
      const p = ref.current.pedido;
      if (p && e.notas.length >= p.botoes.length && !e.enviado) {
        e.enviado = true;
        definirExecucaoPendente(false);
        ref.current.onExecucao?.(e.toques);
      }
    };
    /** abre a próxima deixa se a personagem já passou da marca dela e não há outra aberta */
    const abrir = () => {
      const p = ref.current.pedido;
      const proxima = e.notas.length;
      if (!p || e.deixa || e.enviado || proxima >= p.botoes.length || (!reduzido && e.alcancadas <= proxima)) return;
      e.deixa = { marca: proxima, botao: p.botoes[proxima], desde: performance.now(), janelaMs: p.janelaMs, ousado: p.risco?.ousados[proxima], janelaOusadaMs: p.risco?.janelaMs };
      setDeixa(e.deixa);
      if (p.risco && p.risco.prazoMs > 0 && !e.prazo) {
        e.prazo = { desde: e.deixa.desde, ms: p.risco.prazoMs };
        setPrazo(e.prazo);
      }
    };
    const cancelar = assinarFx((ev) => {
      if (ev.nucleo !== codigo) return;
      if (ev.tipo === "desfile") {
        e.alcancadas = ev.alcancadas;
        abrir();
      }
      if (ev.tipo !== "desfile-botao") return;
      const p = ref.current.pedido;
      if (e.deixa && p) {
        const ms = Math.round(performance.now() - e.deixa.desde);
        fechar(notaDoToque(p, e.deixa.marca, ev.botao, ms), { marca: e.deixa.marca, botao: ev.botao, ms });
      } else if (!p && ev.botao === "DESFILAR") {
        emitirFx({ tipo: "desfile-pose", nucleo: codigo });
      }
    });
    // a janela fecha sozinha; sem andar, a próxima deixa vem depois de um respiro
    const relogio = window.setInterval(() => {
      const p = ref.current.pedido;
      if (p && e.prazo && !e.enviado && performance.now() - e.prazo.desde > e.prazo.ms) {
        // o prazo da fase acabou: as marcas que faltam contam como erro, e a execução vai ao servidor como está
        while (e.notas.length < p.botoes.length && !e.enviado) fechar("ERROU", null);
      } else if (e.deixa && performance.now() - e.deixa.desde > e.deixa.janelaMs) fechar("ERROU", null);
      else if (!e.deixa) abrir();
    }, reduzido ? DEIXA_SEM_ANDAR_MS : 100);
    return () => {
      cancelar();
      window.clearInterval(relogio);
    };
  }, [codigo, chave, reduzido]);

  return { pedido, deixa, notas, ousadias, prazo };
}
