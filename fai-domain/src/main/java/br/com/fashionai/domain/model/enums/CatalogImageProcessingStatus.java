package br.com.fashionai.domain.model.enums;

/**
 * RF47 · Estado da foto oficial no pipeline de imagens do catálogo (CATALOG_IMAGE_PIPELINE_V2). Os intermediários
 * mostram em que etapa o job está; os finais são APPROVED (vira foto do acervo), NEEDS_REVIEW (fila do admin),
 * REJECTED (nunca aparece; o produto usa outra foto ou a ilustração da categoria) e FAILED (erro técnico, reprocessável).
 */
public enum CatalogImageProcessingStatus {
    PENDING,
    FETCHING,
    VALIDATING,
    ANALYZING,
    FRAMING,
    RENDERING,
    QUALITY_CHECK,
    NEEDS_REVIEW,
    APPROVED,
    REJECTED,
    FAILED;

    public boolean terminal() {
        return this == NEEDS_REVIEW || this == APPROVED || this == REJECTED || this == FAILED;
    }
}
