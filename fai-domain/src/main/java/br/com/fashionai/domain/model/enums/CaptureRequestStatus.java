package br.com.fashionai.domain.model.enums;

/** RF4 · Estado de um pedido de foto complementar. SKIPPED nunca bloqueia: o atributo fica desconhecido/editável. */
public enum CaptureRequestStatus {
    PENDING,
    FULFILLED,
    SKIPPED,
    SUPERSEDED
}
