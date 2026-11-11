"use client";
/**
 * Tela de jogo no layout DREST: em cima, a cena 3D com o avatar e os personagens; embaixo, o objetivo, a janela de
 * recursos com abas e ícones, os botões dos comandos e "Entregar o look". Teclado, toque e gamepad passam pelo mesmo
 * comando (use-nucleo-controls) e pela mesma redução de estado (lib/flair/nucleos/board.ts).
 */
import { useMemo, useReducer, useState } from "react";
import type { ApiError } from "@/lib/api/client";
import { useMirrorAvatar } from "@/components/mirror/mirror-stage";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import { NucleoCast } from "@/components/flair/nucleos/nucleo-cast";
import { NucleoControls } from "@/components/flair/nucleos/nucleo-controls";
import { NucleoObjective } from "@/components/flair/nucleos/nucleo-objective";
import { NucleoResourceWindow } from "@/components/flair/nucleos/nucleo-resource-window";
import { NucleoScene } from "@/components/flair/nucleos/nucleo-scene";
import { MODELO_CASA, type Protagonista } from "@/components/flair/nucleos/nucleo-avatar";
import { useNucleoControls } from "@/components/flair/nucleos/use-nucleo-controls";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { protagonistaEfetiva } from "@/lib/flair/nucleos/avatares";
import { boardInicial, boardReducer } from "@/lib/flair/nucleos/board";
import type { Comando } from "@/lib/flair/nucleos/controls";
import { pecasDoLook } from "@/lib/flair/nucleos/look";
import { NUCLEOS } from "@/lib/flair/nucleos/registry";
import { buildTabs, temEscolha, type Selecao } from "@/lib/flair/nucleos/selection";
import type { AvatarTipo, NucleoDefinicao } from "@/lib/flair/nucleos/types";

interface Props {
  definicao: NucleoDefinicao;
  cartas: FlairCollectionCard[];
  entregando: boolean;
  erro: ApiError | null;
  onEntregar: (sel: Selecao) => void;
}

export function NucleoGame({ definicao, cartas, entregando, erro, onEntregar }: Props) {
  const tx = useNucleoText();
  const config = NUCLEOS[definicao.codigo];
  const tabs = useMemo(() => buildTabs(definicao, cartas), [definicao, cartas]);
  const [estado, dispatch] = useReducer(boardReducer, undefined, () => boardInicial());
  const perfil = useMirrorAvatar();
  const [escolha, setEscolha] = useState<AvatarTipo | null>(null);
  const efetiva = protagonistaEfetiva(config.avatares.protagonista, escolha, !!perfil.avatar);
  const protagonista: Protagonista = efetiva === "PROPRIO" ? { avatar: perfil.avatar, sexo: perfil.sex, corpo: perfil.body } : MODELO_CASA;
  const pecas = useMemo(() => pecasDoLook(estado.sel.cartas, cartas), [estado.sel.cartas, cartas]);
  const pronto = temEscolha(estado.sel);

  const entregar = () => {
    if (pronto && !entregando) onEntregar(estado.sel);
  };
  const onComando = (c: Comando) => {
    if (c.acao === "ENTREGAR") entregar();
    else dispatch({ type: "comando", comando: c, tabs });
  };
  const { disparar, gamepad } = useNucleoControls({ acoes: definicao.acoes, onComando, ativo: !entregando });

  return (
    <div className="n3d-game" data-testid="nucleo-game">
      <div className="n3d-top">
        <NucleoScene config={config} avatar={estado.avatar} pecas={pecas} protagonista={protagonista} />
        {definicao.avatares && (
          <NucleoCast avatares={definicao.avatares} efetiva={efetiva} aceitos={config.avatares.protagonista} temAvatar={!!perfil.avatar} onEscolha={setEscolha} />
        )}
      </div>
      <div className="n3d-bottom">
        <NucleoObjective definicao={definicao} aberto={estado.objetivo} onToggle={() => disparar({ acao: "OBJETIVO" })} />
        <NucleoResourceWindow nucleo={definicao.codigo} tabs={tabs} aba={estado.aba} item={estado.item} sel={estado.sel}
          onAba={(index) => dispatch({ type: "aba", index })} onItem={(aba, item) => dispatch({ type: "aplicar", aba, item, tabs })} />
        <NucleoControls acoes={definicao.acoes} gamepad={gamepad} onComando={(c) => disparar(c)} />
        {config.automatico && <p className="n3d-auto">{tx.t("flair3d.ui.auto")}</p>}
        {erro && <p className="n3d-error" role="alert">{tx.t("flair3d.ui.submitError", { msg: erro.message })}</p>}
        <button type="button" className="btn btn-primary n3d-submit" disabled={!pronto || entregando} onClick={entregar}>
          {tx.t(entregando ? "flair3d.ui.submitting" : "flair3d.ui.submit")}
        </button>
      </div>
    </div>
  );
}
