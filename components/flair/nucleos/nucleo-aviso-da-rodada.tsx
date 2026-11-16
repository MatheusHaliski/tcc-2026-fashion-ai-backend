"use client";
/**
 * O aviso de rodada que as cartas não cumprem (auditoria dos jogos de 15/11, defeito 4), antes de entrar (na escolha do
 * deck, para a coleção e para as cartas escolhidas) e no começo da partida: nenhuma carta pontua, ou as regras de peça
 * que nenhuma carta cumpre. A rodada nunca fica impossível em silêncio.
 */
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import type { Viabilidade } from "@/lib/flair/nucleos/viabilidade";

interface Props {
  codigo: string;
  viabilidade: Viabilidade | null;
  /** de quem se fala: a coleção inteira, as cartas escolhidas ou o deck da partida */
  escopo: "colecao" | "deck" | "partida";
}

export function NucleoAvisoDaRodada({ codigo, viabilidade, escopo }: Props) {
  const tx = useNucleoText();
  if (!viabilidade) return null;
  const texto = viabilidade.semPontos
    ? tx.t(`flair3d.ui.viabilidade.semPontos.${escopo}`)
    : tx.t("flair3d.ui.viabilidade.regras", { regras: viabilidade.regrasSemCarta.map((r) => tx.regra(codigo, r)).join("; ") });
  return (
    <p className="n3d-deck-warning" role="status" data-testid={`nucleo-aviso-${escopo}`}>
      {texto}
    </p>
  );
}
