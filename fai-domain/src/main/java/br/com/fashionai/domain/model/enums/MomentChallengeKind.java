package br.com.fashionai.domain.model.enums;

/**
 * Tipo de desafio dentro de um Momento (§12, §23–§25): vários desafios por Momento para que estilos diferentes
 * participem. NO_BUY e REDISCOVERY premiam reutilização; ONE_PIECE_MANY_LOOKS avalia versatilidade.
 */
public enum MomentChallengeKind {
    STYLE,
    COLOR,
    THEME,
    NO_BUY,
    REDISCOVERY,
    ONE_PIECE_MANY_LOOKS,
    EXPERIMENTAL,
    REMIX
}
