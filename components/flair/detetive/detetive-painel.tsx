"use client";
/**
 * A faixa de baixo do Fashion Detective durante a investigação, no lugar do deck: para onde se pode andar, as ações do
 * ponto (cada uma diz a cor de carta que pede), a mão de cartas, o enigma da sala com a dica depois do erro e, na
 * passarela, o quadro dos suspeitos numerados para a acusação. Escolher uma ação de cor mostra só as cartas daquela cor;
 * tocar na carta joga. O servidor confere tudo de novo e recusa o que não vale.
 */
import { useState } from "react";
import type { ApiError } from "@/lib/api/client";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import { useNucleoText } from "@/components/flair/nucleos/use-nucleo-text";
import { useI18n } from "@/lib/i18n/i18n";
import { contrair } from "@/lib/flair/detetive/contracao";
import { acoesPossiveis, vizinhos, type AcaoDeCor, type AcaoPossivel } from "@/lib/flair/detetive/acoes";
import { SUSPEITOS, type Retrato } from "@/lib/flair/detetive/types";
import { corDoEfeito, efeitoDaCor } from "@/lib/flair/nucleos/card-fx";
import type { EfeitoItem } from "@/lib/flair/nucleos/types";

export interface CartaDoDetetive {
  card: FlairCollectionCard;
  acao: AcaoDeCor | null;
  cor: string | null;
}

/** A ação e a cor de cada carta da mão, pelos selos do servidor (COR_<ação>). */
export function cartasDoDetetive(mao: string[], cartas: FlairCollectionCard[], itens: (cardId: string) => EfeitoItem[] | undefined): CartaDoDetetive[] {
  return mao.flatMap((id) => {
    const card = cartas.find((c) => c.id === id);
    if (!card) return [];
    const efeito = efeitoDaCor(itens(id));
    const acao = efeito?.codigo.startsWith("COR_") ? (efeito.codigo.slice(4) as AcaoDeCor) : null;
    return [{ card, acao, cor: corDoEfeito(efeito) }];
  });
}

interface Props {
  r: Retrato;
  mao: CartaDoDetetive[];
  ocupado: boolean;
  erro: ApiError | null;
  onAcao: (alvo: string, cardId?: string) => void;
}

