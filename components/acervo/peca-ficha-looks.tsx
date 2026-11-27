"use client";
/** ACERVO — looks vinculados: os looks da pessoa que usam a peça e onde encontrar cada item. */
import Link from "next/link";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { acervoApi } from "@/lib/acervo/api";
import type { AcervoLook, AcervoPeca } from "@/lib/acervo/types";
import { useAcervo } from "./acervo-contexto";
import { PecaFoto } from "./peca-card";

export function PecaFichaLooks({ peca }: { peca: AcervoPeca }) {
  const { t } = useI18n();
  const { tela } = useAcervo();
  const looks = useApi<AcervoLook[]>((signal) => acervoApi.looks(peca.id, signal), [peca.id]);

  return (
    <section className="acv-ficha-looks" aria-label={t("acervo.looks.titulo")}>
      <h4 className="acv-ficha-subtitulo">{t("acervo.looks.titulo")}</h4>
      {looks.loading && <p className="acv-dica" role="status">{t("common.loading")}</p>}
      {looks.error && <p className="acv-dica" role="alert">{t("acervo.looks.erro")}</p>}
      {looks.data?.length === 0 && <p className="acv-dica">{t("acervo.looks.vazio")}</p>}
      <ul className="acv-looks">
        {(looks.data ?? []).map((look) => (
          <li key={look.id} className="acv-look">
            <Link href={`/schemes/${encodeURIComponent(look.id)}`} className="acv-look-titulo">{look.title}</Link>
            <ul className="acv-look-itens">
              {look.itens.map((item) => (
                <li key={item.pieceId} className={item.pieceId === peca.id ? "is-esta" : undefined}>
                  <PecaFoto peca={item} />
                  <span className="acv-look-nome">{item.name}</span>
                  {item.compartimentoId
                    ? <button type="button" className="acv-link" onClick={() => { tela.abrirPeca(null); tela.abrirNoEspaco(item.compartimentoId as string); }}>{item.caminho}</button>
                    : <span className="acv-dica">{t(item.minha ? "acervo.dir.semLugar" : "acervo.looks.deOutraPessoa")}</span>}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
