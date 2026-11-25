"use client";
/**
 * O palco do Fashion Sports durante a partida: a transmissão (3D com WebGL; sem ele, o campo visto de cima, em SVG, com
 * os mesmos jogadores e a mesma bola) e, por cima, o placar de TV com os times, o placar, o relógio e o tempo. A linha
 * de narração do lance fica embaixo, fora do meio do campo. Enquanto o estádio carrega, a tela de carga
 * (esporte-carga.tsx) cobre o palco com a arte do campo e o que está sendo carregado. Com "reduzir movimento" a câmera não viaja e o campo mostra
 * o fim de cada lance, parado.
 */
import dynamic from "next/dynamic";
import Link from "next/link";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion, useWebGL } from "@/components/three/common";
import { HudIcon } from "@/components/flair/nucleos/nucleo-icons";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { jogadorEmTexto, narracao, nomeDoTime, tempoEmTexto } from "@/components/flair/esporte/esporte-texto";
import { EsporteCarga } from "@/components/flair/esporte/esporte-carga";
import { EsporteMomento } from "@/components/flair/esporte/esporte-momento";
import { NucleoCameraSelector } from "@/components/flair/nucleos/nucleo-camera-selector";
import { CAMERAS_DO_CAMPO, planoDaCamera } from "@/lib/flair/esporte/camera";
import { carregando, type EtapaDaCarga } from "@/lib/flair/esporte/carga";
import { campoDe, UNIFORME_VISITANTE, type Campo, type Uniforme } from "@/lib/flair/esporte/campo";
import { quadroDoLance } from "@/lib/flair/esporte/timeline";
import { relogioEmTexto, type Jogada } from "@/lib/flair/esporte/types";

const Transmissao3D = dynamic(() => import("@/components/flair/esporte/transmissao-3d"), { ssr: false, loading: () => null });

class Limite extends Component<{ children: ReactNode; reserva: ReactNode }, { falhou: boolean }> {
  state = { falhou: false };
  static getDerivedStateFromError() {
    return { falhou: true };
  }
  render() {
    return this.state.falhou ? this.props.reserva : this.props.children;
  }
}

/** O campo visto de cima (sem WebGL): os dois times, a bola e as linhas, no fim do lance da vez. */
export function CampoEmPlanta({ campo, anterior, atual, uniforme, rotulo }: { campo: Campo; anterior: Jogada | null; atual: Jogada | null; uniforme: Uniforme; rotulo: string }) {
  const tx = useNucleoText();
  const quadro = quadroDoLance(campo, anterior, atual, 1);
  return (
    <svg className="fsp-planta" viewBox="-4 -4 108 68" role="img" aria-label={rotulo} data-testid="esporte-planta">
      <rect x={0} y={0} width={100} height={60} fill={campo.piso} stroke={campo.linha} strokeWidth={0.6} />
      <line x1={50} y1={0} x2={50} y2={60} stroke={campo.linha} strokeWidth={0.5} />
      {quadro.figuras.map((f) => (
        <circle key={`${f.time}-${f.n}`} cx={f.x} cy={f.y} r={1.9} fill={f.time === "NOS" ? uniforme.camisa : UNIFORME_VISITANTE.camisa} stroke="#11141A" strokeWidth={0.4}
          data-time={f.time} data-jogador={f.n} data-gesto={f.gesto} data-estado={f.estado}>
          <title>{jogadorEmTexto(tx, f.time, f.n, f.estado)}</title>
        </circle>
      ))}
      {campo.bola && <circle cx={quadro.bola.x} cy={quadro.bola.y} r={1} fill="#F4F7F2" stroke="#11141A" strokeWidth={0.3} data-testid="esporte-bola" />}
    </svg>
  );
}

interface Props {
  modalidade: string;
  /** os lances que já apareceram, na ordem */
  jogadas: Jogada[];
  /** quanto dura cada lance na tela, em ms */
  duracao: number;
  uniforme: Uniforme;
  /** a partida fechou: o placar mostra "fim de jogo" */
  fim: boolean;
  /** semente da partida: o elenco de cada time sai dela */
  semente?: number;
  /** o que a tela de jogo põe por cima do campo (a roda de recursos da regra peça-recurso) */
  children?: ReactNode;
}

/** A câmera escolhida no seletor (vale enquanto a partida está na tela). */
function useCameraDoCampo() {
  return useState<string>(CAMERAS_DO_CAMPO[0]);
}

