package br.com.fashionai.domain.model.enums;

/**
 * RF47 · Como o resultado do pipeline existe. PARAMETRIC: só parâmetros (janela de recorte, cor do fundo, métricas) —
 * a foto oficial é exibida pela URL original com o enquadramento aplicado na tela. MATERIALIZED: master e variantes
 * gravados no nosso storage (exige {@link CatalogImageRights#DERIVE_PUBLISH}).
 */
public enum CatalogImageProcessingMode {
    PARAMETRIC,
    MATERIALIZED
}
