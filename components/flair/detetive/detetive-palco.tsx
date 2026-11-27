"use client";
/**
 * O palco do Fashion Detective durante a investigação (docs/flair/flair-3d/FASHION_DETECTIVE_HISTORIA.md), no perfil
 * de controles console: a sala em 3D ocupa a tela toda abaixo do cabeçalho (T ou o botão: tela cheia de verdade), com
 * o HUD mínimo (detetive-hud.tsx), os painéis laterais recolhíveis com o caso, o mapa, as pistas, as ações, a mão e o
 * inventário (detetive-paineis.tsx), a roda de recursos no X, a ajuda no ?, os avisos curtos e as cutscenes com
 * legenda. Sem WebGL ou com "reduzir movimento", a planta 2D no lugar da cena. Toda ação vai pelo `onAcao` de sempre.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import type { ApiError } from "@/lib/api/client";
import type { Look3dPiece } from "@/components/three/common";
import { useReducedMotion, useWebGL } from "@/components/three/common";
import type { Protagonista } from "@/components/flair/nucleos/nucleo-avatar";
import { AjudaDeControles } from "@/components/flair/nucleos/console/ajuda-de-controles";
import { IconeConsole } from "@/components/flair/nucleos/console/icone-console";
import { PainelLateral } from "@/components/flair/nucleos/console/painel-lateral";
import { RodaRadial } from "@/components/flair/nucleos/console/roda-radial";
import { useAvisoCurto } from "@/components/flair/nucleos/console/use-aviso-curto";
import { usePaineisLaterais } from "@/components/flair/nucleos/console/use-paineis-laterais";
import { useTelaCheia } from "@/components/flair/nucleos/console/use-tela-cheia";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { DetetiveCutscene } from "@/components/flair/detetive/detetive-cutscene";
import { DetetiveHud, ICONE_DO_RECURSO } from "@/components/flair/detetive/detetive-hud";
import { DetetivePainel, type CartaDoDetetive } from "@/components/flair/detetive/detetive-painel";
import { abasDaMochila, abasDoCaso } from "@/components/flair/detetive/detetive-paineis";
import { DetetivePlanta } from "@/components/flair/detetive/detetive-planta";
import { useDetetiveConsole } from "@/components/flair/detetive/use-detetive-console";
import { vizinhos as vizinhosDe } from "@/lib/flair/detetive/acoes";
import { ARSENAL, arsenalDaMao } from "@/lib/flair/detetive/console";
import type { Retrato } from "@/lib/flair/detetive/types";

const Cena3D = dynamic(() => import("@/components/flair/detetive/detetive-cena-3d"), { ssr: false, loading: () => null });
export const CAMERAS_DO_DETETIVE = ["EXPLORACAO", "ISOMETRICA", "AEREA"];
const AJUDA = ["MOVER", "CORRER", "INTERAGIR", "MIRAR", "DISPARAR", "RODA", "PEGAR", "TELA_CHEIA", "PAUSA", "PAINEIS", "AJUDA"];
const ROTULOS = { DISPARAR: "flair3d.detetive.tela.ajuda.usar", PAUSA: "flair3d.detetive.tela.ajuda.fechar" };

interface Props {
  r: Retrato;
  pecas: Look3dPiece[];
  protagonista: Protagonista;
  semente: number;
  ocupado: boolean;
  onAcao: (alvo: string, cardId?: string) => void;
  /** a mão de cartas (cada carta com a ação da cor) e a recusa do último acionamento */
  mao?: CartaDoDetetive[];
  erro?: ApiError | null;
  /** a investigação em andamento: o palco cobre a tela abaixo do cabeçalho (no resultado, fica no quadro) */
  telaPropria?: boolean;
  /** o que a tela de jogo põe no palco (a roda de recursos da regra peça-recurso), no inventário */
  children?: ReactNode;
}

