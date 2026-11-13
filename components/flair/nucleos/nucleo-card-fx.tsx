"use client";
/**
 * Efeito de entrada da carta sobre o palco, em até 1 segundo e sempre fora da zona da roupa: o clarão na cor do nível
 * vem de trás do avatar (aparece dos dois lados da faixa central), o selo do efeito sobe da peça até o placar e a Aura
 * Hype desenha anéis de luz no piso. A carta que não pontua entra sem clarão, com o selo cinza e o motivo. Com
 * "reduzir movimento", o clarão vira uma mudança de cor sem piscar e o selo não se move.
 */
import type { CSSProperties } from "react";
import { cn } from "@/components/ui";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import type { EntradaNaTela } from "@/components/flair/nucleos/use-card-fx";
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";

interface Props {
  nucleo: NucleoCodigo;
  atual: EntradaNaTela | null;
  reduzido: boolean;
  /** efeitos de luz ligados nas preferências */
  efeitos: boolean;
}

export function NucleoCardFx({ nucleo, atual, reduzido, efeitos }: Props) {
  const tx = useNucleoText();
  const entrada = atual?.entrada ?? null;
  let texto: string | null = null;
  if (entrada?.pontua === true && entrada.selo) {
    texto = tx.efeito(entrada.selo);
  } else if (entrada?.pontua === false) {
    const motivo = tx.ou(`flair3d.ui.fx.reason.${nucleo}`, tx.t("flair3d.ui.fx.reason.default"));
    texto = tx.t("flair3d.ui.fx.noScore", { motivo });
  }
  const calmo = reduzido || !efeitos;
  const cor = entrada ? ({ "--n3d-fx-cor": entrada.cor } as CSSProperties) : undefined;
  const clarao = !!entrada && efeitos && entrada.pontua === true;
  const estado = !entrada ? "idle" : entrada.pontua === false ? "muted" : "scoring";
  return (
    <div className={cn("n3d-fx", calmo && "is-calm")} data-testid="nucleo-card-fx" data-state={estado} data-tier={entrada?.tier}>
      {clarao && atual && (
        <span key={`clarao-${atual.chave}`} className="n3d-fx-flash" style={cor} aria-hidden data-testid="nucleo-fx-flash">
          <span className="n3d-fx-glow is-left" />
          <span className="n3d-fx-glow is-right" />
        </span>
      )}
      {entrada?.aura && efeitos && atual && (
        <span key={`aura-${atual.chave}`} className="n3d-fx-rings" style={cor} aria-hidden data-testid="nucleo-fx-rings">
          <span className="n3d-fx-ring" />
          <span className="n3d-fx-ring" />
        </span>
      )}
      {texto && atual && (
        <span key={`selo-${atual.chave}`} className={cn("n3d-fx-badge", entrada?.pontua === false && "is-none")} aria-hidden data-testid="nucleo-fx-badge">
          {texto}
        </span>
      )}
      <p className="sr-only" role="status">{atual && texto ? `${atual.card.name}: ${texto}` : ""}</p>
    </div>
  );
}
