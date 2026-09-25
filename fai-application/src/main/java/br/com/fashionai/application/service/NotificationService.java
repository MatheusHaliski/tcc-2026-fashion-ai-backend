package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.ports.NotificationProjectionPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Notification;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.UserPreferences;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.repository.NotificationRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * RNF10 (sino da topbar do chrome) + gestão do RF3 (CA34–CA37): central de notificações, marcar lidas,
 * preferências por tipo e expurgo de 90 dias. Tipo desativado pelo destinatário conta, mas não é entregue
 * (RF19.CA12); tipos de segurança nunca são desativáveis.
 */
@Service
public class NotificationService {
    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);
    public static final Duration RETENTION = Duration.ofDays(90);

    private final NotificationRepository notifications;
    private final UserRepository users;
    private final UserPreferencesRepository preferences;
    private final NotificationProjectionPort projection;

    public NotificationService(NotificationRepository notifications, UserRepository users,
                               UserPreferencesRepository preferences, NotificationProjectionPort projection) {
        this.notifications = notifications;
        this.users = users;
        this.preferences = preferences;
        this.projection = projection;
    }

    @Transactional
    public Notification notify(UUID recipientId, UUID actorId, NotificationType type, String resourceType, UUID resourceId,
                               String title, String body, Map<String, Object> payload) {
        if (recipientId == null || (actorId != null && actorId.equals(recipientId) && type.optOutAllowed()
                && type.category() == br.com.fashionai.domain.model.enums.NotificationCategory.SOCIAL)) {
            return null;
        }
        User recipient = users.findById(recipientId).orElse(null);
        if (recipient == null) {
            return null;
        }
        Notification n = new Notification();
        n.setRecipient(recipient);
        n.setActor(actorId == null ? null : users.findById(actorId).orElse(null));
        n.setType(type);
        n.setCategory(type.category());
        n.setResourceType(resourceType);
        n.setResourceId(resourceId);
        n.setTitle(!Msg.hasMark(title) && title.length() > 180 ? title.substring(0, 177) + "…" : title);
        n.setBody(body == null ? null : !Msg.hasMark(body) && body.length() > 500 ? body.substring(0, 497) + "…" : body);
        n.setPayloadJson(payload == null ? null : Json.write(payload));
        n.setDelivered(enabled(recipientId, type));
        Notification saved = notifications.save(n);
        if (saved.isDelivered()) {
            try {
                projection.appendNotification(recipientId, saved.getId());
            } catch (RuntimeException ex) {
                log.warn("Projeção de notificação indisponível (MySQL segue como fonte da verdade): {}", ex.getMessage());
            }
        }
        return saved;
    }

    public boolean enabled(UUID userId, NotificationType type) {
        if (!type.optOutAllowed()) {
            return true;
        }
        UserPreferences prefs = preferences.findByUserId(userId).orElse(null);
        if (prefs == null) {
            return true;
        }
        if (!prefs.isNotificationPushMaster()) {
            return false;
        }
        Object v = Json.map(prefs.getNotificationPrefsJson()).get(type.name());
        return !(v instanceof Boolean b) || b;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> inbox(CurrentUser user) {
        List<Views.NotificationView> items = notifications.findTop100ByRecipientIdAndDeliveredTrueOrderByCreatedAtDesc(user.id())
                .stream().map(Views::notification).toList();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("unread", notifications.countByRecipientIdAndReadFalseAndDeliveredTrue(user.id()));
        out.put("items", items);
        return out;
    }

    public long unread(CurrentUser user) {
        return notifications.countByRecipientIdAndReadFalseAndDeliveredTrue(user.id());
    }

    @Transactional
    public void markRead(CurrentUser user, List<UUID> ids) {
        for (Notification n : notifications.findAllById(ids)) {
            if (!n.getRecipient().getId().equals(user.id())) {
                throw ApiException.forbidden(Msg.t("notification.notificacao_de_outro_usuario"));
            }
            n.setRead(true);
            n.setReadAt(Instant.now());
        }
    }

    @Transactional
    public int markAllRead(CurrentUser user) {
        List<Notification> list = notifications.findByRecipientIdAndReadFalse(user.id());
        list.forEach(n -> {
            n.setRead(true);
            n.setReadAt(Instant.now());
        });
        return list.size();
    }

    /** Preferências por tipo (RF3.CA36): tipos de segurança aparecem travados. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> preferences(CurrentUser user) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (NotificationType t : NotificationType.values()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("type", t.name());
            m.put("category", t.category().name());
            m.put("optOutAllowed", t.optOutAllowed());
            m.put("enabled", enabled(user.id(), t));
            out.add(m);
        }
        return out;
    }

    @Transactional
    public List<Map<String, Object>> updatePreferences(CurrentUser user, Map<String, Boolean> changes, Boolean master) {
        UserPreferences prefs = preferences.findByUserId(user.id())
                .orElseThrow(() -> ApiException.notFound(Msg.t("common.preferencias")));
        Map<String, Object> current = Json.map(prefs.getNotificationPrefsJson());
        if (changes != null) {
            changes.forEach((type, enabled) -> {
                NotificationType t;
                try {
                    t = NotificationType.valueOf(type);
                } catch (IllegalArgumentException ex) {
                    throw ApiException.badRequest("TIPO_INVALIDO", Msg.t("notification.tipo_de_notificacao_desconhecido", type));
                }
                if (!t.optOutAllowed() && Boolean.FALSE.equals(enabled)) {
                    throw ApiException.badRequest("TIPO_OBRIGATORIO", Msg.t("notification.notificacoes_de_seguranca_nao_podem"));
                }
                current.put(type, enabled);
            });
        }
        if (master != null) {
            prefs.setNotificationPushMaster(master);
        }
        prefs.setNotificationPrefsJson(Json.write(current));
        return preferences(user);
    }

    /** RF3.CA37 — expurgo diário das notificações com mais de 90 dias. */
    @Transactional
    public int purgeExpired() {
        List<Notification> old = notifications.findByCreatedAtBefore(Instant.now().minus(RETENTION));
        notifications.deleteAll(old);
        return old.size();
    }
}
