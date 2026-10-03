package br.com.fashionai.domain.model.enums;

/** RF47 · Estado da página/imagem de origem (revalidação periódica: URLs externas não são eternas). */
public enum CatalogSourceStatus {
    ACTIVE,
    UNAVAILABLE,
    SOURCE_REMOVED,
    NEEDS_REVALIDATION
}
