"use client";
/**
 * Painel do objetivo: nome do núcleo, objetivo mais simples e, aberto (O / Select / botão), o cenário, os personagens e
 * as regras com os pontos que a API devolve.
 */
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import type { NucleoDefinicao } from "@/lib/flair/nucleos/types";

export function NucleoObjective({ definicao, aberto, onToggle }: { definicao: NucleoDefinicao; aberto: boolean; onToggle: () => void }) {
  const tx = useNucleoText();
  const c = definicao.codigo;
  return (
    <section className="n3d-objective" aria-labelledby="n3d-objective-title" data-testid="nucleo-objective">
      <div className="n3d-objective-head">
        <h2 id="n3d-objective-title" className="type-label">{tx.t("flair3d.ui.objective.title")}</h2>
        <button type="button" className="btn btn-sm" aria-expanded={aberto} onClick={onToggle}>
          {tx.t(aberto ? "flair3d.ui.objective.hide" : "flair3d.ui.objective.show")}
        </button>
      </div>
      <p className="n3d-objective-text">{tx.t(`flair3d.nucleo.${c}.objective`)}</p>
      {aberto && (
        <div className="n3d-objective-more">
          <p>{tx.t(`flair3d.nucleo.${c}.scene`)}</p>
          <p>{tx.t(`flair3d.nucleo.${c}.characters`)}</p>
          <h3 className="type-label">{tx.t("flair3d.ui.objective.rules")}</h3>
          <ul className="n3d-rules">
            {definicao.objetivo.regras.map((r) => (
              <li key={r.codigo}>
                <span>{tx.regra(c, r.codigo)}</span>
                {r.pontos > 0 && <em className="tabular">{tx.t("flair3d.ui.points", { n: r.pontos })}</em>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
