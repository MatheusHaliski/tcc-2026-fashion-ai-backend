package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.domain.model.FaiPointsLedgerEntry;
import br.com.fashionai.domain.model.enums.NotificationType;

import java.util.Locale;
import java.util.Map;

/** Extrato dos FAI Points: cada lançamento vira um aviso na central de notificações (quando ela existe). */
final class FaiPointsStatements {
    private final NotificationService notifications;

    FaiPointsStatements(NotificationService notifications) {
        this.notifications = notifications;
    }

    /** Aviso de extrato (crédito ou débito) na central de notificações, com o texto da ação. */
    void statement(FaiPointsLedgerEntry e, String detail) {
        if (notifications == null) {
            return;   // testes de unidade sem a central de notificações
        }
        String title = Msg.k(e.getDelta() >= 0 ? "faiPoints.extrato.credito" : "faiPoints.extrato.debito", Math.abs(e.getDelta()));
        String action = "faiPoints.extrato." + e.getActionCode();
        String body = !Msg.has(action) ? Msg.k("faiPoints.extrato.outro", e.getActionCode().toLowerCase(Locale.ROOT).replace('_', ' '))
                : detail == null ? Msg.k(action) : Msg.k(action, detail);
        notifications.notify(e.getUserId(), null, NotificationType.FAI_POINTS, "FAI_POINTS", e.getId(), title, body,
                Map.of("delta", e.getDelta(), "action", e.getActionCode(), "href", "/points"));
    }
}
