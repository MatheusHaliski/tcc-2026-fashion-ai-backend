package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/notifications")
@Tag(name = "RF17/RNF — Notificações")
public class NotificationController {
    private final NotificationService notifications;

    public NotificationController(NotificationService notifications) {
        this.notifications = notifications;
    }

    @GetMapping
    @Operation(summary = "Caixa de entrada agrupada por categoria")
    public Map<String, Object> inbox(CurrentUser user) {
        return notifications.inbox(user);
    }

    @GetMapping("/unread-count")
    @Operation(summary = "Contador de não lidas (badge)")
    public Map<String, Long> unread(CurrentUser user) {
        return Map.of("unread", notifications.unread(user));
    }

    public record ReadRequest(List<UUID> ids) {
    }

    @PostMapping("/read")
    @Operation(summary = "Marcar como lidas")
    public Map<String, Long> markRead(CurrentUser user, @RequestBody ReadRequest body) {
        notifications.markRead(user, body.ids());
        return Map.of("unread", notifications.unread(user));
    }

    @PostMapping("/read-all")
    @Operation(summary = "Marcar todas como lidas")
    public Map<String, Object> markAllRead(CurrentUser user) {
        return Map.of("marked", notifications.markAllRead(user), "unread", 0);
    }

    @GetMapping("/preferences")
    @Operation(summary = "Preferências por tipo de notificação")
    public List<Map<String, Object>> preferences(CurrentUser user) {
        return notifications.preferences(user);
    }

    public record PreferencesRequest(Map<String, Boolean> changes, Boolean master) {
    }

    @PutMapping("/preferences")
    @Operation(summary = "Ligar/desligar tipos de notificação ou o interruptor geral")
    public List<Map<String, Object>> updatePreferences(CurrentUser user, @RequestBody PreferencesRequest body) {
        return notifications.updatePreferences(user, body.changes() == null ? Map.of() : body.changes(), body.master());
    }
}
