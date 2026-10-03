package br.com.fashionai.domain.model.enums;

/** RF47 · Descoberta ≠ persistência: DISCOVERED (busca externa, ainda oculto) → VALIDATED/PERSISTABLE/REFERENCE_ONLY ou REJECTED. */
public enum CatalogIngestionStatus {
    DISCOVERED,
    VALIDATED,
    PERSISTABLE,
    REFERENCE_ONLY,
    REJECTED
}
