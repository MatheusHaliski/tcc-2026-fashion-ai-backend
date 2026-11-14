"use client";
/**
 * Deck e recursos (faixa de baixo do quadro): as abas de recurso logo acima e UMA fileira de itens que rola para os
 * lados. Com `agrupar`, as vagas de carta viram a aba "Roupas" e a régua de vagas escolhe a vaga (`vaga`): a carta
 * que não cabe fica com 40% de opacidade e continua tocável. Sem `agrupar` (MAKE UP), cada aba mostra os seus itens.
 * O item em foco segue a navegação do controle; clicar aplica direto. `extra` fica no canto direito das abas (o botão
 * de entregar).
 */
import type { ReactNode } from "react";
import { cn } from "@/components/ui";
import { NucleoIcon } from "@/components/flair/nucleos/nucleo-icons";
import { NucleoResourceIcon } from "@/components/flair/nucleos/nucleo-resource-icon";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import type { CardZoom } from "@/components/flair/nucleos/use-card-zoom";
import { pontua, seloDaCarta } from "@/lib/flair/nucleos/card-fx";
import { abasVisiveis, abaVisivelAtual, itensDaFileira, type AbaVisivel, type ItemDaFileira } from "@/lib/flair/nucleos/deck-row";
import { isApplied, type ResourceTab, type Selecao } from "@/lib/flair/nucleos/selection";
import type { AbaIcone, EfeitoItem } from "@/lib/flair/nucleos/types";

interface Props {
  nucleo: string;
  tabs: ResourceTab[];
  aba: number;
  item: number;
  sel: Selecao;
  onAba: (index: number) => void;
  onItem: (aba: number, item: number) => void;
  /** só as abas de um grupo (MAKE UP: Roupas ou Maquiagem); os índices continuam os da lista inteira */
  mostrar?: (tab: ResourceTab) => boolean;
  /** fileira única com a aba "Roupas" e a régua de vagas (tela de jogo dos núcleos) */
  agrupar?: boolean;
  /** vaga escolhida na régua (filtra a fileira) */
  vaga?: string | null;
  /** tocar numa carta que não cabe na vaga escolhida */
  onNaoCabe?: (x: ItemDaFileira) => void;
  /** efeito de cada carta neste jogo (undefined = o servidor ainda não respondeu) */
  efeitos?: (cardId: string) => EfeitoItem[] | undefined;
  zoom?: CardZoom;
  /** canto direito da linha das abas (entregar e ações do deck) */
  extra?: ReactNode;
}

function preenchida(sel: Selecao, tab: ResourceTab): boolean {
  if (tab.tipo === "vaga") return !!sel.cartas[tab.id];
  if (tab.tipo === "zona") return !!sel.zonas[tab.id];
  if (tab.tipo === "area") return !!sel.maquiagem[tab.id];
  return !!sel.resposta;
}

function iconeDaAba(visivel: AbaVisivel, tabs: ResourceTab[]): AbaIcone {
  return visivel.tipo === "roupas" ? "sup" : tabs[visivel.indices[0]].icone;
}

export function NucleoResourceWindow(props: Props) {
  const { nucleo, tabs, aba, item, sel, onAba, onItem, mostrar, agrupar = false, vaga = null, efeitos, zoom } = props;
  const tx = useNucleoText();
  const visiveis = abasVisiveis(tabs, agrupar, mostrar);
  const atual = abaVisivelAtual(visiveis, aba);
  const fileira = itensDaFileira(tabs, atual, vaga);
  const nomeDaAba = (v: AbaVisivel) => (v.tipo === "roupas" ? tx.t("flair3d.ui.tab.ROUPAS") : tx.aba(tabs[v.indices[0]]));

  const rotuloDoItem = (x: ItemDaFileira, selo: string | null) => {
    if (x.it.kind !== "carta" || !agrupar) return tx.item(nucleo, x.it);
    const base = tx.t("flair3d.ui.card.aria", { nome: x.it.card.name, pos: tx.aba(x.tab) });
    return selo ? `${base}, ${selo}` : base;
  };

  const tocar = (x: ItemDaFileira) => {
    if (zoom?.consumirClique()) return;
    if (x.cabe) onItem(x.aba, x.item);
    else props.onNaoCabe?.(x);
  };

  const desenhar = (x: ItemDaFileira) => {
    const itens = x.it.kind === "carta" ? efeitos?.(x.it.card.id) : undefined;
    const achado = seloDaCarta(itens);
    const semEfeito = pontua(itens) === false;
    const selo = achado ? tx.efeito(achado) : semEfeito ? tx.t("flair3d.ui.deck.noEffect") : null;
    return (
      <NucleoResourceIcon
        key={`${x.tab.id}-${x.it.key}`}
        item={x.it}
        rotulo={rotuloDoItem(x, selo)}
        foco={x.aba === aba && x.item === item}
        aplicado={isApplied(sel, x.tab, x.it)}
        cabe={x.cabe}
        selo={selo}
        semEfeito={semEfeito}
        emUso={agrupar ? tx.t("flair3d.ui.card.inUse") : undefined}
        toque={x.it.kind === "carta" && zoom ? zoom.toque(x.it.card) : undefined}
        onClick={() => tocar(x)}
      />
    );
  };

  let corpo;
  if (!atual) {
    corpo = <p className="n3d-empty">{tx.t("flair3d.ui.window.noTabs")}</p>;
  } else if (fileira.length === 0) {
    corpo = <p className="n3d-empty">{tx.t("flair3d.ui.window.empty", { aba: nomeDaAba(atual) })}</p>;
  } else {
    corpo = <div className={agrupar ? "n3d-row" : "n3d-grid"}>{fileira.map(desenhar)}</div>;
  }

  return (
    <section className={cn("n3d-window", agrupar && "is-row")} aria-label={tx.t("flair3d.ui.window.title")} data-testid="nucleo-resource-window">
      <div className="n3d-window-head">
        <div className="n3d-tabs" role="tablist" aria-label={tx.t("flair3d.ui.window.tabs")}>
          {visiveis.map((v) => {
            const ativa = v === atual;
            const cheia = v.indices.some((i) => preenchida(sel, tabs[i]));
            return (
              <button
                key={v.id}
                type="button"
                role="tab"
                id={`n3d-tab-${v.id}`}
                aria-selected={ativa}
                aria-controls="n3d-tabpanel"
                className={cn("n3d-tab", ativa && "is-active", cheia && "is-filled")}
                onClick={() => onAba(ativa ? aba : v.indices[0])}
              >
                <NucleoIcon name={iconeDaAba(v, tabs)} />
                <span>{nomeDaAba(v)}</span>
              </button>
            );
          })}
        </div>
        {props.extra}
      </div>
      <div id="n3d-tabpanel" role="tabpanel" aria-labelledby={atual ? `n3d-tab-${atual.id}` : undefined} className="n3d-panel">
        {corpo}
      </div>
    </section>
  );
}
