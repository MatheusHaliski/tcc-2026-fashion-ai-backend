package br.com.fashionai.domain.model.enums;

/** RF47 · Decisão do admin na fila de revisão das fotos oficiais (CatalogImageReviewQueue). */
public enum CatalogImageReviewAction {
    APPROVE,
    REPROCESS,
    SELECT_ALTERNATE_IMAGE,
    REJECT
}
