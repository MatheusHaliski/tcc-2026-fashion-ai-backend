"use client";
/**
 * A execução no percurso na tela (lib/flair/nucleos/movimento/execucao.ts): com o pedido do servidor, cada marca que a
 * personagem alcança abre uma deixa — o botão pedido, com a janela de tempo correndo —; o botão certo a tempo vale,
 * o resto é erro e drena o recurso. Com "reduzir movimento" (sem andar), as deixas vêm uma depois da outra. Quando
 * todas as marcas tiveram nota, os toques vão ao servidor, que dá a nota de verdade. Na fase de uso dos jogos de zonas
 * a deixa traz também o lance ousado e a fase tem prazo, contado da primeira deixa: o que faltar quando ele acaba conta
 * como erro. Na rodada zonas a janela é a da marca (fecha com a rodada e com a marca), o momento-chave abre ou fecha a
 * das seguintes e a carta armada (armar) vai no toque da marca. Sem pedido (execução já feita), □ na ponta faz a pose final.
 */
import { useEffect, useRef, useState } from "react";
import { assinarFx, emitirFx } from "@/lib/flair/nucleos/fx-events";
import { definirExecucaoPendente } from "@/lib/flair/nucleos/movimento/execucao-pendente";
import { ehOusado, notaDoToque, pedidoDe, type BotaoDaExecucao, type NotaDoToque, type Toque } from "@/lib/flair/nucleos/movimento/execucao";
import { pausar } from "@/lib/flair/nucleos/movimento/relogio-da-fase";
import { embaloDepoisDaChave, janelasDaMarca, type ChaveDoPedido, type UsoDaCarta } from "@/lib/flair/nucleos/movimento/lances-de-uso";
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
  /** rodada zonas: o momento-chave desta marca e a carta armada quando a deixa abriu */
  chave?: ChaveDoPedido;
  carta?: CartaArmada;
}

/** A carta do guarda-roupa armada para a próxima marca (jogos de zonas). */
export interface CartaArmada {
  id: string;
  uso: UsoDaCarta;
}

/** O prazo da fase de uso correndo: quando começou (performance.now) e quanto dura. */
export interface Prazo {
  desde: number;
  ms: number;
}

export function useExecucaoDoDesfile(codigo: NucleoCodigo, resultado: NucleoResultado | null | undefined, reduzido: boolean, onExecucao?: (toques: Toque[]) => void, armar?: (marca: number) => CartaArmada | null) {
  const pedido = pedidoDe(resultado);
  const chave = pedido ? pedido.botoes.join(",") + pedido.janelaMs : "";
  const [deixa, setDeixa] = useState<Deixa | null>(null);
  const [notas, setNotas] = useState<NotaDoToque[]>([]);
  const [ousadias, setOusadias] = useState(0);
  const [prazo, setPrazo] = useState<Prazo | null>(null);
  const estado = useRef({ alcancadas: 0, toques: [] as Toque[], notas: [] as NotaDoToque[], enviado: false, deixa: null as Deixa | null, ousadias: 0, prazo: null as Prazo | null, embalo: 0, pausa: 0 });
  const ref = useRef({ pedido, onExecucao, armar });
  ref.current = { pedido, onExecucao, armar };

  useEffect(() => {
    estado.current = { alcancadas: estado.current.alcancadas, toques: [], notas: [], enviado: false, deixa: null, ousadias: 0, prazo: null, embalo: 0, pausa: 0 };
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
      const d = e.deixa;
      if (toque) e.toques.push(d?.carta ? { ...toque, carta: d.carta.id } : toque);
      const p0 = ref.current.pedido;
      if (toque && p0 && ehOusado(p0, toque.marca, toque.botao)) setOusadias(++e.ousadias);
      if (d?.chave) e.embalo = embaloDepoisDaChave(nota === "CHAVE");
      const carta = toque && d?.carta ? { id: d.carta.id, lance: d.carta.uso.lance, efeito: d.carta.uso.efeito, faixa: d.carta.uso.faixa } : undefined;
      emitirFx({ tipo: "desfile-nota", nucleo: codigo, marca: e.notas.length, nota, carta });
      if (d?.chave) emitirFx({ tipo: "uso-chave", nucleo: codigo, chave: d.chave, certa: nota === "CHAVE" });
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
      const carta = ref.current.armar?.(proxima) ?? undefined;
      const j = janelasDaMarca(p.risco?.lances, proxima, { seguro: p.janelaMs, ousado: p.risco?.janelaMs ?? p.janelaMs }, e.embalo, carta?.uso ?? null);
      const chave = p.risco?.lances?.chave?.marca === proxima ? p.risco.lances.chave : undefined;
      e.deixa = { marca: proxima, botao: p.botoes[proxima], desde: performance.now(), janelaMs: j.seguro, ousado: p.risco?.ousados[proxima], janelaOusadaMs: j.ousado, chave, carta };
      setDeixa(e.deixa);
      if (chave) emitirFx({ tipo: "uso-chave", nucleo: codigo, chave, certa: null });
      if (p.risco && p.risco.prazoMs > 0 && !e.prazo) {
        e.prazo = { desde: e.deixa.desde, ms: p.risco.prazoMs };
        setPrazo(e.prazo);
      }
    };
    const cancelar = assinarFx((ev) => {
      if (ev.nucleo !== codigo) return;
      // a cutscene do lance para o relógio da fase: o prazo volta a correr de onde parou
      if (ev.tipo === "cinema") e.pausa = pausar(e, !!ev.cutscene);
      if (ev.tipo === "desfile") {
        e.alcancadas = ev.alcancadas;
        abrir();
      }
      if (ev.tipo !== "desfile-botao") return;
      const p = ref.current.pedido;
      if (e.deixa && p) {
        const ms = Math.round(performance.now() - e.deixa.desde);
        fechar(notaDoToque(p, e.deixa.marca, ev.botao, ms, { embaloPct: e.embalo, carta: e.deixa.carta?.uso }), { marca: e.deixa.marca, botao: ev.botao, ms });
      } else if (!p && ev.botao === "DESFILAR") {
        emitirFx({ tipo: "desfile-pose", nucleo: codigo });
      }
    });
    // a janela fecha sozinha; sem andar, a próxima deixa vem depois de um respiro
    const relogio = window.setInterval(() => {
      const p = ref.current.pedido;
      if (e.pausa) return;
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
