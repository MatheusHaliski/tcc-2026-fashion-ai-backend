"use client";
/**
 * A faixa de baixo do Fashion Sports durante a partida, no lugar do deck: a situação da jogada em uma frase, o relógio
 * da janela e a mão de cartas. Cada carta mostra a ação que a cor dela dispara e o poder dela. Jogar uma carta é a
 * jogada; "seguir sem carta" (ou deixar a janela acabar) deixa o time sem fazer nada de útil, e a tela diz isso antes.
 * Setas escolhem a carta, Enter ou Espaço jogam, Backspace segue sem carta; o controle usa os mesmos comandos.
 */
import { useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui";
import type { ApiError } from "@/lib/api/client";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import { NucleoCard } from "@/components/flair/nucleos/nucleo-card";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { narracao, nomeDaAcao, situacaoEmTexto } from "@/components/flair/esporte/esporte-texto";
import type { Jogada, Situacao } from "@/lib/flair/esporte/types";
import type { EfeitoItem } from "@/lib/flair/nucleos/types";

/** Quanto tempo a pessoa tem para jogar a carta, em segundos. */
export const JANELA_S = 30;
/** Quantos lances a narração guarda na tela. */
const ULTIMOS = 3;

export interface CartaNaMao {
  card: FlairCollectionCard;
  acao: string;
  poder: number;
}

/** A ação e o poder de cada carta da mão, pelos selos do servidor (ACAO_<ação> e PODER). */
export function cartasDaMao(mao: string[], cartas: FlairCollectionCard[], itens: (cardId: string) => EfeitoItem[] | undefined): CartaNaMao[] {
  return mao.flatMap((id) => {
    const card = cartas.find((c) => c.id === id);
    if (!card) return [];
    const selos = itens(id) ?? [];
    const acao = selos.find((i) => i.codigo.startsWith("ACAO_"))?.codigo.slice("ACAO_".length) ?? "TOQUE";
    const poder = selos.find((i) => i.codigo === "PODER")?.valor;
    return [{ card, acao, poder: typeof poder === "number" ? poder : 0 }];
  });
}

interface Props {
  modalidade: string;
  /** os lances que já apareceram (a narração mostra os últimos) */
  jogadas: Jogada[];
  /** a jogada da vez, quando a partida espera a carta e os lances anteriores já passaram na tela */
  situacao: Situacao | null;
  mao: CartaNaMao[];
  ocupado: boolean;
  erro: ApiError | null;
  /** joga a carta (ou nenhuma: seguir sem carta) */
  onJogar: (cardId: string | null) => void;
  /** pula a animação dos lances que faltam aparecer */
  onPular: () => void;
}

export function EsportePainel({ modalidade, jogadas, situacao, mao, ocupado, erro, onJogar, onPular }: Props) {
  const tx = useNucleoText();
  const [foco, setFoco] = useState(0);
  const [resta, setResta] = useState(JANELA_S);
  const jogar = useRef(onJogar);
  jogar.current = onJogar;
  const aberta = !!situacao && !ocupado;
  const vez = situacao?.jogada ?? 0;

  // a janela da jogada: conta os segundos e, no fim, segue sem carta
  useEffect(() => {
    if (!aberta) return;
    setResta(JANELA_S);
    setFoco(0);
    const timer = window.setInterval(() => setResta((r) => r - 1), 1000);
    return () => window.clearInterval(timer);
  }, [aberta, vez]);
  useEffect(() => {
    if (aberta && resta <= 0) jogar.current(null);
  }, [aberta, resta]);

  // teclado: setas escolhem, Enter ou Espaço jogam, Backspace segue sem carta
  useEffect(() => {
    if (!aberta) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") setFoco((f) => (f + (e.key === "ArrowRight" ? 1 : -1) + Math.max(1, mao.length)) % Math.max(1, mao.length));
      else if ((e.key === "Enter" || e.key === " ") && mao[foco]) jogar.current(mao[foco].card.id);
      else if (e.key === "Backspace") jogar.current(null);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberta, mao, foco]);

  const ultimos = jogadas.slice(-ULTIMOS);
  return (
    <section className="fsp-painel" aria-label={tx.t("flair3d.esporte.painel")} data-testid="esporte-painel" data-aberta={aberta || undefined}>
      <ol className="fsp-lances" aria-live="polite">
        {ultimos.map((j) => (
          <li key={j.n} className={j.ok ? "is-ok" : "is-miss"}>{narracao(tx, modalidade, j)}</li>
        ))}
      </ol>
      {situacao ? (
        <>
          <p className="fsp-situacao" role="status" data-testid="esporte-situacao">
            <strong>{tx.t("flair3d.esporte.jogada", { n: situacao.jogada, total: situacao.total })}</strong> {situacaoEmTexto(tx, situacao)}
          </p>
          <p className="fsp-janela tabular" data-testid="esporte-janela">{tx.t("flair3d.esporte.janela", { n: Math.max(0, resta) })}</p>
          {mao.length === 0 ? <p className="n3d-hint">{tx.t("flair3d.esporte.semMao")}</p> : (
            <div className="fsp-mao" role="group" aria-label={tx.t("flair3d.esporte.mao", { n: situacao.baralho })}>
              {mao.map((c, i) => {
                const acao = nomeDaAcao(tx, modalidade, c.acao);
                const rotulo = tx.t("flair3d.esporte.carta", { nome: c.card.name, acao, poder: c.poder });
                return (
                  <button key={c.card.id} type="button" className={cn("fsp-carta", i === foco && "is-foco")} aria-label={rotulo} title={rotulo} disabled={!aberta}
                    data-acao={c.acao} onFocus={() => setFoco(i)} onClick={() => onJogar(c.card.id)}>
                    <NucleoCard card={c.card} tamanho="mini" />
                    <span className="fsp-carta-acao">{acao}</span>
                    <span className="fsp-carta-poder tabular">{tx.t("flair3d.esporte.poder", { n: c.poder })}</span>
                  </button>
                );
              })}
            </div>
          )}
          <button type="button" className="btn btn-sm fsp-seguir" disabled={!aberta} onClick={() => onJogar(null)} title={tx.t("flair3d.esporte.semCartaAviso")}>
            {tx.t("flair3d.esporte.semCarta")}
          </button>
          <p className="n3d-hint fsp-aviso">{tx.t("flair3d.esporte.semCartaAviso")}</p>
        </>
      ) : (
        <div className="fsp-espera">
          <p className="n3d-hint" role="status">{tx.t(ocupado ? "flair3d.esporte.resolvendo" : "flair3d.esporte.emCampo")}</p>
          <button type="button" className="btn btn-sm" onClick={onPular}>{tx.t("flair3d.esporte.pular")}</button>
        </div>
      )}
      {erro && <p className="n3d-error" role="alert">{tx.ou(`flair3d.ui.trigger.error.${erro.code ?? ""}`, tx.t("flair3d.ui.trigger.error.default", { msg: erro.message }))}</p>}
    </section>
  );
}
