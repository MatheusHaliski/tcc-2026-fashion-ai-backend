/** Texto de um passo da ação: o efeito de cenário do jogo (o que a peça faz sozinha) e a regra ou o evento do servidor. */
import type { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { EFEITO_ACAO, type PassoAcao } from "@/lib/flair/nucleos/action-fx";
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";

type Texto = ReturnType<typeof useNucleoText>;

export function textoDoPasso(tx: Texto, nucleo: NucleoCodigo, passo: PassoAcao): string {
  const efeito = EFEITO_ACAO[nucleo];
  if (passo.fonte === "evento") return tx.evento({ codigo: passo.codigo, valor: passo.valor });
  if (passo.fonte === "especial") return tx.t(`flair3d.ui.acao.${efeito}.${passo.ok ? "special" : "fail"}`);
  const cena = tx.t(`flair3d.ui.acao.${efeito}.${passo.ok ? "ok" : "miss"}`);
  return `${cena}: ${tx.regra(nucleo, passo.codigo)}`;
}
