"use client";
/**
 * Bandeja de cartas da vaga em destaque, presa embaixo da tela, ao alcance do polegar, sem cobrir o tabuleiro e sem
 * empurrar a página: tocar numa carta põe na vaga; arrastar leva a qualquer vaga. As cartas que cabem vêm primeiro
 * (com o que têm em comum com as vizinhas); as que não cabem ficam apagadas, com o motivo numa linha. No cabeçalho:
 * o que a vaga aceita, tirar a carta da vaga, desfazer a última jogada e fechar. A vaga em destaque nunca fica atrás
 * da bandeja (use-vaga-a-vista.ts).
 */
import { useEffect, useRef } from "react";
import type { PointerEvent, ReactNode } from "react";
import { mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { cn } from "@/components/ui";
import { useMovimentoReduzido } from "@/components/flair/cenas/use-cena-viva";
import { useVagaAVista } from "@/components/flair/montagem/use-vaga-a-vista";
import type { Opcao } from "@/lib/flair/montagem/opcoes";

export interface BandejaProps {
  /** chave da vaga em destaque (a lista volta ao começo quando ela muda) */
  vagaId: string;
  /** nome da vaga em destaque */
  vaga: string;
  /** o que a vaga aceita (posição por extenso) */
  aceita: string;
  opcoes: Opcao[];
  /** só as cartas que cabem podem ser postas (elencos); senão as outras entram apagadas, mas entram (desafios) */
  estrita: boolean;
  /** índice da carta em foco pelo teclado ou controle, ou null */
  foco: number | null;
  temCarta: boolean;
  podeDesfazer: boolean;
  onEscolher: (opcao: Opcao) => void;
  onTirar: () => void;
  onDesfazer: () => void;
  onFechar: () => void;
  pegar: (cardId: string, origem: string | null) => (e: PointerEvent<HTMLElement>) => void;
  /** nome por extenso de uma posição e de um atributo em comum */
  posicao: (codigo: string) => string;
  atributo: (codigo: string) => string;
  /** aviso da última jogada (lido por leitores de tela) */
  aviso?: string;
  vazio?: ReactNode;
}

export function Bandeja(p: BandejaProps) {
  const { t } = useI18n();
  const lista = useRef<HTMLUListElement>(null);
  const caixa = useRef<HTMLElement>(null);
  useVagaAVista(p.vagaId, caixa, useMovimentoReduzido());
  useEffect(() => {
    if (lista.current) lista.current.scrollLeft = 0;
  }, [p.vagaId]);
  return (
    <section ref={caixa} className="mt-tray" role="region" aria-label={t("flair.mesa.tray", { vaga: p.vaga })} data-testid="mesa-bandeja" data-drop-remove>
      <div className="mt-tray-head">
        <p className="mt-tray-title">
          <b>{p.vaga}</b>
          {p.aceita !== p.vaga && <span>{t("flair.mesa.accepts", { posicao: p.aceita })}</span>}
        </p>
        <div className="mt-tray-actions">
          {p.temCarta && <button type="button" className="btn btn-sm" onClick={p.onTirar}>{t("flair.mesa.remove")}</button>}
          <button type="button" className="btn btn-sm" onClick={p.onDesfazer} disabled={!p.podeDesfazer}>{t("flair.mesa.undo")}</button>
          <button type="button" className="btn btn-sm" onClick={p.onFechar} aria-label={t("flair.mesa.close")}>×</button>
        </div>
      </div>
      <p className="sr-only" role="status" aria-live="polite">{p.aviso ?? ""}</p>
      {p.opcoes.length === 0 ? (p.vazio ?? <p className="mt-tray-empty">{t("flair.mesa.empty")}</p>) : (
        <ul ref={lista} className="mt-cards" aria-label={t("flair.mesa.cards", { vaga: p.vaga })}>
          {p.opcoes.map((o, i) => {
            const bloqueada = p.estrita && !o.cabe;
            const nota = o.aqui ? t("flair.mesa.here")
              : !o.cabe ? t("flair.mesa.off", { posicao: p.posicao(o.card.position), pede: p.aceita })
              : o.outraVaga ? t("flair.mesa.swap")
              : o.comum.length ? t("flair.mesa.common", { lista: o.comum.map(p.atributo).join(", ") })
              : p.posicao(o.card.position);
            return (
              <li key={o.card.id}>
                <button type="button" data-card={o.card.id} aria-pressed={o.aqui} aria-disabled={bloqueada || undefined}
                  className={cn("mt-card", `tier-${o.card.tier.toLowerCase()}`, o.aqui && "is-here", !o.cabe && "is-off", o.comum.length > 0 && o.cabe && "is-match", i === p.foco && "is-focus")}
                  aria-label={`${t("flair.mesa.place", { nome: o.card.name })} · ${o.card.ovr} · ${nota}`}
                  onClick={() => !bloqueada && p.onEscolher(o)} onPointerDown={p.pegar(o.card.id, o.outraVaga)}>
                  <span className="mt-card-art">
                    {o.card.imageUrl ? <img src={mediaUrl(o.card.imageUrl)} alt="" loading="lazy" decoding="async" draggable={false} /> : null}
                    <b className="tabular">{o.card.ovr}</b>
                  </span>
                  <span className="mt-card-name">{o.card.name}</span>
                  <span className="mt-card-note">{nota}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-tray-hint">{t("flair.mesa.hint")}</p>
    </section>
  );
}
