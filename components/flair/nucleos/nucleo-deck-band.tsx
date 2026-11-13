"use client";
/**
 * Faixa do deck (parte de baixo do quadro) em cada momento da partida. Preparação: as abas, a fileira de cartas, as
 * ações do deck e "Entregar", o botão principal, fixo no canto direito da faixa. Ação: o que já aconteceu e o
 * acionamento do jogo. Resultado: a nota do servidor, regra a regra.
 */
import type { ReactNode } from "react";
import type { ApiError } from "@/lib/api/client";
import { NucleoControls } from "@/components/flair/nucleos/nucleo-controls";
import { NucleoResourceWindow } from "@/components/flair/nucleos/nucleo-resource-window";
import type { CardZoom } from "@/components/flair/nucleos/use-card-zoom";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import type { BoardEstado } from "@/lib/flair/nucleos/board";
import type { Comando } from "@/lib/flair/nucleos/controls";
import type { ItemDaFileira } from "@/lib/flair/nucleos/deck-row";
import { acionamentoDe, type Momento } from "@/lib/flair/nucleos/moments";
import type { ResourceTab } from "@/lib/flair/nucleos/selection";
import type { EfeitoItem, NucleoDefinicao } from "@/lib/flair/nucleos/types";

export interface NucleoDeckBandProps {
  definicao: NucleoDefinicao;
  momento: Momento;
  tabs: ResourceTab[];
  estado: BoardEstado;
  efeitos: (cardId: string) => EfeitoItem[] | undefined;
  zoom: CardZoom;
  gamepad: boolean;
  automatico: boolean;
  /** dá para entregar: há escolha e o acionamento "antes de entregar" já foi feito */
  pronto: boolean;
  entregando: boolean;
  erro: ApiError | null;
  /** aviso da última carta tocada que não cabe na vaga escolhida */
  aviso: string | null;
  onAba: (index: number) => void;
  onItem: (aba: number, item: number) => void;
  onNaoCabe: (x: ItemDaFileira) => void;
  onComando: (c: Comando) => void;
  onEntregar: () => void;
  /** painel da ação (momento 3) */
  acao: ReactNode;
  /** painel do resultado (momento 4) */
  resultado: ReactNode;
}

export function NucleoDeckBand(props: NucleoDeckBandProps) {
  const { definicao, momento, estado, pronto, entregando, erro } = props;
  const tx = useNucleoText();
  if (momento === "ACAO") return <div className="n3d-band is-action">{props.acao}</div>;
  if (momento === "RESULTADO") return <div className="n3d-band is-result">{props.resultado}</div>;

  const acionamento = acionamentoDe(definicao.codigo);
  const espelho = acionamento?.tipo === "ESPELHO";
  const resposta = acionamento?.tipo === "RESPOSTA";
  const abaDaResposta = props.tabs.findIndex((t) => t.tipo === "resposta");
  let rotulo = tx.t(espelho ? "flair3d.ui.trigger.ESPELHO.submit" : "flair3d.ui.submit");
  if (entregando) rotulo = tx.t("flair3d.ui.submitting");

  let dica: string | null = null;
  if (props.aviso) dica = props.aviso;
  else if (resposta && !estado.sel.resposta) dica = tx.t("flair3d.ui.trigger.RESPOSTA.need");
  else if (resposta && estado.sel.resposta) dica = tx.t("flair3d.ui.trigger.RESPOSTA.done", { titulo: tx.ou(`flair3d.nucleo.${definicao.codigo}.opcao.${estado.sel.resposta}`, estado.sel.resposta) });
  else if (espelho) dica = tx.t("flair3d.ui.trigger.ESPELHO.hint");
  else if (props.automatico) dica = tx.t("flair3d.ui.auto");

  const extra = (
    <div className="n3d-window-actions">
      <NucleoControls grupo="deck" acoes={definicao.acoes} gamepad={props.gamepad} onComando={props.onComando} />
      <button type="button" className="btn btn-primary n3d-submit" disabled={!pronto || entregando} onClick={props.onEntregar}>
        {rotulo}
      </button>
    </div>
  );

  return (
    <div className="n3d-band is-prep">
      <NucleoResourceWindow
        agrupar
        nucleo={definicao.codigo}
        tabs={props.tabs}
        aba={estado.aba}
        item={estado.item}
        sel={estado.sel}
        vaga={estado.vaga}
        efeitos={props.efeitos}
        zoom={props.zoom}
        extra={extra}
        onAba={props.onAba}
        onItem={props.onItem}
        onNaoCabe={props.onNaoCabe}
      />
      <div className="n3d-band-foot">
        {dica && <p className="n3d-hint" role="status" data-testid="nucleo-hint">{dica}</p>}
        {resposta && !estado.sel.resposta && abaDaResposta >= 0 && (
          <button type="button" className="btn btn-sm" onClick={() => props.onAba(abaDaResposta)}>
            {tx.t("flair3d.ui.trigger.RESPOSTA.go")}
          </button>
        )}
        {erro && <p className="n3d-error" role="alert">{tx.t("flair3d.ui.submitError", { msg: erro.message })}</p>}
      </div>
    </div>
  );
}
