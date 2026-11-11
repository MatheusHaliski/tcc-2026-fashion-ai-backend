"use client";
/**
 * Tela do deck (antes da partida): as cartas FLAIR da pessoa com o efeito de cada uma neste núcleo (selos vindos de
 * POST .../efeitos), o contador do deck, as obrigatórias com o que falta e "Entrar na partida", ativo só com o deck
 * válido. Um 422 do servidor ao abrir mostra a mensagem e o que falta.
 */
import { useMemo, useState } from "react";
import { cn } from "@/components/ui";
import type { ApiError } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { FlairGameCard, type FlairCollectionCard } from "@/components/flair/flair-game-card";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { efeitosDasCartas } from "@/lib/flair/nucleos/api";
import { alternarCarta, conferirDeck, posicoesDaRegra } from "@/lib/flair/nucleos/deck";
import type { DeckRegras, EfeitoItem, NucleoCodigo } from "@/lib/flair/nucleos/types";

interface Props {
  codigo: NucleoCodigo;
  regras: DeckRegras;
  cartas: FlairCollectionCard[];
  entrando: boolean;
  erro: ApiError | null;
  onEntrar: (deck: string[]) => void;
}

type Texto = ReturnType<typeof useNucleoText>;

/** 422 DECK_INVALIDO em linhas de texto: o que falta (posição e quantidade), cartas repetidas e o tamanho. */
function faltasDoErro(erro: ApiError, tx: Texto): string[] {
  const d = erro.details ?? {};
  const out: string[] = [];
  const faltam = Array.isArray(d.faltam) ? (d.faltam as { posicao?: string; quantidade?: number }[]) : [];
  for (const f of faltam) {
    const pos = posicoesDaRegra(f.posicao);
    out.push(tx.t("flair3d.ui.deck.lacks", { n: f.quantidade ?? 1, pos: pos.length ? pos.map(tx.posicao).join(" / ") : tx.t("flair3d.ui.deck.any") }));
  }
  if (d.repetidas === true) out.push(tx.t("flair3d.ui.deck.repeated"));
  if (typeof d.tamanho === "number" && typeof d.tamanhoMax === "number" && d.tamanho > d.tamanhoMax) {
    out.push(tx.t("flair3d.ui.deck.counter", { n: d.tamanho, max: d.tamanhoMax }));
  }
  return out;
}

export function NucleoDeck({ codigo, regras, cartas, entrando, erro, onEntrar }: Props) {
  const tx = useNucleoText();
  const [deck, setDeck] = useState<string[]>([]);
  const ids = useMemo(() => cartas.map((c) => c.id), [cartas]);
  const efeitos = useApi((signal) => efeitosDasCartas(codigo, ids, signal), [codigo, ids.join(",")], { enabled: ids.length > 0 });
  const porCarta = useMemo(() => new Map<string, EfeitoItem[]>((efeitos.data?.efeitos ?? []).map((e) => [e.cardId, e.itens])), [efeitos.data]);
  const escolhidas = cartas.filter((c) => deck.includes(c.id));
  const status = conferirDeck(regras, escolhidas);
  const posicoes = (p: string[]) => (p.length ? p.map(tx.posicao).join(" / ") : tx.t("flair3d.ui.deck.any"));
  return (
    <section className="n3d-deck" aria-labelledby="n3d-deck-title" data-testid="nucleo-deck">
      <h2 id="n3d-deck-title" className="type-h3">{tx.t("flair3d.ui.deck.title")}</h2>
      <p className="text-muted">{tx.t("flair3d.ui.deck.lead")}</p>
      <p className="n3d-deck-count tabular" role="status">{tx.t("flair3d.ui.deck.counter", { n: status.total, max: status.tamanhoMax })}</p>
      <ul className="n3d-checklist" aria-label={tx.t("flair3d.ui.deck.mandatory")}>
        {status.obrigatorias.map((o, i) => (
          <li key={i} className={o.falta ? "is-miss" : "is-ok"}>
            {tx.t("flair3d.ui.deck.need", { n: o.regra.quantidade, pos: posicoes(o.posicoes) })}
            {o.falta > 0 && <em>{tx.t("flair3d.ui.deck.missing", { n: o.falta })}</em>}
          </li>
        ))}
      </ul>
      {cartas.length === 0 ? (
        <p className="n3d-empty">{tx.t("flair3d.ui.deck.noCards")}</p>
      ) : (
        <div className="n3d-deck-grid">
          {cartas.map((c) => {
            const dentro = deck.includes(c.id);
            const itens = porCarta.get(c.id) ?? [];
            return (
              <button key={c.id} type="button" aria-pressed={dentro} className={cn("n3d-deck-card", dentro && "is-on")} onClick={() => setDeck((d) => alternarCarta(d, c.id, regras.tamanhoMax))}>
                <FlairGameCard card={c} size="sm" flip={false} interactive={false} />
                <span className="n3d-badges">
                  {itens.length === 0 ? <span className="n3d-badge is-none">{tx.t("flair3d.ui.deck.noEffect")}</span>
                    : itens.map((e, i) => <span key={i} className="n3d-badge">{tx.efeito(e)}</span>)}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {erro && (
        <div className="n3d-error" role="alert">
          <p>{tx.t("flair3d.ui.deck.refused", { msg: erro.message })}</p>
          <ul>{faltasDoErro(erro, tx).map((f, i) => <li key={i}>{f}</li>)}</ul>
        </div>
      )}
      <button type="button" className="btn btn-primary" disabled={!status.valido || entrando} onClick={() => onEntrar(deck)}>
        {tx.t(entrando ? "flair3d.ui.deck.entering" : "flair3d.ui.deck.enter")}
      </button>
    </section>
  );
}
