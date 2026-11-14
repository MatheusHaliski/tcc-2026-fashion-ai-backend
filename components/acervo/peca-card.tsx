"use client";
/**
 * ACERVO — cartão de peça da grade: foto, nome e preço. O botão do canto marca a peça para o subtotal (e ganha um
 * marcador numerado, o mesmo que aparece no móvel); a estrela mostra a favorita. O cartão pode ser arrastado para um
 * compartimento.
 */
import { thumbUrl } from "@/lib/api/client";
import { UiIcon } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import { iniciarArrasto } from "@/lib/acervo/arrasto";
import type { AcervoPeca } from "@/lib/acervo/types";
import { AcervoIcone } from "./acervo-icone";

interface Props {
  peca: AcervoPeca;
  marcador?: number;
  achada?: boolean;
  parada?: boolean;
  lista?: boolean;
  onAbrir: (peca: AcervoPeca) => void;
  onMarcar: (peca: AcervoPeca) => void;
}

export function PecaFoto({ peca, tamanho = 320 }: { peca: Pick<AcervoPeca, "thumbnailUrl">; tamanho?: 320 | 640 }) {
  const url = thumbUrl(peca.thumbnailUrl, tamanho);
  return <span className="acv-foto" aria-hidden>{url && <img src={url} alt="" loading="lazy" draggable={false} />}</span>;
}

export function PecaCard({ peca, marcador, achada, parada, lista, onAbrir, onMarcar }: Props) {
  const { t, fmtPrice } = useI18n();
  const classes = ["acv-card", lista && "is-lista", marcador && "is-marcada", achada && "is-achada", parada && "is-parada"];
  return (
    <li className={classes.filter(Boolean).join(" ")} draggable onDragStart={(e) => iniciarArrasto(e, [peca.id])}>
      <button type="button" className="acv-card-abrir" onClick={() => onAbrir(peca)} aria-label={t("acervo.peca.abrir", { nome: peca.name })}>
        <PecaFoto peca={peca} />
        <span className="acv-card-texto">
          <span className="acv-card-nome">{peca.name}</span>
          <span className="acv-card-preco">{peca.price === null ? t("acervo.semPreco") : fmtPrice(peca.price, peca.currency ?? "BRL")}</span>
          {parada && <span className="acv-card-parada">{t("acervo.uso.parada")}</span>}
        </span>
      </button>
      <button type="button" className="acv-card-marcar" aria-pressed={!!marcador} onClick={() => onMarcar(peca)}
        aria-label={t(marcador ? "acervo.peca.desmarcar" : "acervo.peca.marcar", { nome: peca.name })}>
        {marcador ? <span className="acv-marcador">{marcador}</span> : <UiIcon name="plus" size={16} />}
      </button>
      {peca.favorite && <span className="acv-card-favorita" title={t("common.favorite")}><AcervoIcone nome="estrela" tamanho={14} cheio /></span>}
    </li>
  );
}
