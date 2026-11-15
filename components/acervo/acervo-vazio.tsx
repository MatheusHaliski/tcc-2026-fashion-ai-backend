"use client";
/**
 * ACERVO — primeiro acesso: ainda não há ambiente. Um botão cria o primeiro ambiente e o primeiro armário; depois a
 * lista "sem lugar" mostra as peças que já estão no guarda-roupa para a pessoa guardar.
 */
import Link from "next/link";
import { Button } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import { acervoApi } from "@/lib/acervo/api";
import { movelPadrao } from "@/lib/acervo/opcoes";
import { useAcervo } from "./acervo-contexto";
import { AcervoIcone } from "./acervo-icone";

export function AcervoVazio() {
  const { t } = useI18n();
  const { dados, tela } = useAcervo();
  const total = dados.arvore?.total ?? 0;

  async function comecar() {
    const ok = await dados.executar(async () => {
      const ambiente = await acervoApi.criarAmbiente(t("acervo.vazio.nomeAmbiente"));
      await acervoApi.criarMovel(ambiente.id, movelPadrao("MEU_ESPACO", t("acervo.vazio.nomeMovel")));
    }, t("acervo.vazio.criado"));
    if (ok) tela.setLocal({ tipo: total > 0 ? "SEM_LUGAR" : "TODAS" });
  }

  return (
    <section className="acv-cartao acv-vazio" aria-label={t("acervo.vazio.titulo")}>
      <AcervoIcone nome="armario" tamanho={40} />
      <h2 className="acv-vazio-titulo">{t("acervo.vazio.titulo")}</h2>
      <p>{t("acervo.vazio.texto")}</p>
      <ol className="acv-vazio-passos">
        <li>{t("acervo.vazio.passo1")}</li>
        <li>{t("acervo.vazio.passo2")}</li>
        <li>{total > 0 ? t("acervo.vazio.passo3", { count: total }) : t("acervo.vazio.passo3SemPecas")}</li>
      </ol>
      <div className="acv-vazio-acoes">
        <Button variant="primary" loading={dados.ocupado} onClick={() => { void comecar(); }}>{t("acervo.vazio.comecar")}</Button>
        {total === 0 && <Link href="/pieces/new" className="btn">{t("closet.addPiece")}</Link>}
      </div>
    </section>
  );
}
