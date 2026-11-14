/** Texto de um passo da ação: o efeito de cenário do jogo (o que a peça faz sozinha) e a regra ou o evento do servidor. */
import type { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { EFEITO_ACAO, type PassoAcao } from "@/lib/flair/nucleos/action-fx";
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";

type Texto = ReturnType<typeof useNucleoText>;

/** `variante`: a modalidade escolhida no Fashion Sports; fora do futebol de 5 o texto da cena fala em jogada e ponto. */
export function textoDoPasso(tx: Texto, nucleo: NucleoCodigo, passo: PassoAcao, variante?: string | null): string {
  const outraModalidade = nucleo === "FASHION_SPORTS" && !!variante && variante !== "FUTEBOL";
  const efeito = outraModalidade ? "jogada" : EFEITO_ACAO[nucleo];
  if (passo.fonte === "evento") return tx.evento({ codigo: passo.codigo, valor: passo.valor });
  if (passo.fonte === "especial") return tx.t(`flair3d.ui.acao.${efeito}.${passo.ok ? "special" : "fail"}`);
  const cena = tx.t(`flair3d.ui.acao.${efeito}.${passo.ok ? "ok" : "miss"}`);
  return `${cena}: ${tx.regra(nucleo, passo.codigo)}`;
}