export function DetetivePainel({ r, mao, ocupado, erro, onAcao }: Props) {
  const tx = useNucleoText();
  const { locale } = useI18n();
  const [pedida, setPedida] = useState<AcaoPossivel | null>(null);
  const nomeDe = (a: AcaoPossivel) => {
    const assunto = a.verbo === "IR" ? tx.t(`flair3d.detetive.ponto.${a.assunto}`) : a.verbo === "PORTA" || a.verbo === "AJUDA" ? tx.t(`flair3d.detetive.sala.${a.assunto}`)
      : a.verbo === "ABRIR" ? tx.t(`flair3d.detetive.armario.${a.assunto}`) : a.verbo === "BOLSO" || a.verbo === "CONFRONTO" ? tx.ou(`flair3d.detetive.vigia.${a.assunto}`, a.assunto)
        : a.verbo === "MERCADO" ? tx.t(`flair3d.detetive.compra.${a.assunto}`) : a.assunto;
    return contrair(tx.t(`flair3d.detetive.verbo.${a.verbo}`, { assunto }), locale);
  };
  const fazer = (a: AcaoPossivel, cardId?: string) => {
    setPedida(null);
    onAcao(a.alvo, cardId);
  };
  if (r.final) return <p className="dtv-painel-fim" role="status">{tx.t(`flair3d.detetive.final.${r.final}`)}</p>;
  const acoes = acoesPossiveis(r);
  const andar = vizinhos(r).map((p): AcaoPossivel => ({ alvo: `IR:${p}`, verbo: "IR", assunto: p, cor: null }));
  const serve = (c: CartaDoDetetive) => !!pedida && (pedida.cor === "QUALQUER" || c.acao === pedida.cor);
  const daCor = mao.filter(serve);
  const enigma = r.layout.enigma && !r.resolvidas.includes(r.sala) ? r.layout.enigma : null;
  return (
    <div className="dtv-painel" data-testid="detetive-painel" aria-busy={ocupado || undefined}>
      {erro && <p className="dtv-erro" role="alert">{erro.message}</p>}
      {r.sala === "PASSARELA" && (
        <section className="dtv-bloco" data-testid="detetive-acusacao">
          <h4>{tx.t("flair3d.detetive.ui.acusar")}</h4>
          <div className="dtv-suspeitos">
            {SUSPEITOS.map((n) => (
              <button key={n} type="button" className="btn btn-sm dtv-suspeito" disabled={ocupado} onClick={() => onAcao(`ACUSAR:${n}`)}>
                <b>{n}</b> {tx.t(`flair3d.detetive.suspeito.${n}.nome`)}<small>{tx.t(`flair3d.detetive.suspeito.${n}.papel`)}</small>
              </button>
            ))}
          </div>
        </section>
      )}
      {enigma && (
        <section className="dtv-bloco" data-testid="detetive-enigma">
          <h4>{tx.t(`flair3d.detetive.enigma.${enigma.id}.pergunta`)}</h4>
          {r.dica && <p className="dtv-dica">{tx.t(`flair3d.detetive.enigma.${enigma.id}.dica`)}</p>}
          <div className="dtv-acoes">
            {enigma.opcoes.map((o, i) => <button key={o} type="button" className="btn btn-sm" disabled={ocupado} onClick={() => onAcao(`ENIGMA:${i}`)}>{tx.t(`flair3d.detetive.enigma.${enigma.id}.${o}`)}</button>)}
          </div>
        </section>
      )}
      <section className="dtv-bloco">
        <div className="dtv-acoes">
          {[...acoes, ...andar].map((a) => (
            <button key={a.alvo} type="button" className={`btn btn-sm dtv-acao${pedida?.alvo === a.alvo ? " is-pedida" : ""}`} disabled={ocupado} data-alvo={a.alvo}
              onClick={() => (a.cor ? setPedida(pedida?.alvo === a.alvo ? null : a) : fazer(a))}>
              {a.cor && <i className={`dtv-cor is-${a.cor}`} aria-hidden />}{nomeDe(a)}
            </button>
          ))}
          <button type="button" className="btn btn-sm dtv-acao" disabled={ocupado} onClick={() => onAcao("ESPERAR")}>{tx.t("flair3d.detetive.verbo.ESPERAR")}</button>
        </div>
        {pedida && (
          <p className="dtv-pede" role="status">
            {daCor.length ? tx.t("flair3d.detetive.ui.escolhaCarta", { cor: tx.t(`flair3d.detetive.cor.${pedida.cor}`) }) : tx.t("flair3d.detetive.ui.semCarta", { cor: tx.t(`flair3d.detetive.cor.${pedida.cor}`) })}
          </p>
        )}
      </section>
      <ul className="dtv-mao" aria-label={tx.t("flair3d.detetive.ui.mao")} data-testid="detetive-mao">
        {mao.map((c) => {
          const pode = serve(c);
          return (
            <li key={c.card.id}>
              <button type="button" className={`dtv-carta${pode ? " is-serve" : ""}`} disabled={!pode || ocupado} onClick={() => pedida && fazer(pedida, c.card.id)}
                style={{ borderColor: c.cor ?? undefined }} data-acao={c.acao ?? "NENHUMA"}>
                <span className="dtv-carta-cor" style={{ background: c.cor ?? "#444" }} aria-hidden />
                <span className="dtv-carta-nome">{c.card.name}</span>
                <small>{c.acao ? tx.t(`flair3d.detetive.cor.${c.acao}`) : tx.t("flair3d.detetive.cor.NENHUMA")}</small>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
