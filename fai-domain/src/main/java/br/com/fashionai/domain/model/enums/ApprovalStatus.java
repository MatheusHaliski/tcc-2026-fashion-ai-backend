package br.com.fashionai.domain.model.enums;

public enum ApprovalStatus {
    PENDENTE,
    /** Analista pediu ajustes que a própria pessoa corrige e reenvia pela Central do emissor. */
    AJUSTES,
    APROVADO,
    RECUSADO,
    SUSPENSO
}
