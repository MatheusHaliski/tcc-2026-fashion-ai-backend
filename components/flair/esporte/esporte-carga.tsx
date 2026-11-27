"use client";
/**
 * A tela de carga do estádio (Fashion Sports): no lugar da tela vazia entre o vestiário e a partida, uma arte do campo
 * com as cores dos dois times e a lista do que está sendo carregado agora (lib/flair/esporte/carga.ts). Cobre o palco
 * até o primeiro quadro da transmissão; o placar de TV continua por cima.
 */
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { nomeDoTime } from "@/components/flair/esporte/esporte-texto";
import { linhasDaCarga, type EtapaDaCarga } from "@/lib/flair/esporte/carga";
import { UNIFORME_VISITANTE, type Campo, type Uniforme } from "@/lib/flair/esporte/campo";

interface Props {
  etapa: EtapaDaCarga;
  modalidade: string;
  campo: Campo;
  uniforme: Uniforme;
}

/** A camisa de um time, desenhada com a cor dele. */
function Camisa({ x, cor }: { x: number; cor: string }) {
  return <path d={`M${x} 14 l8 -5 l6 3 l6 -3 l8 5 l-4 7 l-4 -2 v16 h-12 v-16 l-4 2 z`} fill={cor} stroke="#11141A" strokeWidth={1} />;
}

export function EsporteCarga({ etapa, modalidade, campo, uniforme }: Props) {
  const tx = useNucleoText();
  const nome = tx.ou(`flair3d.nucleo.FASHION_SPORTS.opcao.${modalidade}`, modalidade);
  const linhas = linhasDaCarga(etapa);
  const atual = linhas.find((l) => l.estado === "agora");
  return (
    <div className="fsp-carga" role="status" aria-live="polite" data-testid="esporte-carga" data-etapa={etapa}>
      <svg className="fsp-carga-arte" viewBox="0 0 200 110" aria-hidden>
        <path d="M38 40 H162 L192 104 H8 Z" fill={campo.piso} stroke={campo.linha} strokeWidth={1.5} />
        <path d="M100 40 V104" stroke={campo.linha} strokeWidth={1.2} />
        <ellipse cx={100} cy={72} rx={22} ry={9} fill="none" stroke={campo.linha} strokeWidth={1.2} />
        <Camisa x={32} cor={uniforme.camisa} />
        <Camisa x={140} cor={UNIFORME_VISITANTE.camisa} />
        {campo.bola && <circle className="fsp-carga-bola" cx={100} cy={70} r={5} fill={campo.bolaCor} stroke="#11141A" strokeWidth={1} />}
      </svg>
      <h2 className="fsp-carga-titulo">{tx.t("flair3d.esporte.carga.titulo")}</h2>
      <p className="fsp-carga-jogo">{tx.t("flair3d.esporte.carga.jogo", { modalidade: nome, nos: nomeDoTime(tx, "NOS"), eles: nomeDoTime(tx, "ELES") })}</p>
      <ol className="fsp-carga-passos">
        {linhas.map((l) => (
          <li key={l.passo} className={`is-${l.estado}`} data-passo={l.passo} data-estado={l.estado}>
            <span aria-hidden>{l.estado === "feito" ? "✓" : l.estado === "agora" ? "…" : "·"}</span>
            {tx.t(`flair3d.esporte.carga.passo.${l.passo}`)}
            <span className="sr-only"> ({tx.t(`flair3d.esporte.carga.estado.${l.estado}`)})</span>
          </li>
        ))}
      </ol>
      <div className="fsp-carga-barra" aria-hidden><i /></div>
      {atual && <p className="fsp-carga-agora">{tx.t("flair3d.esporte.carga.agora", { passo: tx.t(`flair3d.esporte.carga.passo.${atual.passo}`) })}</p>}
    </div>
  );
}
