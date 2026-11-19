"use client";
/**
 * "Continuar partida": ao voltar a um jogo com uma partida que não fechou (recarregar, sair e voltar, sair da conta e
 * entrar de novo), a tela mostra onde ela parou, o que o servidor tem guardado dela (deck, look entregue, look em
 * montagem, etapas e jogadas) e quando foi a última gravação, e deixa continuar dali ou começar outra. A partida
 * guardada continua no servidor; começar outra não a apaga.
 */
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { useI18n } from "@/lib/i18n/i18n";
import { pontoDaRetomada } from "@/lib/flair/nucleos/retomada";
import type { NucleoCodigo, NucleoRetomada } from "@/lib/flair/nucleos/types";

interface Props {
  codigo: NucleoCodigo;
  retomada: NucleoRetomada;
  onContinuar: () => void;
  onNova: () => void;
}

export function NucleoContinuar({ codigo, retomada, onContinuar, onNova }: Props) {
  const tx = useNucleoText();
  const { locale } = useI18n();
  const ponto = pontoDaRetomada(retomada);
  const vars: Record<string, string | number> = { ...ponto };
  if (ponto.tipo === "detetive") vars.sala = tx.t(`flair3d.detetive.sala.${ponto.sala}`);
  const quando = retomada.atualizadaEm ? new Date(retomada.atualizadaEm) : null;
  const rodada = retomada.partida.rodada;
  /** o que o servidor guardou, só o que existe ("deck de 8 cartas, look em montagem com 2 peças") */
  const salvo = retomada.salvo;
  const itens = salvo
    ? (["deck", "look", "rascunho", "etapas", "passos"] as const).filter((k) => salvo[k] > 0).map((k) => tx.t(`flair3d.ui.continuar.salvo.${k}`, { n: salvo[k] }))
    : [];
  return (
    <section className="n3d-continuar" aria-labelledby="n3d-continuar-titulo" data-testid="nucleo-continuar">
      <h2 id="n3d-continuar-titulo" className="type-h3">{tx.t("flair3d.ui.continuar.titulo")}</h2>
      {rodada && <p className="type-label">{tx.rodadaNome(codigo, rodada)}</p>}
      <p data-testid="nucleo-continuar-ponto">{tx.t(`flair3d.ui.continuar.${ponto.tipo}`, vars)}</p>
      {itens.length > 0 && <p data-testid="nucleo-continuar-salvo">{tx.t("flair3d.ui.continuar.salvo", { itens: itens.join(", ") })}</p>}
      {quando && !Number.isNaN(quando.getTime()) && (
        <p className="type-caption text-muted">
          {tx.t("flair3d.ui.continuar.quando", { quando: new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(quando) })}
        </p>
      )}
      <div className="n3d-continuar-acoes">
        <button type="button" className="btn btn-primary" onClick={onContinuar}>
          {tx.ou(`flair3d.ui.continuar.sim.${codigo}`, tx.t("flair3d.ui.continuar.sim"))}
        </button>
        <button type="button" className="btn" onClick={onNova}>{tx.t("flair3d.ui.continuar.nova")}</button>
      </div>
    </section>
  );
}