export function DetetivePalco({ r, pecas, protagonista, semente, ocupado, onAcao, mao = [], erro = null, telaPropria = false, children }: Props) {
  const tx = useNucleoText();
  const webgl = useWebGL();
  const reduzido = useReducedMotion();
  const raiz = useRef<HTMLDivElement>(null);
  const telaCheia = useTelaCheia(raiz);
  const paineis = usePaineisLaterais({ esquerda: "caso", direita: "acoes" });
  const [aviso, avisar] = useAvisoCurto();
  const [cena, setCena] = useState<string | null>(r.cutscene);
  const [ultimaCena, setUltimaCena] = useState<string | null>(r.cutscene);
  const [camera, setCamera] = useState(CAMERAS_DO_DETETIVE[0]);
  useEffect(() => {
    if (!r.cutscene) return;
    setCena(r.cutscene);
    setUltimaCena(r.cutscene);
  }, [r.cutscene]);
  // o aviso do servidor vira o aviso curto (o texto inteiro fica no painel do caso); a recusa também
  const ultimo = r.avisos[r.avisos.length - 1];
  useEffect(() => {
    if (!ultimo) return;
    const codigo = ultimo.split(":")[0];
    avisar(tx.ou(`flair3d.detetive.tela.toast.${codigo}`, tx.t("flair3d.detetive.tela.toast.padrao")), codigo === "VISTO" || codigo === "PEGO" ? "alerta" : "info");
  }, [ultimo, r.tempo, avisar, tx]);
  useEffect(() => {
    if (erro) avisar(tx.t("flair3d.detetive.tela.recusada"), "alerta");
  }, [erro, avisar, tx]);
  const cartas = mao.map((c) => ({ id: c.card.id, acao: c.acao }));
  const planta = webgl === false || reduzido;
  const ativo = !r.final && !cena;
  const ctl = useDetetiveConsole({ r, mao: cartas, ocupado, ativo, planta, paineis, telaCheia, onAcao,
    onSemCarta: (cor) => avisar(tx.t("flair3d.detetive.tela.semCarta", { recurso: tx.ou(`flair3d.detetive.tela.recurso.${cor}`, cor) }), "alerta") });
  const vizinhos = vizinhosDe(r);
  const ir = (ponto: string) => {
    if (!ocupado && !r.final) onAcao(`IR:${ponto}`);
  };
  const andar = webgl === true && !reduzido && !ocupado && ativo && !ctl.roda.aberta && !ctl.ajuda;
  const arsenal = arsenalDaMao(cartas);
  const destaque = ctl.mirando ? ctl.alvo && { x: ctl.alvo.x, z: ctl.alvo.z, mira: true } : ctl.perto && { x: ctl.perto.x, z: ctl.perto.z, mira: false };
  const rotulo = tx.t("flair3d.detetive.ui.cena3d", { sala: tx.t(`flair3d.detetive.sala.${r.sala}`) });
  const classes = ["n3d-stage", "dtv-palco", telaPropria && "cst-palco", telaCheia.cheia && !telaCheia.nativa && "is-imersivo", (ctl.roda.aberta || ctl.ajuda) && "is-lenta"].filter(Boolean).join(" ");
  return (
    <div ref={raiz} className={classes} data-testid="detetive-palco" data-sala={r.sala} data-ponto={r.ponto} data-mirando={ctl.mirando || undefined}>
      <div className="cst-cena">
        {planta ? <DetetivePlanta r={r} vizinhos={vizinhos} onIr={ir} /> : webgl === null ? <div className="n3d-scene2d" role="status">{tx.t("flair3d.ui.scene.loading")}</div> : (
          <Cena3D r={r} vizinhos={vizinhos} onIr={ir} pecas={pecas} protagonista={protagonista} reduzido={reduzido} camera={camera} semente={semente} rotulo={rotulo} cutscene={cena} andar={andar}
            mirando={ctl.mirando} destaque={destaque} pausado={ctl.roda.aberta || ctl.ajuda} />
        )}
      </div>
      {!cena && <DetetiveHud r={r} ctl={ctl} usos={(a) => arsenal.find((x) => x.acao === a)?.cartas.length ?? 0} aviso={aviso} telaCheia={telaCheia} andar={andar} />}
      {!cena && (
        <>
          <PainelLateral lado="esquerda" titulo={tx.t("flair3d.detetive.tela.painel.caso")} icone="painel" tecla="C" paineis={paineis}
            abas={abasDoCaso({ r, camera: webgl && !reduzido ? { opcoes: CAMERAS_DO_DETETIVE, atual: camera, onTrocar: setCamera } : null, onRever: ultimaCena ? () => setCena(ultimaCena) : null }, tx.t)} />
          <PainelLateral lado="direita" titulo={tx.t("flair3d.detetive.tela.painel.mochila")} icone="mochila" tecla="I" paineis={paineis}
            abas={abasDaMochila(r, cartas, <DetetivePainel r={r} mao={mao} ocupado={ocupado} erro={erro} onAcao={onAcao} />, children, tx.t)} />
        </>
      )}
      {ctl.roda.aberta && (
        <RodaRadial foco={ctl.roda.foco} onFoco={(foco) => ctl.setRoda((x) => ({ ...x, foco }))} onEscolher={ctl.equipar} rotulo={tx.t("flair3d.console.roda")} reduzido={reduzido}
          itens={ARSENAL.map((a, i) => ({ id: a, nome: tx.t(`flair3d.detetive.tela.recurso.${a}`), icone: <IconeConsole nome={ICONE_DO_RECURSO[a]} tamanho={40} />, usos: `×${arsenal[i].cartas.length}`, habilitado: arsenal[i].cartas.length > 0, equipado: ctl.equipada === a }))} />
      )}
      {ctl.ajuda && <AjudaDeControles acoes={AJUDA} rotulos={ROTULOS} onFechar={() => ctl.setAjuda(false)} />}
      {cena && <DetetiveCutscene cena={cena} reduzido={reduzido} onFechar={() => setCena(null)} />}
    </div>
  );
}
