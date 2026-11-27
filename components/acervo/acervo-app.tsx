"use client";
/**
 * ACERVO — o guarda-roupa como espaço navegável. Duas views ligadas: "Central do acervo" (inventário, mapa e painel
 * financeiro) e "Meu espaço" (os móveis em perspectiva). Tudo é privado da dona das peças.
 */
import { useState } from "react";
import { ErrorState, PageHeader, SkeletonGrid } from "@/components/ui";
import { useI18n } from "@/lib/i18n/i18n";
import type { AcervoVista } from "@/lib/acervo/use-acervo-tela";
import { AcervoCentral } from "./acervo-central";
import { AcervoProvider, useAcervo } from "./acervo-contexto";
import { AcervoDiretorio } from "./acervo-diretorio";
import { AcervoVazio } from "./acervo-vazio";
import { AcervoEspaco } from "./espaco/acervo-espaco";
import { PainelFinanceiro } from "./painel-financeiro";
import { PecaFicha } from "./peca-ficha";

const VISTAS: { id: AcervoVista; chave: string }[] = [
  { id: "CENTRAL", chave: "acervo.vista.central" },
  { id: "ESPACO", chave: "acervo.vista.espaco" },
];

function Tela() {
  const { t } = useI18n();
  const { dados, tela } = useAcervo();
  const [diretorioAberto, setDiretorioAberto] = useState(false);
  const atual = VISTAS.find((v) => v.id === tela.vista) ?? VISTAS[0];
  const arvore = dados.arvore;

  return (
    <div className="acv" data-vista={tela.vista} data-modo={tela.modo}>
      {/* o mesmo cabeçalho das outras abas: rótulo, título e texto de apoio com os papéis tipográficos do app */}
      <PageHeader kicker={t("acervo.titulo")} title={t(atual.chave)} lead={t("acervo.privado")} actions={
        <div className="acv-vistas" role="group" aria-label={t("acervo.vista.titulo")}>
          {VISTAS.map((v) => (
            <button key={v.id} type="button" className="acv-pilula" aria-pressed={tela.vista === v.id} onClick={() => tela.setVista(v.id)}>
              {t(v.chave)}
            </button>
          ))}
        </div>
      } />
      {dados.erro && <ErrorState error={dados.erro} onRetry={dados.recarregar} />}
      {dados.carregando && <SkeletonGrid n={6} />}
      {arvore && arvore.ambientes.length === 0 && <AcervoVazio />}
      {arvore && arvore.ambientes.length > 0 && (
        <div className="acv-corpo">
          <div className={`acv-lateral${diretorioAberto ? " is-aberto" : ""}`}>
            <button type="button" className="acv-lateral-botao" aria-expanded={diretorioAberto} onClick={() => setDiretorioAberto(!diretorioAberto)}>
              {t("acervo.dir.titulo")}
            </button>
            <AcervoDiretorio />
          </div>
          {tela.vista === "CENTRAL" ? (
            <>
              <div className="acv-principal"><AcervoCentral /></div>
              <PainelFinanceiro />
            </>
          ) : <AcervoEspaco />}
        </div>
      )}
      <PecaFicha />
    </div>
  );
}

export function AcervoApp() {
  return <AcervoProvider><Tela /></AcervoProvider>;
}
