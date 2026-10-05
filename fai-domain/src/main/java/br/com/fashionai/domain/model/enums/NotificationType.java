package br.com.fashionai.domain.model.enums;

/**
 * RNF10 — taxonomia de notificações. Os tipos de segurança são transacionais e nunca desativáveis;
 * os sociais são desativáveis por tipo em Configurações → Privacidade → Notificações (RF23/RF3.CA36).
 */
public enum NotificationType {
    PASSWORD_RESET(NotificationCategory.SECURITY, false),
    TWO_FACTOR_CODE(NotificationCategory.SECURITY, false),
    NEW_LOGIN_DEVICE(NotificationCategory.SECURITY, false),
    EMAIL_CONFIRMATION(NotificationCategory.SECURITY, false),
    DATA_EXPORT_READY(NotificationCategory.SECURITY, false),
    FOLLOW_REQUEST(NotificationCategory.SOCIAL, true),
    FOLLOW_ACCEPTED(NotificationCategory.SOCIAL, true),
    NEW_FOLLOWER(NotificationCategory.SOCIAL, true),
    NEW_COMMENT(NotificationCategory.SOCIAL, true),
    NEW_LIKE(NotificationCategory.SOCIAL, true),
    NEW_REACTION(NotificationCategory.SOCIAL, true),
    NEW_REMIX(NotificationCategory.SOCIAL, true),
    SEAL_GRANTED(NotificationCategory.ACHIEVEMENT, true),
    FEATURED_SCHEME(NotificationCategory.ACHIEVEMENT, true),
    SEAL_BOND_REVIEW(NotificationCategory.ACHIEVEMENT, true),
    WELCOME(NotificationCategory.SYSTEM, false),
    PIECE_CREATED(NotificationCategory.SYSTEM, true),
    SCHEME_CREATED(NotificationCategory.SYSTEM, true),
    AI_JOB_FINISHED(NotificationCategory.SYSTEM, true),
    ACCOUNT_APPROVAL(NotificationCategory.SYSTEM, false),
    /** Para administradores: perfil de marca/celebridade enviado (ou reenviado) para a fila de verificação. */
    ISSUER_REVIEW_REQUEST(NotificationCategory.SYSTEM, false),
    /** Foto enviada retida pela moderação (docs/seguranca/moderacao-de-imagens.md): aprovada ou recusada na revisão humana. */
    CONTENT_REVIEW(NotificationCategory.SYSTEM, false),
    DAILY_LOOK(NotificationCategory.SOCIAL, true),
    /** RF36 — convite para desafio (Equipe/Duelo) e resultado. Nunca há notificação de culpa ou de perda (ETI-02). */
    CHALLENGE_INVITE(NotificationCategory.SOCIAL, true),
    CHALLENGE_RESULT(NotificationCategory.ACHIEVEMENT, true),
    /** RF34 §4.3 / RF35 §5.3 — conquista desbloqueada e evolução do quarto. */
    ACHIEVEMENT_UNLOCKED(NotificationCategory.ACHIEVEMENT, true),
    ROOM_LEVEL_UP(NotificationCategory.ACHIEVEMENT, true),
    /** Card Trello RF38 — "Parabéns! Deseja resgatar o CUPOM?" (direito promocional conquistado no app). */
    COUPON_AVAILABLE(NotificationCategory.ACHIEVEMENT, true),
    /** RF30/RF39 — extrato dos FAI Points: cada lançamento do ledger (ganho ou gasto) vira uma notificação. */
    FAI_POINTS(NotificationCategory.POINTS, true);

    private final NotificationCategory category;
    private final boolean optOutAllowed;

    NotificationType(NotificationCategory category, boolean optOutAllowed) {
        this.category = category;
        this.optOutAllowed = optOutAllowed;
    }

    public NotificationCategory category() {
        return category;
    }

    public boolean optOutAllowed() {
        return optOutAllowed;
    }
}
