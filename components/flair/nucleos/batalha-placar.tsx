"use client";
/**
 * Batalha de Looks: a comparação rodada a rodada com o adversário da casa, como o servidor a calculou. Cada lado mostra
 * a conta da nota (regra do desafio + look + foco da peça gasta) e o total; a última linha é a soma. Aparece depois de
 * cada entrega (na preparação da rodada seguinte) e no resultado final.
 */
import { cn } from "@/components/ui";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { fechoDaBatalha, rodadasDaBatalha, somaDaBatalha, type ContaDaBatalha } from "@/lib/flair/nucleos/batalha-placar";
import type { NucleoResultado } from "@/lib/flair/nucleos/types";

interface Props {
  resultado?: NucleoResultado | null;
  /** a última entrega que não fechou a partida (a rodada anterior) */
  anterior?: NucleoResultado | null;
}

export function BatalhaPlacar({ resultado, anterior }: Props) {
  const tx = useNucleoText();
  const rodadas = rodadasDaBatalha(resultado, anterior);
  const fecho = fechoDaBatalha(resultado);
  // no fim, a soma é a do servidor: as rodadas mais a execução do desfile final (é ela que decide quem venceu)
  const soma = fecho ?? somaDaBatalha(rodadas);
  if (!soma) return null;
  // com a Aura (rodada 8g), a conta leva o júri e o trunfo; servidor antigo não manda a parcela
  const conta = (c: ContaDaBatalha | undefined, total: number) => (c ? tx.t(c.aura ? "flair3d.ui.batalha.contaAura" : "flair3d.ui.batalha.conta", { regra: c.regra, look: c.look, recurso: c.recurso, aura: c.aura ?? 0, total }) : String(total));
  return (
    <section className="n3d-batalha" aria-label={tx.t("flair3d.ui.batalha.titulo")} data-testid="batalha-placar">
      <table className="n3d-batalha-tabela">
        <caption className="type-label">{tx.t("flair3d.ui.batalha.titulo")}</caption>
        <thead>
          <tr>
            <th scope="col">{tx.t("flair3d.ui.batalha.rodada")}</th>
            <th scope="col">{tx.t("flair3d.ui.batalha.voce")}</th>
            <th scope="col">{tx.t("flair3d.ui.batalha.adversario")}</th>
          </tr>
        </thead>
        <tbody>
          {rodadas.map((r) => (
            <tr key={r.rodada} data-rodada={r.rodada}>
              <th scope="row">
                {tx.t("flair3d.ui.batalha.numero", { n: r.rodada })}
                {r.desafio && <span className="n3d-batalha-desafio">{tx.etapaNome(r.desafio)}</span>}
              </th>
              <td className={cn("tabular", r.voce > r.adversario && "is-win")}>
                {conta(r.conta?.voce, r.voce)}
                {r.cansadas.length > 0 && <span className="n3d-batalha-nota">{tx.t("flair3d.ui.batalha.cansadas", { vagas: r.cansadas.map((v) => tx.posicao(v)).join(", ") })}</span>}
              </td>
              <td className={cn("tabular", r.adversario > r.voce && "is-win")}>
                {conta(r.conta?.adversario, r.adversario)}
                {r.familia && <span className="n3d-batalha-nota">{tx.t("flair3d.ui.batalha.veio", { familia: tx.ou(`flair3d.ui.familiaCor.${r.familia.toUpperCase()}`, r.familia).toLowerCase() })}</span>}
              </td>
            </tr>
          ))}
          {fecho && (
            <tr data-testid="batalha-execucao">
              <th scope="row">{tx.t("flair3d.ui.batalha.execucao")}</th>
              <td className="tabular">{fecho.execucao > 0 ? `+${fecho.execucao}` : String(fecho.execucao)}</td>
              <td className="tabular">—</td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">{tx.t("flair3d.ui.batalha.soma")}</th>
            <td className={cn("tabular", soma.voce > soma.adversario && "is-win")}>{soma.voce}</td>
            <td className={cn("tabular", soma.adversario > soma.voce && "is-win")}>{soma.adversario}</td>
          </tr>
        </tfoot>
      </table>
      <p className="n3d-hint">{tx.t("flair3d.ui.batalha.regra")}</p>
      {fecho && <p className="n3d-hint" data-testid="batalha-fecho">{tx.t("flair3d.ui.batalha.fecho")}</p>}
    </section>
  );
}
