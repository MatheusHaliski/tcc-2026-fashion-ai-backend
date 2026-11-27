"use client";
/**
 * As vagas do elenco, uma por peça do quebra-cabeça: o número da peça, o que ela pede (cor, estilo, ocasião ou
 * qualquer carta), a carta posta e o estado (vazia, conferindo, encaixou, não encaixou). Tocar escolhe a vaga (a
 * bandeja mostra as cartas); a carta posta pode ser arrastada para outra vaga (troca) ou para a bandeja (tira).
 */
import type { PointerEvent } from "react";
import { cn } from "@/components/ui";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import { useElencoText } from "@/components/flair/elencos/use-elenco-text";
import { mediaUrl } from "@/lib/api/client";
import type { EstadoPeca } from "@/lib/flair/elencos/progresso";
import type { ElencoVaga } from "@/lib/flair/elencos/types";

interface Props {
  vagas: ElencoVaga[];
  cartas: Record<string, string>;
  banco: FlairCollectionCard[];
  estados: Record<string, EstadoPeca>;
  selecionada: string;
  onVaga: (chave: string) => void;
  pegar?: (cardId: string, origem: string | null) => (e: PointerEvent<HTMLElement>) => void;
}

export function ElencoVagas({ vagas, cartas, banco, estados, selecionada, onVaga, pegar }: Props) {
  const tx = useElencoText();
  return (
    <ol className="ep-vagas" data-testid="elenco-vagas">
      {vagas.map((v, i) => {
        const card = banco.find((c) => c.id === cartas[v.chave]);
        const estado = estados[v.chave] ?? "vazia";
        const rotulo = tx.t("flair3d.elencos.slot", { n: i + 1, pede: tx.pede(v), carta: card?.name ?? tx.t("flair3d.elencos.empty"), estado: tx.t(`flair3d.elencos.state.${estado}`) });
        return (
          <li key={v.chave}>
            <button type="button" className={cn("ep-vaga", `is-${estado}`, selecionada === v.chave && "is-selected")} data-slot={v.chave} aria-label={rotulo}
              aria-current={selecionada === v.chave || undefined} onClick={() => onVaga(v.chave)} onPointerDown={card && pegar ? pegar(card.id, v.chave) : undefined}>
              <span className="ep-vaga-n" aria-hidden>{i + 1}</span>
              <span className="ep-vaga-thumb" aria-hidden>
                {card?.imageUrl ? <img src={mediaUrl(card.imageUrl)} alt="" draggable={false} /> : <b>+</b>}
              </span>
              <span className="ep-vaga-text">
                <span className="ep-vaga-pede">{tx.pede(v)}</span>
                <span className="ep-vaga-carta">{card?.name ?? tx.t("flair3d.elencos.empty")}</span>
              </span>
              <span className="ep-vaga-estado" aria-hidden>{tx.t(`flair3d.elencos.state.${estado}`)}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
