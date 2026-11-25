"use client";
/**
 * O palco do Fashion Detective durante a investigação (docs/flair/flair-3d/FASHION_DETECTIVE_HISTORIA.md): a sala em 3D
 * com a câmera de exploração (ou a planta em 2D, sem WebGL ou com "reduzir movimento"), o HUD de cima (voltar, vida,
 * relógio, "Pistas N de 12", mapa, inventário, câmera), o aviso do último passo, as cutscenes com legenda e as folhas do
 * caso. O que a pessoa faz com as cartas fica na faixa de baixo (detetive-painel.tsx).
 */
import { useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { Look3dPiece } from "@/components/three/common";
import { useReducedMotion, useWebGL } from "@/components/three/common";
import type { Protagonista } from "@/components/flair/nucleos/nucleo-avatar";
import { NucleoCameraSelector } from "@/components/flair/nucleos/nucleo-camera-selector";
import { HudIcon } from "@/components/flair/nucleos/nucleo-icons";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { DetetiveCutscene } from "@/components/flair/detetive/detetive-cutscene";
import { DetetiveFolha, type Folha } from "@/components/flair/detetive/detetive-folhas";
import { DetetivePlanta } from "@/components/flair/detetive/detetive-planta";
import { useEixoDeAndar } from "@/components/flair/nucleos/use-eixo-de-andar";
import { vizinhos as vizinhosDe } from "@/lib/flair/detetive/acoes";
import { relogio, type Retrato } from "@/lib/flair/detetive/types";

const Cena3D = dynamic(() => import("@/components/flair/detetive/detetive-cena-3d"), { ssr: false, loading: () => null });
export const CAMERAS_DO_DETETIVE = ["EXPLORACAO", "ISOMETRICA", "AEREA"];

interface Props {
  r: Retrato;
  pecas: Look3dPiece[];
  protagonista: Protagonista;
  semente: number;
  ocupado: boolean;
  onAcao: (alvo: string, cardId?: string) => void;
  /** o que a tela de jogo põe por cima da sala (a roda de recursos da regra peça-recurso) */
  children?: ReactNode;
}

/** O texto do aviso do último passo ("VISTO:SEG_SALAO" → "Um segurança viu você..."). */
function useAviso(r: Retrato): string | null {
  const tx = useNucleoText();
  const a = r.avisos[r.avisos.length - 1];
  if (!a) return null;
  const [codigo, assunto = ""] = a.split(":");
  const nome = assunto.startsWith("P") && assunto.length <= 3 ? assunto : tx.ou(`flair3d.detetive.chave.${assunto}`, tx.ou(`flair3d.detetive.compra.${assunto}`, assunto));
  return tx.ou(`flair3d.detetive.aviso.${codigo}`, codigo, { assunto: nome });
}

export function DetetivePalco({ r, pecas, protagonista, semente, ocupado, onAcao, children }: Props) {
  const tx = useNucleoText();
  const webgl = useWebGL();
  const reduzido = useReducedMotion();
  const [folha, setFolha] = useState<Folha | null>(null);
  const [cena, setCena] = useState<string | null>(r.cutscene);
  const [ultimaCena, setUltimaCena] = useState<string | null>(r.cutscene);
  const [camera, setCamera] = useState(CAMERAS_DO_DETETIVE[0]);
  useEffect(() => {
    if (!r.cutscene) return;
    setCena(r.cutscene);
    setUltimaCena(r.cutscene);
  }, [r.cutscene]);
  const vizinhos = vizinhosDe(r);
  const ir = (ponto: string) => {
    if (!ocupado && !r.final) onAcao(`IR:${ponto}`);
  };
  const aviso = useAviso(r);
  // WASD e o analógico levam a detetive pela sala (as setas ficam com as ações da faixa de baixo)
  const andar = webgl === true && !reduzido && !ocupado && !r.final && !cena && !folha;
  useEixoDeAndar(andar);
  const planta = <DetetivePlanta r={r} vizinhos={vizinhos} onIr={ir} />;
  const rotulo = tx.t("flair3d.detetive.ui.cena3d", { sala: tx.t(`flair3d.detetive.sala.${r.sala}`) });
  const voltar = tx.t("flair3d.ui.back");
  return (
    <div className="n3d-stage dtv-palco" data-testid="detetive-palco" data-sala={r.sala} data-ponto={r.ponto}>
      {webgl === false || reduzido ? planta : webgl === null ? <div className="n3d-scene2d" role="status">{tx.t("flair3d.ui.scene.loading")}</div> : (
        <div className="n3d-scene3d">
          <Cena3D r={r} vizinhos={vizinhos} onIr={ir} pecas={pecas} protagonista={protagonista} reduzido={reduzido} camera={camera} semente={semente} rotulo={rotulo} cutscene={cena} andar={andar} />
        </div>
      )}
      <div className="dtv-hud" role="status" aria-live="off">
        <Link href="/flair/3d" className="n3d-icon-btn" aria-label={voltar} title={voltar}><HudIcon name="voltar" /></Link>
        <span className="dtv-sala">{tx.t(`flair3d.detetive.sala.${r.sala}`)}</span>
        <span className="dtv-vida" aria-label={tx.t("flair3d.detetive.ui.vida", { n: r.vida })}>{"●".repeat(r.vida)}<i>{"○".repeat(Math.max(0, (r.vidaMaxima ?? 3) - r.vida))}</i></span>
        <span className="dtv-relogio tabular" aria-label={tx.t("flair3d.detetive.ui.tempo")}>{relogio(r.tempo)}</span>
        {r.escondido && <span className="dtv-escondido">{tx.t("flair3d.detetive.ui.escondido")}</span>}
        {r.doLook && <span className="dtv-look" data-testid="detetive-look">{tx.t("flair3d.detetive.ui.doLook", { vida: r.doLook.vidaMaxima, cone: r.doLook.alcance, passo: r.doLook.segundosPorPasso })}</span>}
      </div>
      <div className="dtv-hud-botoes">
        <button type="button" className="btn btn-sm dtv-btn" onClick={() => setFolha("CADERNO")} data-testid="detetive-abre-caderno">{tx.t("flair3d.detetive.ui.pistas", { n: r.pistas.length, total: r.totalDePistas })}</button>
        <button type="button" className="btn btn-sm dtv-btn" onClick={() => setFolha("MAPA")}>{tx.t("flair3d.detetive.ui.mapa")}</button>
        <button type="button" className="btn btn-sm dtv-btn" onClick={() => setFolha("INVENTARIO")}>{tx.t("flair3d.detetive.ui.inventario")}</button>
        {ultimaCena && !cena && <button type="button" className="btn btn-sm dtv-btn" onClick={() => setCena(ultimaCena)}>{tx.t("flair3d.detetive.ui.reverCena")}</button>}
        {webgl && !reduzido && <NucleoCameraSelector opcoes={CAMERAS_DO_DETETIVE} atual={camera} onTrocar={setCamera} />}
      </div>
      {aviso && !cena && <p className="dtv-aviso" role="status" data-testid="detetive-aviso">{aviso}</p>}
      {cena && <DetetiveCutscene cena={cena} reduzido={reduzido} onFechar={() => setCena(null)} />}
      {folha && <DetetiveFolha folha={folha} r={r} onFechar={() => setFolha(null)} />}
      {children}
    </div>
  );
}
