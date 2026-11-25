"use client";
/**
 * Palco 3D (parte de cima do quadro): a cena do núcleo, a zona da roupa (faixa central de 40% da largura, sempre
 * livre), a camada de efeitos das cartas atrás e ao lado dela e as informações nos quatro cantos. Nenhum painel,
 * efeito ou texto entra na zona da roupa.
 */
import { useState } from "react";
import { avataresDaSala } from "@/lib/flair/nucleos/avatares";
import { CAMERA_AUTOMATICA, opcoesDeCamera } from "@/lib/flair/nucleos/camera/jogos";
import { momentoDaCamera } from "@/lib/flair/nucleos/camera/sala";
import { salaDe } from "@/lib/flair/nucleos/scene/registry";
import Link from "next/link";
import type { Look3dPiece } from "@/components/three/common";
import { NucleoActionFx } from "@/components/flair/nucleos/nucleo-action-fx";
import { NucleoBarrasDeVida } from "@/components/flair/nucleos/nucleo-barras-de-vida";
import type { Protagonista } from "@/components/flair/nucleos/nucleo-avatar";
import { NucleoCameraSelector } from "@/components/flair/nucleos/nucleo-camera-selector";
import { NucleoCardFx } from "@/components/flair/nucleos/nucleo-card-fx";
import { NucleoRodaAtributos } from "@/components/flair/nucleos/recursos/nucleo-roda-atributos";
import type { LookDosRecursos } from "@/components/flair/nucleos/recursos/use-look-dos-recursos";
import { NucleoRodaRecursos } from "@/components/flair/nucleos/recursos/nucleo-roda-recursos";
import type { RecursosNaTela } from "@/components/flair/nucleos/recursos/use-recursos-da-partida";
import { CinemaOverlay } from "@/components/flair/cinema/cinema-overlay";
import type { CinemaNaTela } from "@/components/flair/cinema/use-cinema-da-partida";
import { NucleoCast } from "@/components/flair/nucleos/nucleo-cast";
import { NucleoControls } from "@/components/flair/nucleos/nucleo-controls";
import { NucleoHud, NucleoScore } from "@/components/flair/nucleos/nucleo-hud";
import { HudIcon } from "@/components/flair/nucleos/nucleo-icons";
import { NucleoObjective } from "@/components/flair/nucleos/nucleo-objective";
import { NucleoScene } from "@/components/flair/nucleos/nucleo-scene";
import type { EntradaNaTela } from "@/components/flair/nucleos/use-card-fx";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import type { PassoAcao } from "@/lib/flair/nucleos/action-fx";
import type { AvatarEstado } from "@/lib/flair/nucleos/board";
import type { Comando } from "@/lib/flair/nucleos/controls";
import type { FxPrefs } from "@/lib/flair/nucleos/fx-sound";
import { comandoPermitido, type Momento } from "@/lib/flair/nucleos/moments";
import type { AvatarTipo, NucleoConfig, NucleoDefinicao, NucleoResultado, ZonaEscolha } from "@/lib/flair/nucleos/types";

export interface NucleoStageProps {
  definicao: NucleoDefinicao;
  config: NucleoConfig;
  momento: Momento;
  avatar: AvatarEstado;
  pecas: Look3dPiece[];
  protagonista: Protagonista;
  efetiva: AvatarTipo;
  temAvatar: boolean;
  onEscolha: (tipo: AvatarTipo) => void;
  objetivoAberto: boolean;
  /** última resposta do servidor (entrega ou acionamento); null na preparação */
  resultado: NucleoResultado | null;
  /** prévia do look de agora (preparação) */
  previa: NucleoResultado | null;
  /** sala do jogo quando ele tem mais de uma (o salão da vez, a modalidade) */
  variante?: string | null;
  /** semente da partida: o corpo de cada pessoa de cena sai dela */
  semente?: number;
  /** o que a pessoa já pintou em cada zona (modos do Ateliê) */
  zonas?: Record<string, ZonaEscolha>;
  prefs: FxPrefs;
  onPref: (campo: keyof FxPrefs) => void;
  entrada: EntradaNaTela | null;
  /** a roda de atributos da regra peça-recurso (some sem perfil, como no servidor antigo) */
  recursos?: LookDosRecursos;
  /** vida, energia, foco e moedas da partida, e as peças que dá para usar como recurso */
  usoDeRecursos?: RecursosNaTela;
  /** a cutscene na tela (faixas, legenda e pular); a câmera dela é a da cena 3D */
  cinema?: CinemaNaTela;
  reduzido: boolean;
  passos: PassoAcao[];
  mostrados: number;
  gamepad: boolean;
  onComando: (c: Comando) => void;
}

