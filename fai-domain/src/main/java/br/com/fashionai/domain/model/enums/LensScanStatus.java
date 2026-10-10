package br.com.fashionai.domain.model.enums;

/**
 * RF54 · Estado do scan. O MVP processa de forma síncrona: o scan já nasce num estado final. {@link #PARTIAL} = parte das
 * relações não pôde ser calculada; {@link #NO_FASHION_FOUND} = nenhuma peça na foto (a pessoa ainda pode marcar uma).
 */
public enum LensScanStatus {
    READY,
    PARTIAL,
    NO_FASHION_FOUND,
    FAILED
}
