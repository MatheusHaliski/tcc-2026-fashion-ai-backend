package br.com.fashionai.domain.model.enums;

/** Estado da conta (HU-RF1 campos de monitoramento, RF3.CA26-CA28). */
public enum AccountStatus {
    PENDING_EMAIL_VERIFICATION,
    ACTIVE,
    PENDING_VALIDATION,
    SUSPENDED,
    DELETION_SCHEDULED,
    DELETED
}
