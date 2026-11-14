"use client";
/**
 * Objetivo. `NucleoObjective` é a linha do canto de cima à esquerda do palco: o nome do jogo e o objetivo em uma
 * linha. `NucleoObjectiveDetails` é o painel aberto (O / Select / toque), com o cenário, os personagens e as regras
 * com os pontos que a API devolve; ele abre sobre a faixa do deck, nunca sobre a zona da roupa. `children` entra no
 * fim do painel (a ajuda dos comandos).
 */
import type { ReactNode } from "react";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import type { NucleoDefinicao } from "@/lib/flair/nucleos/types";

const PAINEL = "n3d-objective-more";

/** `variante`: a sala escolhida quando o jogo tem mais de uma (a modalidade do Fashion Sports): o texto fala dela. */
export function NucleoObjective({ definicao, variante, aberto, onToggle }: { definicao: NucleoDefinicao; variante?: string | null; aberto: boolean; onToggle: () => void }) {
  const tx = useNucleoText();
  const c = definicao.codigo;
  const acao = tx.t(aberto ? "flair3d.ui.objective.hide" : "flair3d.ui.objective.show");
  return (
    <section className="n3d-objective" aria-labelledby="n3d-objective-title" data-testid="nucleo-objective">
      <button type="button" className="n3d-objective-line" aria-expanded={aberto} aria-controls={PAINEL} title={acao} onClick={onToggle}>
        <span id="n3d-objective-title" className="n3d-objective-name">{tx.nome(c)}</span>
        <span className="n3d-objective-text">{tx.daVariante(c, "objective", variante)}</span>
        <span className="sr-only">{acao}</span>
      </button>
    </section>
  );
}

export function NucleoObjectiveDetails({ definicao, variante, onFechar, children }: { definicao: NucleoDefinicao; variante?: string | null; onFechar: () => void; children?: ReactNode }) {
  const tx = useNucleoText();
  const c = definicao.codigo;
  return (
    <section id={PAINEL} className="n3d-objective-more" aria-label={tx.t("flair3d.ui.objective.title")} data-testid="nucleo-objective-details">
      <div className="n3d-objective-head">
        <h2 className="type-label">{tx.t("flair3d.ui.objective.title")}</h2>
        <button type="button" className="btn btn-sm" onClick={onFechar}>
          {tx.t("flair3d.ui.objective.hide")}
        </button>
      </div>
      <p className="n3d-objective-goal">{tx.daVariante(c, "objective", variante)}</p>
      <p>{tx.daVariante(c, "scene", variante)}</p>
      <p>{tx.daVariante(c, "characters", variante)}</p>
      <h3 className="type-label">{tx.t("flair3d.ui.objective.rules")}</h3>
      <ul className="n3d-rules">
        {definicao.objetivo.regras.map((r) => (
          <li key={r.codigo}>
            <span>{tx.regra(c, r.codigo)}</span>
            {r.pontos > 0 && <em className="tabular">{tx.pontos(r.pontos)}</em>}
          </li>
        ))}
      </ul>
      {children}
    </section>
  );
}