export function NucleoStage(props: NucleoStageProps) {
  const { definicao, config, momento, prefs, reduzido } = props;
  const tx = useNucleoText();
  const voltar = tx.t("flair3d.ui.back");
  const naAcao = momento === "ACAO" || momento === "RESULTADO";
  const [camera, setCamera] = useState<string>(CAMERA_AUTOMATICA);
  return (
    <div className="n3d-stage" data-testid="nucleo-stage">
      <NucleoScene config={config} avatar={props.avatar} pecas={props.pecas} protagonista={props.protagonista} resultado={props.resultado} variante={props.variante} semente={props.semente}
        camera={camera} momento={momentoDaCamera(momento)}
        zonasDaPeca={definicao.recursos.includes("ZONAS") ? definicao.zonas : undefined} zonas={props.zonas} />
      <div className="n3d-zone" aria-hidden data-testid="nucleo-zone" />
      <NucleoCardFx atual={props.entrada} reduzido={reduzido} efeitos={prefs.efeitos} />
      {props.recursos && <NucleoRodaAtributos recursos={props.recursos} reduzido={reduzido} efeitos={prefs.efeitos} />}
      {props.usoDeRecursos && <NucleoRodaRecursos recursos={props.usoDeRecursos} reduzido={reduzido} efeitos={prefs.efeitos} />}
      {props.cinema && <CinemaOverlay cinema={props.cinema} />}
      {naAcao && definicao.codigo === "DRESS_FIGHTER" && <NucleoBarrasDeVida resultado={props.resultado} />}
      {naAcao && <NucleoActionFx nucleo={definicao.codigo} variante={props.variante} passos={props.passos} mostrados={props.mostrados} reduzido={reduzido} efeitos={prefs.efeitos} />}
      <NucleoHud
        topoEsquerda={
          <>
            <Link href="/flair/3d" className="n3d-icon-btn" aria-label={voltar} title={voltar}>
              <HudIcon name="voltar" />
            </Link>
            <NucleoObjective definicao={definicao} variante={props.variante} aberto={props.objetivoAberto} onToggle={() => props.onComando({ acao: "VER_OBJETIVO" })} />
          </>
        }
        topoDireita={<NucleoScore momento={momento} resultado={props.resultado} previa={props.previa} prefs={prefs} onPref={props.onPref} />}
        baseEsquerda={
          definicao.avatares ? (
            <NucleoCast
              compacto
              avatares={avataresDaSala(definicao.avatares, salaDe(definicao.codigo, props.variante).personagens)}
              efetiva={props.efetiva}
              aceitos={config.avatares.protagonista}
              temAvatar={props.temAvatar}
              bloqueado={naAcao}
              onEscolha={props.onEscolha}
            />
          ) : null
        }
        baseDireita={
          <>
            {!reduzido && <NucleoCameraSelector opcoes={opcoesDeCamera(definicao.codigo)} atual={camera} onTrocar={setCamera} />}
            <NucleoControls grupo="camera" acoes={definicao.acoes} gamepad={props.gamepad} permitido={(a) => comandoPermitido(momento, a)} onComando={props.onComando} />
          </>
        }
      />
    </div>
  );
}
