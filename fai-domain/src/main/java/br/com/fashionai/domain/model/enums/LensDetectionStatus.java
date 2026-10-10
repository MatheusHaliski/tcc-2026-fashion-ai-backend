package br.com.fashionai.domain.model.enums;

/**
 * RF54 · Origem/estado de uma peça detectada: como o detector leu, corrigida pela pessoa ou marcada por ela (peça que o
 * detector não viu). {@link #DISMISSED} ("não é roupa") é derivado de {@code dismissed_at} e só aparece na resposta da
 * própria correção — o scan não lista peças descartadas (e o "desfazer" volta ao estado anterior).
 */
public enum LensDetectionStatus {
    DETECTED,
    CORRECTED,
    ADDED_BY_USER,
    DISMISSED
}
