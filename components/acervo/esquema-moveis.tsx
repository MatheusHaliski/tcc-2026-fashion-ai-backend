"use client";
/**
 * ACERVO — esquema de frente dos móveis (2D), desenhado da mesma planta da cena 3D. Serve ao mapa do closet (compacto)
 * e à view "Meu espaço" sem WebGL (detalhado, com as peças dentro). Cada compartimento é um botão; soltar uma peça em
 * cima move a peça para lá.
 */
import { useState, type CSSProperties, type DragEvent } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { iniciarArrasto, lerArrasto, temArrasto } from "@/lib/acervo/arrasto";
import { COR_HEX } from "@/lib/acervo/opcoes";
import { alturaMaxima, ladoALado, larguraTotal, plantaDoMovel, type Celula } from "@/lib/acervo/planta";
import type { AcervoDesejo, AcervoMovel, AcervoPeca } from "@/lib/acervo/types";

export interface EsquemaProps {
  moveis: AcervoMovel[];
  detalhado?: boolean;
  selecionado?: string | null;
  acesos?: Set<string>;
  /** compartimentos com peças paradas (mapa de uso) */
  parados?: Set<string>;
  marcadores?: Map<string, number[]>;
  pecasDe?: (compartimentoId: string) => AcervoPeca[];
  fantasmasDe?: (compartimentoId: string) => AcervoDesejo[];
  corDe?: (peca: AcervoPeca) => string;
  raioX?: boolean;
  gavetasAbertas?: boolean;
  onEscolher: (compartimentoId: string) => void;
  onSoltar?: (pieceIds: string[], compartimentoId: string) => void;
  onPeca?: (peca: AcervoPeca) => void;
}

const pct = (valor: number, total: number) => `${(valor / total) * 100}%`;
const MAX_PECAS_VISIVEIS = 12;

export function EsquemaMoveis(props: EsquemaProps) {
  const { t } = useI18n();
  const [alvo, setAlvo] = useState<string | null>(null);
  const { moveis } = props;
  const largura = larguraTotal(moveis);
  const altura = alturaMaxima(moveis);
  if (moveis.length === 0 || largura === 0) return null;

  const soltar = (evento: DragEvent, id: string) => {
    evento.preventDefault();
    setAlvo(null);
    const ids = lerArrasto(evento);
    if (ids.length > 0) props.onSoltar?.(ids, id);
  };

  const celula = (movel: AcervoMovel, c: Celula, plantaAltura: number) => {
    const fechada = c.tipo === "GAVETA" && !props.gavetasAbertas;
    const comPorta = movel.porta !== "SEM_PORTA" && c.tipo !== "GAVETA" && !props.raioX;
    const pecas = props.detalhado && !fechada && !comPorta ? props.pecasDe?.(c.id) ?? [] : [];
    const fantasmas = props.detalhado ? props.fantasmasDe?.(c.id) ?? [] : [];
    const numeros = props.marcadores?.get(c.id) ?? [];
    const classes = ["acv-cel", `is-${c.tipo.toLowerCase()}`, props.selecionado === c.id && "is-atual", props.acesos?.has(c.id) && "is-aceso",
      props.parados?.has(c.id) && "is-parado", alvo === c.id && "is-alvo", comPorta && "is-porta", movel.porta === "VIDRO" && "is-vidro"];
    const estilo: CSSProperties = { left: pct(c.x, movel.larguraCm), bottom: pct(c.y, plantaAltura), width: pct(c.w, movel.larguraCm), height: pct(c.h, plantaAltura) };
    return (
      <div key={c.id} className={classes.filter(Boolean).join(" ")} style={estilo} data-compartimento={c.id}>
        <button type="button" className="acv-cel-alvo" aria-pressed={props.selecionado === c.id}
          aria-label={t("acervo.mapa.compartimento", { nome: c.nome, movel: movel.nome, count: c.pecas })}
          onClick={() => props.onEscolher(c.id)}
          onDragOver={(e) => { if (props.onSoltar && temArrasto(e)) { e.preventDefault(); setAlvo(c.id); } }}
          onDragLeave={() => setAlvo(null)} onDrop={(e) => soltar(e, c.id)} />
        {props.detalhado && <span className="acv-cel-nome" aria-hidden>{c.nome} · {c.pecas}</span>}
        {pecas.length > 0 && (
          <span className="acv-cel-pecas">
            {pecas.slice(0, MAX_PECAS_VISIVEIS).map((p) => (
              <button key={p.id} type="button" className="acv-mini" draggable style={{ "--acv-cor-peca": props.corDe?.(p) } as CSSProperties}
                aria-label={t("acervo.peca.abrir", { nome: p.name })} title={p.name}
                onDragStart={(e) => iniciarArrasto(e, [p.id])} onClick={() => props.onPeca?.(p)} />
            ))}
            {pecas.length > MAX_PECAS_VISIVEIS && <span className="acv-mini-mais" aria-hidden>+{pecas.length - MAX_PECAS_VISIVEIS}</span>}
          </span>
        )}
        {fantasmas.map((d) => <span key={d.id} className="acv-mini is-fantasma" title={t("acervo.simulacao.fantasma", { nome: d.nome })} role="img"
          aria-label={t("acervo.simulacao.fantasma", { nome: d.nome })} />)}
        {numeros.length > 0 && <span className="acv-cel-marcadores" aria-hidden>{numeros.map((n) => <span key={n} className="acv-marcador">{n}</span>)}</span>}
      </div>
    );
  };

  return (
    <div className={`acv-esquema${props.detalhado ? " is-detalhado" : ""}`} style={{ aspectRatio: `${largura} / ${altura}` }}>
      {ladoALado(moveis).map(({ movel, x }) => {
        const planta = plantaDoMovel(movel);
        const estilo = {
          left: pct(x, largura),
          width: pct(movel.larguraCm, largura),
          height: pct(movel.alturaCm, altura),
          "--acv-madeira": COR_HEX[movel.cor].base,
          "--acv-veio": COR_HEX[movel.cor].veio,
        } as CSSProperties;
        const classes = ["acv-esq-movel", `is-${movel.material.toLowerCase()}`, movel.modo === "DREAM_SPACE" && "is-dream"];
        return (
          <div key={movel.id} className={classes.filter(Boolean).join(" ")} style={estilo} role="group" aria-label={movel.nome}>
            {planta.celulas.map((c) => celula(movel, c, planta.altura))}
          </div>
        );
      })}
    </div>
  );
}
