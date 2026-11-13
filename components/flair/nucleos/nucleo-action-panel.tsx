"use client";
/**
 * Faixa do deck durante a ação: as cartas não mudam mais; no lugar da fileira, o que já aconteceu (um passo por linha,
 * na ordem do servidor), o acionamento que o jogo permite e "Ver o resultado" para pular a animação.
 */
import type { ReactNode } from "react";
import { textoDoPasso } from "@/components/flair/nucleos/nucleo-action-text";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import type { PassoAcao } from "@/lib/flair/nucleos/action-fx";
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";

interface Props {
  nucleo: NucleoCodigo;
  passos: PassoAcao[];
  mostrados: number;
  onPular: () => void;
  /** painel do acionamento (Dress Fighter, Fashion Sports) */
  children?: ReactNode;
}

export function NucleoActionPanel({ nucleo, passos, mostrados, onPular, children }: Props) {
  const tx = useNucleoText();
  const vistos = passos.slice(0, mostrados);
  return (
    <section className="n3d-action" aria-labelledby="n3d-action-title" data-testid="nucleo-action">
      <div className="n3d-action-head">
        <h2 id="n3d-action-title" className="type-label">{tx.t("flair3d.ui.acao.title")}</h2>
        <span className="n3d-action-count tabular">{tx.t("flair3d.ui.acao.step", { n: mostrados, total: passos.length })}</span>
        <button type="button" className="btn btn-primary n3d-submit" onClick={onPular}>
          {tx.t("flair3d.ui.acao.skip")}
        </button>
      </div>
      <ol className="n3d-action-log" aria-live="polite">
        {vistos.map((p, i) => (
          <li key={i} className={p.ok ? "is-ok" : "is-miss"}>{textoDoPasso(tx, nucleo, p)}</li>
        ))}
      </ol>
      {children}
    </section>
  );
}
