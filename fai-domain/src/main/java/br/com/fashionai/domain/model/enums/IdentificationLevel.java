package br.com.fashionai.domain.model.enums;

/** RF4 · Níveis da identificação do produto, cada um com confiança independente (marca ≠ modelo exato). */
public enum IdentificationLevel {
    CATEGORY,
    SUBCATEGORY,
    BRAND,
    PRODUCT_LINE,
    MODEL,
    VARIANT
}
