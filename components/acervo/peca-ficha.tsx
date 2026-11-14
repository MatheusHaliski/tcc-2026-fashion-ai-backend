"use client";
/**
 * ACERVO — ficha da peça: foto, tamanho, medidas, cor, marca, preço, conservação e localização, com "Mover para…",
 * os looks vinculados e as entradas para o Passaporte, o Editor 3D e os Tamanhos da peça. O que falta aparece como
 * "Não informado".
 */
import Link from "next/link";
import { Button, Sheet } from "@/components/ui";
import { label, subcategoryLabel } from "@/lib/api/taxonomy";
import { useI18n } from "@/lib/i18n/i18n";
import { useAcervo } from "./acervo-contexto";
import { AcervoIcone } from "./acervo-icone";
import { PecaFoto } from "./peca-card";
import { PecaFichaIntegracoes } from "./peca-ficha-integracoes";
import { PecaFichaLooks } from "./peca-ficha-looks";
import { PecaFichaMedidas, resumoDasMedidas } from "./peca-ficha-medidas";
import { PecaFichaMover } from "./peca-ficha-mover";
import { usePecasParadas } from "./use-acervo-destaques";

const CONDICOES = ["NEW", "GOOD", "WORN", "DAMAGED"];

export function PecaFicha() {
  const { t, fmtPrice, fmtDate, fmtNumber } = useI18n();
  const { dados, tela, uso } = useAcervo();
  const paradas = usePecasParadas();
  const peca = dados.arvore?.pecas.find((p) => p.id === tela.pecaAberta) ?? null;
  if (!peca) return null;

  const vazio = t("acervo.naoInformado");
  const conservacao = peca.conservacao ?? (peca.condition && CONDICOES.includes(peca.condition) ? t(`acervo.condicao.${peca.condition.toLowerCase()}`) : null);
  const medidas = resumoDasMedidas(peca, (n) => fmtNumber(n, { maximumFractionDigits: 1 }));
  const usoDaPeca = uso?.pecas.find((p) => p.id === peca.id);
  const linhas: [string, string | null][] = [
    [t("acervo.ficha.tipo"), peca.subcategory ? subcategoryLabel(peca.subcategory) : label(peca.category)],
    [t("common.size"), peca.size],
    [t("acervo.ficha.medidas"), medidas],
    [t("common.color"), peca.color ? label(peca.color) : null],
    [t("common.brand"), peca.brand],
    [t("common.price"), peca.price === null ? null : fmtPrice(peca.price, peca.currency ?? "BRL")],
    [t("acervo.ficha.conservacao"), conservacao],
    [t("acervo.ficha.ultimoUso"), peca.lastWornDate ? fmtDate(peca.lastWornDate) : t("acervo.ficha.semUso")],
  ];

  return (
    <Sheet open onClose={() => tela.abrirPeca(null)} title={peca.name}>
      <div className="acv acv-ficha" data-testid="acervo-ficha">
        <div className="acv-ficha-topo">
          <PecaFoto peca={peca} tamanho={640} />
          {peca.favorite && <span className="acv-card-favorita" title={t("common.favorite")}><AcervoIcone nome="estrela" tamanho={16} cheio /></span>}
        </div>
        {paradas.has(peca.id) && (
          <p className="acv-ficha-aviso">
            {usoDaPeca?.nuncaUsada ? t("acervo.uso.nuncaUsada") : t("acervo.uso.esquecida", { dias: usoDaPeca?.diasSemUso ?? 0 })}
          </p>
        )}
        <dl className="acv-ficha-dados">
          {linhas.map(([rotulo, valor]) => (
            <div key={rotulo}>
              <dt>{rotulo}</dt>
              <dd className={valor ? undefined : "is-vazio"}>{valor ?? vazio}</dd>
            </div>
          ))}
        </dl>
        <p className="acv-ficha-local">
          <AcervoIcone nome="local" tamanho={16} />
          <span>{peca.caminho ?? t("acervo.dir.semLugar")}</span>
          {peca.compartimentoId && (
            <button type="button" className="acv-link" onClick={() => { tela.abrirPeca(null); tela.abrirNoEspaco(peca.compartimentoId as string); }}>
              {t("acervo.ficha.verNoEspaco")}
            </button>
          )}
        </p>
        <PecaFichaMover peca={peca} />
        <PecaFichaMedidas peca={peca} />
        <PecaFichaIntegracoes peca={peca} />
        <PecaFichaLooks peca={peca} />
        <div className="acv-ficha-acoes">
          <Button size="sm" aria-pressed={tela.selecao.includes(peca.id)} onClick={() => tela.alternarSelecao(peca.id)}>
            {t(tela.selecao.includes(peca.id) ? "acervo.ficha.tirarDoSubtotal" : "acervo.ficha.somarNoSubtotal")}
          </Button>
          <Link href={`/pieces/${encodeURIComponent(peca.id)}`} className="btn btn-sm">{t("acervo.ficha.abrirPeca")}</Link>
        </div>
      </div>
    </Sheet>
  );
}
