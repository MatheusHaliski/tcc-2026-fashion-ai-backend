"use client";
/** Painéis do brief do MAKE UP: o objetivo (regras de 25 pontos) e o resultado da entrega com o Prestígio ganho. */
import { cn } from "@/components/ui";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import type { BriefDefinicao, MakeUpResultado } from "@/lib/flair/make-up/types";

export function useBriefText() {
  const tx = useNucleoText();
  return {
    ...tx,
    brief: (codigo: string) => tx.ou(`flair3d.makeup.brief.${codigo}.name`, codigo),
    regraBrief: (codigo: string, regra: string) => tx.ou(`flair3d.makeup.brief.${codigo}.rules.${regra}`, regra),
  };
}

export function MakeUpObjective({ brief, aberto, onToggle }: { brief: BriefDefinicao; aberto: boolean; onToggle: () => void }) {
  const tx = useBriefText();
  return (
    <section className="n3d-objective" aria-labelledby="mk-objective-title" data-testid="makeup-objective">
      <div className="n3d-objective-head">
        <h2 id="mk-objective-title" className="type-label">{tx.t("flair3d.ui.objective.title")}</h2>
        <button type="button" className="btn btn-sm" aria-expanded={aberto} onClick={onToggle}>
          {tx.t(aberto ? "flair3d.ui.objective.hide" : "flair3d.ui.objective.show")}
        </button>
      </div>
      <p className="n3d-objective-text">{tx.ou(`flair3d.makeup.brief.${brief.codigo}.objective`, tx.brief(brief.codigo))}</p>
      {aberto && (
        <ul className="n3d-rules">
          {brief.regras.map((r) => (
            <li key={r.codigo}>
              <span>{tx.regraBrief(brief.codigo, r.codigo)}</span>
              <em className="tabular">{tx.t("flair3d.ui.points", { n: r.pontos })}</em>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function MakeUpResult({ codigo, resultado, onAgain }: { codigo: string; resultado: MakeUpResultado; onAgain: () => void }) {
  const tx = useBriefText();
  const estrelas = Math.max(0, Math.min(3, resultado.estrelas));
  return (
    <section className="n3d-result" aria-labelledby="mk-result-title" data-testid="makeup-result">
      <h2 id="mk-result-title" className="type-h3">{tx.t("flair3d.ui.result.title")}</h2>
      <p className="n3d-result-points tabular">{tx.t("flair3d.ui.result.points", { n: resultado.pontos })}</p>
      <p className="n3d-stars" aria-label={tx.t("flair3d.ui.result.stars", { n: estrelas })}>
        {[1, 2, 3].map((i) => <span key={i} className={cn("n3d-star", i <= estrelas && "is-on")} aria-hidden>★</span>)}
      </p>
      <p className="mk-prestige">{tx.t("flair3d.makeup.result.prestige", { n: resultado.prestigioGanho })}</p>
      {resultado.carreira && (
        <p className="text-muted">{tx.t("flair3d.makeup.result.career", { nivel: resultado.carreira.nivel, prestigio: resultado.carreira.prestigio })}</p>
      )}
      <ul className="n3d-rules">
        {resultado.regras.map((r) => (
          <li key={r.codigo} className={r.ok ? "is-ok" : "is-miss"}>
            <span>{tx.t(r.ok ? "flair3d.ui.result.ok" : "flair3d.ui.result.notOk")}</span>
            <span>{tx.regraBrief(codigo, r.codigo)}</span>
            <em className="tabular">{tx.t("flair3d.ui.points", { n: r.pontos })}</em>
          </li>
        ))}
      </ul>
      <button type="button" className="btn" onClick={onAgain}>{tx.t("flair3d.ui.result.again")}</button>
    </section>
  );
}
