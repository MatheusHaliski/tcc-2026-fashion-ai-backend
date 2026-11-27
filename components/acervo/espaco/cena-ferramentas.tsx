"use client";
/**
 * ACERVO — barra da cena: vista de frente ou em perspectiva, girar a câmera (a alternativa por teclado ao arrasto; só com
 * a cena em 3D), abrir as gavetas e Raio-X (portas e frentes de gaveta transparentes).
 */
import { useWebGL } from "@/components/three/common";
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
  /** gira a câmera em graus (negativo = para a esquerda) */
  onGirar?: (graus: number) => void;
}

const PASSO_DO_GIRO = 15;

export function CenaFerramentas({ comRaioX = true, vista, onVista, gavetasAbertas, onGavetas, onGirar }: Props) {
  const { t } = useI18n();
  const { tela } = useAcervo();
  const webgl = useWebGL();
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
      {webgl && onGirar && (
        <>
          <button type="button" className="acv-ferramenta-icone" aria-label={t("acervo.espaco.girarEsquerda")} title={t("acervo.espaco.girarEsquerda")}
            onClick={() => onGirar(-PASSO_DO_GIRO)}>
            <AcervoIcone nome="girarEsquerda" tamanho={16} />
          </button>
          <button type="button" className="acv-ferramenta-icone" aria-label={t("acervo.espaco.girarDireita")} title={t("acervo.espaco.girarDireita")}
            onClick={() => onGirar(PASSO_DO_GIRO)}>
            <AcervoIcone nome="girarDireita" tamanho={16} />
          </button>
        </>
      )}
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
