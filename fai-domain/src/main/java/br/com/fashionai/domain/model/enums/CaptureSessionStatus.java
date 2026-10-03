package br.com.fashionai.domain.model.enums;

/** RF4 · Ciclo da sessão de captura: aberta → aguardando foto complementar (opcional) → pronta para revisão → concluída. */
public enum CaptureSessionStatus {
    ANALYZING,
    AWAITING_CAPTURE,
    READY_FOR_REVIEW,
    COMPLETED,
    ABANDONED
}