export function EsportePalco({ modalidade, jogadas, duracao, uniforme, fim, semente, children }: Props) {
  const tx = useNucleoText();
  const webgl = useWebGL();
  const reduzido = useReducedMotion();
  const [camera, setCamera] = useCameraDoCampo();
  /** a carga do estádio: a cena 3D chegando, o campo sendo montado e, no primeiro quadro, pronta */
  const [etapa, setEtapa] = useState<EtapaDaCarga>("ESTADIO");
  const campo = campoDe(modalidade);
  const atual = jogadas[jogadas.length - 1] ?? null;
  const anterior = jogadas[jogadas.length - 2] ?? null;
  /** quando o lance da vez entrou na tela */
  const inicio = useRef(0);
  const visto = useRef(-1);
  if (visto.current !== jogadas.length) {
    visto.current = jogadas.length;
    inicio.current = typeof performance !== "undefined" ? performance.now() : 0;
  }
  // o relógio da TV anda durante o lance (meia jogada por lance), parado com "reduzir movimento"
  const [agora, setAgora] = useState(0);
  useEffect(() => {
    if (reduzido || !atual) return;
    const timer = window.setInterval(() => setAgora(performance.now()), 250);
    return () => window.clearInterval(timer);
  }, [reduzido, atual]);
  const k = reduzido || !atual ? 1 : Math.max(0, Math.min(1, (Math.max(agora, inicio.current) - inicio.current) / Math.max(1, duracao)));
  const relogio = quadroDoLance(campo, anterior, atual, k).relogio;
  const [nos, eles] = (atual?.placar ?? "0-0").split("-");
  const rotulo = tx.t("flair3d.esporte.cena", { modalidade: tx.ou(`flair3d.nucleo.FASHION_SPORTS.opcao.${modalidade}`, modalidade) });
  const planta = <CampoEmPlanta campo={campo} anterior={anterior} atual={atual} uniforme={uniforme} rotulo={rotulo} />;
  const voltar = tx.t("flair3d.ui.back");
  return (
    <div className="n3d-stage fsp-palco" data-testid="esporte-palco" data-modalidade={modalidade} data-plano={camera === CAMERAS_DO_CAMPO[0] || reduzido ? planoDaCamera(atual, k, reduzido) : camera}>
      {webgl === false || reduzido ? planta : webgl === null ? <div className="n3d-scene2d" role="status">{tx.t("flair3d.ui.scene.loading")}</div> : (
        <Limite reserva={planta}>
          <div className="n3d-scene3d">
            <Transmissao3D campo={campo} anterior={anterior} atual={atual} inicio={inicio.current} duracao={duracao} reduzido={reduzido} uniforme={uniforme} rotulo={rotulo} camera={camera} semente={semente} fim={fim} onEtapa={setEtapa} />
          </div>
          {carregando(etapa) && <EsporteCarga etapa={etapa} modalidade={modalidade} campo={campo} uniforme={uniforme} />}
        </Limite>
      )}
      <Link href="/flair/3d" className="n3d-icon-btn fsp-voltar" aria-label={voltar} title={voltar}>
        <HudIcon name="voltar" />
      </Link>
      {webgl && !reduzido && <NucleoCameraSelector className="fsp-camera" opcoes={[...CAMERAS_DO_CAMPO]} atual={camera} onTrocar={setCamera} />}
      <div className="fsp-placar" role="status" aria-live="off" data-testid="esporte-placar">
        <span className="fsp-time"><i style={{ background: uniforme.camisa }} aria-hidden />{nomeDoTime(tx, "NOS")}</span>
        <strong className="fsp-gols tabular">{nos} <span aria-hidden>×</span> {eles}</strong>
        <span className="fsp-time"><i style={{ background: UNIFORME_VISITANTE.camisa }} aria-hidden />{nomeDoTime(tx, "ELES")}</span>
        <span className="fsp-relogio tabular" data-testid="esporte-relogio">{relogioEmTexto(relogio)}</span>
        <span className="fsp-tempo">{fim ? tx.t("flair3d.esporte.fim") : tempoEmTexto(tx, modalidade, atual?.tempo ?? 1)}</span>
        <span className="fsp-unidade">{tx.ou(`flair3d.ui.modalidade.unidade.${modalidade}`, "")}</span>
        {atual?.parcial && !fim && (
          <span className="fsp-parcial tabular" data-testid="esporte-parcial">{tx.t("flair3d.esporte.parcial", { n: atual.tempo, nos: atual.parcial.split("-")[0], eles: atual.parcial.split("-")[1] })}</span>
        )}
      </div>
      <EsporteMomento modalidade={modalidade} jogadas={jogadas} fim={fim} />
      {atual && <p className="fsp-narracao" data-testid="esporte-narracao">{narracao(tx, modalidade, atual)}</p>}
      {children}
    </div>
  );
}
