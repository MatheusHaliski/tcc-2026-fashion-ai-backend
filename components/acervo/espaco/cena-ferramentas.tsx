"use client";
/** ACERVO — barra da cena: vista de frente ou em perspectiva, abrir as gavetas e Raio-X (portas e frentes de gaveta transparentes). */
import { useI18n } from "@/lib/i18n/i18n";
import type { VistaDaCena } from "@/lib/acervo/cena/camera";
import { useAcervo } from "../acervo-contexto";
import { AcervoIcone } from "../acervo-icone";

interface Props {
  /** Há porta ou gaveta nos móveis da cena (sem nenhuma, o Raio-X não teria o que mostrar e sai da barra). */
  comRaioX?: boolean;
  vista: VistaDaCena;
  onVista: (vista: VistaDaCena) => void;
  gavetasAbertas: boolean;
  onGavetas: (abertas: boolean) => void;
}

export function CenaFerramentas({ comRaioX = true, vista, onVista, gavetasAbertas, onGavetas }: Props) {
  const { t } = useI18n();
  const { tela } = useAcervo();
  return (
    <div className="acv-ferramentas" role="toolbar" aria-label={t("acervo.espaco.ferramentas")}>
      <button type="button" aria-pressed={vista === "FRONTAL"} onClick={() => onVista("FRONTAL")}>
        <AcervoIcone nome="frente" tamanho={16} />
        {t("acervo.espaco.frontal")}
      </button>
      <button type="button" aria-pressed={vista === "PERSPECTIVA"} onClick={() => onVista("PERSPECTIVA")}>
        <AcervoIcone nome="cubo" tamanho={16} />
        {t("acervo.espaco.perspectiva")}
      </button>
      <button type="button" aria-pressed={gavetasAbertas} onClick={() => onGavetas(!gavetasAbertas)}>
        <AcervoIcone nome="gaveta" tamanho={16} />
        {t("acervo.espaco.abrirGavetas")}
      </button>
      {comRaioX && (
        <button type="button" aria-pressed={tela.raioX} onClick={() => tela.setRaioX(!tela.raioX)}>
          <AcervoIcone nome="camadas" tamanho={16} />
          {t("acervo.espaco.raioX")}
        </button>
      )}
    </div>
  );
}
