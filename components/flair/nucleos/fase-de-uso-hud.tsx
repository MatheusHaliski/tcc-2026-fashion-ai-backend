"use client";
/**
 * A fase de uso dos jogos de zonas na tela (Flair3dFaseDeUso.java): a estreia em campo, o show, a volta de classificação
 * e a missão com drones. Em cada marca a deixa mostra os dois lances — o seguro, com a janela inteira, e o ousado, com a
 * janela curta e o que ele gasta do recurso — e o prazo da fase esvazia numa barra. Só desenha: quem conta o tempo e
 * confere os botões é use-execucao-do-desfile.ts, e a nota é a do servidor.
 */
import type { CSSProperties } from "react";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import type { Deixa, Prazo } from "@/components/flair/nucleos/use-execucao-do-desfile";
import { GLIFO } from "@/lib/flair/nucleos/movimento/execucao";
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";

/** Os nomes dos dois lances no jogo ("poupar" e "acelerar" na volta do piloto). */
export function lancesDoJogo(tx: ReturnType<typeof useNucleoText>, codigo: NucleoCodigo) {
  return {
    seguro: tx.ou(`flair3d.uso.seguro.${codigo}`, tx.t("flair3d.uso.seguro.padrao")),
    ousado: tx.ou(`flair3d.uso.ousado.${codigo}`, tx.t("flair3d.uso.ousado.padrao")),
  };
}

/** Os dois botões da deixa, cada um com o anel da própria janela; o ousado leva o custo. */
export function DeixaDeUso({ codigo, deixa, custo }: { codigo: NucleoCodigo; deixa: Deixa; custo: number }) {
  const tx = useNucleoText();
  const lances = lancesDoJogo(tx, codigo);
  if (!deixa.ousado) return null;
  const seguro = { "--n3d-janela": `${deixa.janelaMs}ms` } as CSSProperties;
  const ousado = { "--n3d-janela": `${deixa.janelaOusadaMs ?? deixa.janelaMs}ms` } as CSSProperties;
  return (
    <span key={deixa.marca} className="n3d-lances" aria-hidden data-testid="deixa-de-uso">
      <span className="n3d-lance">
        <span className="n3d-deixa" style={seguro}>{GLIFO[deixa.botao]}</span>
        <small>{lances.seguro}</small>
      </span>
      <span className="n3d-lance" data-ousado>
        <span className="n3d-deixa" style={ousado}>{GLIFO[deixa.ousado]}</span>
        <small>{lances.ousado} <b>−{custo}</b></small>
      </span>
    </span>
  );
}

/** A barra do prazo da fase, que esvazia sozinha (animação de CSS com a duração do prazo). */
export function PrazoDaFase({ prazo, parado }: { prazo: Prazo | null; parado: boolean }) {
  const tx = useNucleoText();
  if (!prazo) return null;
  const estilo = { "--n3d-prazo": `${prazo.ms}ms` } as CSSProperties;
  return (
    <span className="n3d-prazo" data-testid="prazo-da-fase" data-parado={parado || undefined} title={tx.t("flair3d.uso.prazo", { s: Math.round(prazo.ms / 1000) })}>
      <span style={estilo} />
    </span>
  );
}
