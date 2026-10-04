package br.com.fashionai.domain.model.enums;

/**
 * Leitura qualitativa do movimento do HypeScore v2: trend ≠ popularidade. CLASSIC = relevância sustentada com pouco
 * crescimento (longevidade alta); EMERGING = crescimento acelerado a partir de uma base pequena.
 */
public enum HypeMomentum {
    EMERGING,
    RISING,
    STABLE,
    COOLING,
    CLASSIC
}
