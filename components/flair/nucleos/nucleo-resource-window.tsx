"use client";
/**
 * Janela de recursos (metade de baixo do layout DREST): abas com ícone (vagas, zonas, áreas de maquiagem, resposta) e a
 * grade de itens da aba. O item em foco segue a navegação do controle; clicar aplica direto.
 */
import { cn } from "@/components/ui";
import { NucleoIcon } from "@/components/flair/nucleos/nucleo-icons";
import { NucleoResourceIcon } from "@/components/flair/nucleos/nucleo-resource-icon";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { isApplied, type ResourceTab, type Selecao } from "@/lib/flair/nucleos/selection";

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
}

function preenchida(sel: Selecao, tab: ResourceTab): boolean {
  if (tab.tipo === "vaga") return !!sel.cartas[tab.id];
  if (tab.tipo === "zona") return !!sel.zonas[tab.id];
  if (tab.tipo === "area") return !!sel.maquiagem[tab.id];
  return !!sel.resposta;
}

export function NucleoResourceWindow({ nucleo, tabs, aba, item, sel, onAba, onItem, mostrar }: Props) {
  const tx = useNucleoText();
  const atual = tabs[aba];
  return (
    <section className="n3d-window" aria-label={tx.t("flair3d.ui.window.title")} data-testid="nucleo-resource-window">
      <div className="n3d-tabs" role="tablist" aria-label={tx.t("flair3d.ui.window.tabs")}>
        {tabs.map((tab, i) => (mostrar && !mostrar(tab) ? null : (
          <button key={tab.id} type="button" role="tab" id={`n3d-tab-${tab.id}`} aria-selected={i === aba} aria-controls="n3d-tabpanel"
            className={cn("n3d-tab", i === aba && "is-active", preenchida(sel, tab) && "is-filled")} onClick={() => onAba(i)}>
            <NucleoIcon name={tab.icone} />
            <span>{tx.aba(tab)}</span>
          </button>
        )))}
      </div>
      <div id="n3d-tabpanel" role="tabpanel" aria-labelledby={atual ? `n3d-tab-${atual.id}` : undefined} className="n3d-panel">
        {!atual ? (
          <p className="n3d-empty">{tx.t("flair3d.ui.window.noTabs")}</p>
        ) : atual.items.length === 0 ? (
          <p className="n3d-empty">{tx.t("flair3d.ui.window.empty", { aba: tx.aba(atual) })}</p>
        ) : (
          <div className="n3d-grid">
            {atual.items.map((it, i) => (
              <NucleoResourceIcon key={it.key} item={it} rotulo={tx.item(nucleo, it)} foco={i === item} aplicado={isApplied(sel, atual, it)} onClick={() => onItem(aba, i)} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
