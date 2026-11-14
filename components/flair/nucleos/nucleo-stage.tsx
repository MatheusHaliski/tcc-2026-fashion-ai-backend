"use client";
/**
 * Palco 3D (parte de cima do quadro): a cena do núcleo, a zona da roupa (faixa central de 40% da largura, sempre
 * livre), a camada de efeitos das cartas atrás e ao lado dela e as informações nos quatro cantos. Nenhum painel,
 * efeito ou texto entra na zona da roupa.
 */
import { avataresDaSala } from "@/lib/flair/nucleos/avatares";
import { salaDe } from "@/lib/flair/nucleos/scene/registry";
import Link from "next/link";
import type { Look3dPiece } from "@/components/three/common";
import { NucleoActionFx } from "@/components/flair/nucleos/nucleo-action-fx";
import type { Protagonista } from "@/components/flair/nucleos/nucleo-avatar";
import { NucleoCardFx } from "@/components/flair/nucleos/nucleo-card-fx";
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
import type { AvatarTipo, NucleoConfig, NucleoDefinicao, NucleoResultado } from "@/lib/flair/nucleos/types";

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
  prefs: FxPrefs;
  onPref: (campo: keyof FxPrefs) => void;
  entrada: EntradaNaTela | null;
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
  return (
    <div className="n3d-stage" data-testid="nucleo-stage">
      <NucleoScene config={config} avatar={props.avatar} pecas={props.pecas} protagonista={props.protagonista} resultado={props.resultado} variante={props.variante} />
      <div className="n3d-zone" aria-hidden data-testid="nucleo-zone" />
      <NucleoCardFx atual={props.entrada} reduzido={reduzido} efeitos={prefs.efeitos} />
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
          <NucleoControls
            grupo="camera"
            acoes={definicao.acoes}
            gamepad={props.gamepad}
            permitido={(a) => comandoPermitido(momento, a)}
            onComando={props.onComando}
          />
        }
      />
    </div>
  );
}
