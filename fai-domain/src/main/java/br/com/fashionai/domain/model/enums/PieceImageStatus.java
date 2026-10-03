package br.com.fashionai.domain.model.enums;

/** RF4 · Processamento de uma imagem da peça. NEEDS_REVIEW = gerada, mas fora da especificação (ex.: barra cortada). */
public enum PieceImageStatus {
    PENDING,
    PROCESSING,
    COMPLETED,
    NEEDS_REVIEW,
    FAILED
}
