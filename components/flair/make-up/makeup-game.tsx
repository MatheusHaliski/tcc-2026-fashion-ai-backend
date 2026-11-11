"use client";
/**
 * Tela de jogo do MAKE UP no layout DREST: o provador 3D em cima; embaixo, o objetivo, a janela de recursos com os
 * grupos Roupas (vestir a vaga) e Maquiagem (maquiar a área), os comandos (os do contrato, menos desfilar) e a entrega.
 * Reaproveita a janela de recursos, os controles e o estado da tela dos núcleos.
 */
import { useMemo, useReducer, useState } from "react";
import { cn } from "@/components/ui";
import type { ApiError } from "@/lib/api/client";
import { useMirrorAvatar } from "@/components/mirror/mirror-stage";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import { MakeUpObjective } from "@/components/flair/make-up/makeup-panels";
import { MakeUpScene } from "@/components/flair/make-up/makeup-scene";
import { MODELO_CASA, type Protagonista } from "@/components/flair/nucleos/nucleo-avatar";
import { NucleoCast } from "@/components/flair/nucleos/nucleo-cast";
import { NucleoControls } from "@/components/flair/nucleos/nucleo-controls";
import { NucleoResourceWindow } from "@/components/flair/nucleos/nucleo-resource-window";
import { useNucleoControls } from "@/components/flair/nucleos/use-nucleo-controls";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { MAKEUP_ACOES } from "@/lib/flair/make-up/briefs";
import type { BriefDefinicao } from "@/lib/flair/make-up/types";
import { protagonistaEfetiva } from "@/lib/flair/nucleos/avatares";
import { boardInicial, boardReducer } from "@/lib/flair/nucleos/board";
import type { Comando } from "@/lib/flair/nucleos/controls";
import { pecasDoLook } from "@/lib/flair/nucleos/look";
import { buildTabs, temEscolha, type ResourceTab, type Selecao } from "@/lib/flair/nucleos/selection";
import type { AvatarTipo } from "@/lib/flair/nucleos/types";

const ACEITOS: AvatarTipo[] = ["PROPRIO", "MODELO_CASA"];
type Grupo = "ROUPAS" | "MAQUIAGEM";
const grupoDe = (tab?: ResourceTab): Grupo => (tab?.tipo === "area" ? "MAQUIAGEM" : "ROUPAS");

interface Props {
  brief: BriefDefinicao;
  cartas: FlairCollectionCard[];
  entregando: boolean;
  erro: ApiError | null;
  onEntregar: (sel: Selecao) => void;
}

export function MakeUpGame({ brief, cartas, entregando, erro, onEntregar }: Props) {
  const tx = useNucleoText();
  const tabs = useMemo(() => buildTabs({ recursos: ["CARTAS", "MAQUIAGEM"], vagas: brief.vagas, zonas: [], areas: brief.areas, opcoes: [], paleta: brief.paleta }, cartas), [brief, cartas]);
  const [estado, dispatch] = useReducer(boardReducer, undefined, () => boardInicial(2, 0));
  const perfil = useMirrorAvatar();
  const [escolha, setEscolha] = useState<AvatarTipo | null>(null);
  const efetiva = protagonistaEfetiva(ACEITOS, escolha, !!perfil.avatar);
  const protagonista: Protagonista = efetiva === "PROPRIO" ? { avatar: perfil.avatar, sexo: perfil.sex, corpo: perfil.body } : MODELO_CASA;
  const pecas = useMemo(() => pecasDoLook(estado.sel.cartas, cartas), [estado.sel.cartas, cartas]);
  const grupo = grupoDe(tabs[estado.aba]);
  const pronto = temEscolha(estado.sel);

  const entregar = () => {
    if (pronto && !entregando) onEntregar(estado.sel);
  };
  const onComando = (c: Comando) => {
    if (c.acao === "ENTREGAR") entregar();
    else dispatch({ type: "comando", comando: c, tabs });
  };
  const { disparar, gamepad } = useNucleoControls({ acoes: MAKEUP_ACOES, onComando, ativo: !entregando });
  const abrirGrupo = (g: Grupo) => {
    const index = tabs.findIndex((t) => grupoDe(t) === g);
    if (index >= 0) dispatch({ type: "aba", index });
  };

  return (
    <div className="n3d-game" data-testid="makeup-game">
      <div className="n3d-top">
        <MakeUpScene avatar={estado.avatar} pecas={pecas} maquiagem={estado.sel.maquiagem} protagonista={protagonista} />
        <NucleoCast avatares={{ solo: [{ tipo: efetiva, papel: "protagonista", quantidade: 1 }], online: null }} efetiva={efetiva} aceitos={ACEITOS}
          temAvatar={!!perfil.avatar} onEscolha={setEscolha} />
      </div>
      <div className="n3d-bottom">
        <MakeUpObjective brief={brief} aberto={estado.objetivo} onToggle={() => disparar({ acao: "OBJETIVO" })} />
        <div className="mk-resources">
          <div className="mk-groups" role="group" aria-label={tx.t("flair3d.makeup.groups")}>
            {(["ROUPAS", "MAQUIAGEM"] as Grupo[]).map((g) => (
              <button key={g} type="button" className={cn("btn btn-sm", grupo === g && "btn-primary")} aria-pressed={grupo === g} onClick={() => abrirGrupo(g)}>
                {tx.t(`flair3d.makeup.group.${g}`)}
              </button>
            ))}
          </div>
          <p className="mk-effect">{tx.t(`flair3d.makeup.effect.${grupo}`)}</p>
          <NucleoResourceWindow nucleo="ROAD_TO_GLORY" tabs={tabs} aba={estado.aba} item={estado.item} sel={estado.sel} mostrar={(t) => grupoDe(t) === grupo}
            onAba={(index) => dispatch({ type: "aba", index })} onItem={(aba, item) => dispatch({ type: "aplicar", aba, item, tabs })} />
        </div>
        <NucleoControls acoes={MAKEUP_ACOES} gamepad={gamepad} onComando={(c) => disparar(c)} />
        {erro && <p className="n3d-error" role="alert">{tx.t("flair3d.ui.submitError", { msg: erro.message })}</p>}
        <button type="button" className="btn btn-primary n3d-submit" disabled={!pronto || entregando} onClick={entregar}>
          {tx.t(entregando ? "flair3d.ui.submitting" : "flair3d.ui.submit")}
        </button>
      </div>
    </div>
  );
}
