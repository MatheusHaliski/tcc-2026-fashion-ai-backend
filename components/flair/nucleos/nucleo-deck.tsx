"use client";
/**
 * Momento 1, o deck (antes da partida): as cartas FLAIR da pessoa, cada uma com o selo do efeito dela neste núcleo
 * (POST .../efeitos), o contador do deck, as obrigatórias com o que falta e "Entrar na partida", ativo só com o deck
 * válido. Toque longo ou a tecla I ampliam a carta. Um 422 do servidor ao abrir mostra a mensagem e o que falta.
 */
import { useState } from "react";
import { cn } from "@/components/ui";
import type { ApiError } from "@/lib/api/client";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import { NucleoCard } from "@/components/flair/nucleos/nucleo-card";
import { NucleoCardZoom } from "@/components/flair/nucleos/nucleo-card-zoom";
import { useCardZoom } from "@/components/flair/nucleos/use-card-zoom";
import { useNucleoEffects } from "@/components/flair/nucleos/use-nucleo-effects";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { useNucleoViewport } from "@/components/flair/nucleos/use-nucleo-viewport";
import { seloDaCarta } from "@/lib/flair/nucleos/card-fx";
import { alternarCarta, conferirDeck, posicoesDaRegra } from "@/lib/flair/nucleos/deck";
import { estiloDoQuadro } from "@/lib/flair/nucleos/quadro";
import type { DeckRegras, NucleoCodigo } from "@/lib/flair/nucleos/types";

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
  const layout = useNucleoViewport();
  const [deck, setDeck] = useState<string[]>([]);
  const [foco, setFoco] = useState<FlairCollectionCard | null>(null);
  const efeitos = useNucleoEffects(codigo, cartas);
  const zoom = useCardZoom(foco);
  const escolhidas = cartas.filter((c) => deck.includes(c.id));
  const status = conferirDeck(regras, escolhidas);
  const posicoes = (p: string[]) => (p.length ? p.map(tx.posicao).join(" / ") : tx.t("flair3d.ui.deck.any"));

  const alternar = (c: FlairCollectionCard) => {
    setFoco(c);
    if (zoom.consumirClique()) return;
    setDeck((d) => alternarCarta(d, c.id, regras.tamanhoMax));
  };

  const carta = (c: FlairCollectionCard) => {
    const dentro = deck.includes(c.id);
    const achado = seloDaCarta(efeitos.porCarta.get(c.id));
    const selo = achado ? tx.efeito(achado) : tx.t("flair3d.ui.deck.noEffect");
    const rotulo = `${tx.t("flair3d.ui.card.aria", { nome: c.name, pos: tx.posicao(c.position) })}, ${selo}`;
    return (
      <button
        key={c.id}
        type="button"
        aria-pressed={dentro}
        aria-label={rotulo}
        title={rotulo}
        className={cn("n3d-deck-card", dentro && "is-on")}
        onFocus={() => setFoco(c)}
        onClick={() => alternar(c)}
        {...zoom.toque(c)}
      >
        <NucleoCard card={c} selo={selo} semEfeito={!achado} emUso={dentro ? tx.t("flair3d.ui.deck.inDeck") : null} />
      </button>
    );
  };

  return (
    <section className="n3d-deck" style={estiloDoQuadro(layout)} aria-labelledby="n3d-deck-title" data-testid="nucleo-deck" data-momento="DECK">
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
        <div className="n3d-deck-grid">{cartas.map(carta)}</div>
      )}
      {erro && (
        <div className="n3d-error" role="alert">
          <p>{tx.t("flair3d.ui.deck.refused", { msg: erro.message })}</p>
          <ul>
            {faltasDoErro(erro, tx).map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}
      <button type="button" className="btn btn-primary n3d-deck-enter" disabled={!status.valido || entrando} onClick={() => onEntrar(deck)}>
        {tx.t(entrando ? "flair3d.ui.deck.entering" : "flair3d.ui.deck.enter")}
      </button>
      {zoom.ampliada && <NucleoCardZoom card={zoom.ampliada} itens={efeitos.itens(zoom.ampliada.id)} onFechar={zoom.fechar} />}
    </section>
  );
}
