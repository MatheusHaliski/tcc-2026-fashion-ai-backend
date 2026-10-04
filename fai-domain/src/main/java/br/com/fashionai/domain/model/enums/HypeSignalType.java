package br.com.fashionai.domain.model.enums;

/**
 * HypeScore v2 — sinais de comportamento agregados por dia em {@code hype_signal_daily}. Os eventos de interação chegam
 * pelo {@code DomainEvents.HypeSignal}; os de uso pelos eventos de uso já existentes (peça vestida, look do dia, look salvo).
 */
public enum HypeSignalType {
    LIKE_CREATED,
    COMMENT_CREATED,
    SAVE_CREATED,
    SHARE_CREATED,
    FAVORITE_CREATED,
    /** look usado como base de outro look (remix/fork) */
    LOOK_REMIXED,
    /** peça usada como semente de um remix */
    PIECE_REMIXED,
    LOOK_VIEWED,
    PIECE_VIEWED,
    /** peça vestida (diário de uso) */
    PIECE_USED,
    /** peça incluída num look salvo */
    PIECE_IN_LOOK,
    /** look marcado como look do dia */
    LOOK_WORN
}
