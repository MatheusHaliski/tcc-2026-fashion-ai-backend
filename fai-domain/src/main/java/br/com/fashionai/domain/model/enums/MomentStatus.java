package br.com.fashionai.domain.model.enums;

/** Ciclo de vida do Momento (§55). ENDED nunca some: vira Memória/Histórico (§45). */
public enum MomentStatus {
    DRAFT,
    SCHEDULED,
    ACTIVE,
    ENDED,
    ARCHIVED,
    CANCELLED;

    public boolean live() {
        return this == SCHEDULED || this == ACTIVE;
    }
}
