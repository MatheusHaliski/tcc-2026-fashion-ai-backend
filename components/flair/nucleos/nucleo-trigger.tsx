"use client";
/**
 * Acionamento pela pessoa, o único gesto com a carta que cada jogo permite fora da preparação (tabela "O que cada
 * carta faz na ação, e quando pode ser acionada"): Dress Fighter, 1 carta Especial por luta, entre os rounds; Fashion
 * Sports, trocar 1 peça no intervalo. A janela só abre pelos eventos do resultado do servidor, e o botão só fica ativo
 * quando a tela recebe `onAcionar` (o servidor aceita o acionamento); sem isso, o painel diz por quê e nada é simulado.
 */
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import type { AcionamentoTipo } from "@/lib/flair/nucleos/moments";

export interface AcionamentoPedido {
  tipo: AcionamentoTipo;
  cardId?: string;
}

interface Props {
  tipo: "ESPECIAL" | "TROCA";
  /** a janela do acionamento está aberta neste ponto da ação */
  aberta: boolean;
  /** já foi usado nesta partida (1 por luta, 1 por intervalo) */
  usado: boolean;
  /** cartas do deck da partida */
  cartas: FlairCollectionCard[];
  onAcionar?: (pedido: AcionamentoPedido) => void;
  /** seguir a ação sem acionar */
  onSeguir: () => void;
}

export function NucleoTrigger({ tipo, aberta, usado, cartas, onAcionar, onSeguir }: Props) {
  const tx = useNucleoText();
  const especiais = tipo === "ESPECIAL" ? cartas.filter((c) => c.tier === "ESPECIAL") : [];
  const pode = aberta && !usado && !!onAcionar;
  let aviso: string;
  if (usado) aviso = tx.t("flair3d.ui.trigger.used");
  else if (!onAcionar) aviso = tx.t("flair3d.ui.trigger.unavailable");
  else if (tipo === "ESPECIAL" && especiais.length === 0) aviso = tx.t("flair3d.ui.trigger.ESPECIAL.none");
  else if (!aberta) aviso = tx.t(`flair3d.ui.trigger.${tipo}.wait`);
  else aviso = tx.t(`flair3d.ui.trigger.${tipo}.open`);
  return (
    <section className="n3d-trigger" aria-label={tx.t("flair3d.ui.trigger.title")} data-testid="nucleo-trigger" data-open={pode || undefined}>
      <h3 className="type-label">{tx.t(`flair3d.ui.trigger.${tipo}.name`)}</h3>
      <p className="n3d-trigger-note" role="status">{aviso}</p>
      <div className="n3d-trigger-actions">
        {tipo === "ESPECIAL" && especiais.map((c) => (
          <button key={c.id} type="button" className="btn btn-sm" disabled={!pode} onClick={() => onAcionar?.({ tipo, cardId: c.id })}>
            {tx.t("flair3d.ui.trigger.ESPECIAL.use", { nome: c.name })}
          </button>
        ))}
        {tipo === "TROCA" && (
          <button type="button" className="btn btn-sm" disabled={!pode} onClick={() => onAcionar?.({ tipo })}>
            {tx.t("flair3d.ui.trigger.TROCA.use")}
          </button>
        )}
        {pode && (
          <button type="button" className="btn btn-sm" onClick={onSeguir}>
            {tx.t("flair3d.ui.trigger.skip")}
          </button>
        )}
      </div>
    </section>
  );
}
