"use client";
/**
 * Faixa do deck durante a ação: as cartas não mudam mais; no lugar da fileira, o que já aconteceu (um passo por linha,
 * na ordem do servidor), o acionamento que o jogo permite e "Ver o resultado" para pular a animação.
 */
import type { ReactNode } from "react";
import { textoDoPasso } from "@/components/flair/nucleos/nucleo-action-text";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import type { PassoAcao } from "@/lib/flair/nucleos/action-fx";
import { contadorDaLuta, type EstadoDaLuta } from "@/lib/flair/nucleos/luta";
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";

interface Props {
  nucleo: NucleoCodigo;
  /** a modalidade escolhida (Fashion Sports): o texto do passo fala dela */
  variante?: string | null;
  passos: PassoAcao[];
  mostrados: number;
  onPular: () => void;
  /** a partida espera a escolha da janela do acionamento: não há o que pular, e o botão diz isso em vez de ficar mudo */
  esperando?: boolean;
  /** a luta do Dress Fighter: o contador mostra o round e o lance, não a quantidade de passos */
  luta?: EstadoDaLuta | null;
  /** painel do acionamento (Dress Fighter, Fashion Sports) */
  children?: ReactNode;
}

export function NucleoActionPanel({ nucleo, variante, passos, mostrados, onPular, esperando = false, luta = null, children }: Props) {
  const tx = useNucleoText();
  const vistos = passos.slice(0, mostrados);
  const naLuta = luta ? contadorDaLuta(passos, mostrados, luta.lances) : null;
  const contador = naLuta
    ? tx.t("flair3d.ui.acao.lutaStep", { round: naLuta.round, n: naLuta.lance, total: naLuta.lances })
    : tx.t("flair3d.ui.acao.step", { n: mostrados, total: passos.length });
  return (
    <section className="n3d-action" aria-labelledby="n3d-action-title" data-testid="nucleo-action">
      <div className="n3d-action-head">
        <h2 id="n3d-action-title" className="type-label">{tx.t("flair3d.ui.acao.title")}</h2>
        <span className="n3d-action-count tabular" data-testid="nucleo-action-count">{contador}</span>
        <button type="button" className="btn btn-primary n3d-submit" onClick={onPular} disabled={esperando}
          title={esperando ? tx.t("flair3d.ui.acao.skipWaiting") : undefined}>
          {tx.t("flair3d.ui.acao.skip")}
        </button>
      </div>
      {esperando && <p className="n3d-hint" role="note" data-action-waiting>{tx.t("flair3d.ui.acao.skipWaiting")}</p>}
      <ol className="n3d-action-log" aria-live="polite">
        {vistos.map((p, i) => (
          <li key={i} className={p.ok ? "is-ok" : "is-miss"}>{textoDoPasso(tx, nucleo, p, variante)}</li>
        ))}
      </ol>
      {children}
    </section>
  );
}
