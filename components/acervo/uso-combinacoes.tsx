"use client";
/**
 * ACERVO — mapa de uso, "combinações pouco exploradas": as peças que ainda não estão em nenhum look (a API diz quais).
 * Cada uma abre a ficha ou começa um look novo com ela. Aparece com o mapa de uso ligado, nas duas views.
 */
import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n";
import { useAcervo } from "./acervo-contexto";
import { AcervoIcone } from "./acervo-icone";
import { PecaFoto } from "./peca-card";

const MAX_NA_LISTA = 8;

export function UsoCombinacoes() {
  const { t } = useI18n();
  const { dados, tela, uso } = useAcervo();
  if (!uso || !dados.arvore) return null;
  const semLook = new Set(uso.pecas.filter((p) => p.semLook).map((p) => p.id));
  const pecas = dados.arvore.pecas.filter((p) => semLook.has(p.id));
  const resto = pecas.length - MAX_NA_LISTA;

  return (
    <section className="acv-combinacoes" aria-label={t("acervo.uso.combinacoes")}>
      <h3 className="acv-cartao-titulo">
        <AcervoIcone nome="roupa" tamanho={16} />
        {t("acervo.uso.combinacoes")}
      </h3>
      <p className="acv-dica">
        {pecas.length === 0 ? t("acervo.uso.todasEmLook") : t("acervo.uso.semLookResumo", { count: pecas.length })}
      </p>
      {pecas.length > 0 && (
        <ul>
          {pecas.slice(0, MAX_NA_LISTA).map((p) => (
            <li key={p.id}>
              <button type="button" className="acv-combinacao-peca" onClick={() => tela.abrirPeca(p.id)}
                aria-label={t("acervo.uso.abrirSemLook", { nome: p.name })}>
                <PecaFoto peca={p} />
                <span>{p.name}</span>
              </button>
              <Link className="acv-link" href={`/schemes/new?pieces=${encodeURIComponent(p.id)}`}
                aria-label={t("acervo.uso.montarLookCom", { nome: p.name })}>
                {t("acervo.uso.montarLook")}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {resto > 0 && <p className="acv-dica">{t("acervo.uso.semLookMais", { count: resto })}</p>}
    </section>
  );
}
