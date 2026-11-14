"use client";
/**
 * A ação sobre o palco: cada passo do resultado do servidor acende uma luz na coluna da direita (abaixo do placar) e
 * a legenda do passo aparece na coluna da esquerda, as duas fora da zona da roupa. A cor e a forma da luz mudam com o
 * efeito de cenário do jogo (LED da passarela, golpe, silhueta, refletor, lâmpada do espelho...). Nada aqui decide
 * nota: só mostra o que o servidor calculou.
 */
import { cn } from "@/components/ui";
import { textoDoPasso } from "@/components/flair/nucleos/nucleo-action-text";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { EFEITO_ACAO, type PassoAcao } from "@/lib/flair/nucleos/action-fx";
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";

interface Props {
  nucleo: NucleoCodigo;
  /** a modalidade escolhida (Fashion Sports): o texto do passo fala dela */
  variante?: string | null;
  passos: PassoAcao[];
  /** quantos passos já apareceram */
  mostrados: number;
  reduzido: boolean;
  efeitos: boolean;
}

export function NucleoActionFx({ nucleo, variante, passos, mostrados, reduzido, efeitos }: Props) {
  const tx = useNucleoText();
  const atual = mostrados > 0 ? passos[Math.min(mostrados, passos.length) - 1] : null;
  const calmo = reduzido || !efeitos;
  return (
    <div className={cn("n3d-act", `fx-${EFEITO_ACAO[nucleo]}`, calmo && "is-calm")} data-testid="nucleo-action-fx" data-step={mostrados}>
      <ol className="n3d-act-lights" aria-hidden>
        {passos.map((p, i) => (
          <li key={i} className={cn("n3d-act-light", i < mostrados && (p.ok ? "is-on" : "is-miss"), p.fonte === "especial" && "is-special")} />
        ))}
      </ol>
      {atual && (
        <p key={mostrados} className={cn("n3d-act-caption", atual.ok ? "is-ok" : "is-miss")} aria-hidden>
          {textoDoPasso(tx, nucleo, atual, variante)}
        </p>
      )}
    </div>
  );
}
