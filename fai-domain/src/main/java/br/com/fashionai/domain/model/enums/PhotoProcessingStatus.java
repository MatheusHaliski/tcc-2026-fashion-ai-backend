package br.com.fashionai.domain.model.enums;

/** RF4 — ciclo da foto: moderação (RF24) antes do pipeline Flat Lay (RF4-maquinadeestados-v2). */
public enum PhotoProcessingStatus {
    NEW,
    MODERATING,
    PROCESSING,
    COMPLETED,
    NEEDS_REUPLOAD,
    FAILED
}
