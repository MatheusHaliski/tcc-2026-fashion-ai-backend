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
    DAILY_LOOK(NotificationCategory.SOCIAL, true);

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
