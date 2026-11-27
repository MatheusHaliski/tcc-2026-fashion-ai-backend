package br.com.fashionai.application.passport;

import br.com.fashionai.domain.model.passport.PassportRepairOrder;
import br.com.fashionai.domain.model.passport.PassportRepairOrderEvent;
import br.com.fashionai.domain.model.passport.PassportRepairReceipt;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Projeções da ordem de reparo. A atestação é sempre "serviço declarado pelo prestador", nunca autenticidade. */
public final class RepairOrderViews {
    private RepairOrderViews() {
    }

    public record RequestCmd(String providerUsername, String notes, String commandKey) { }
    public record QuoteCmd(long expectedVersion, String diagnosis, BigDecimal amount, String currency, LocalDate validUntil) { }
    public record VersionCmd(long expectedVersion) { }
    public record DeliverCmd(long expectedVersion, String serviceSummary, String providerStatement, String shareScope) { }
    public record CorrectionCmd(UUID correctsEventId, String notes) { }

    static Map<String, Object> order(PassportRepairOrder o, String role, String providerName, List<PassportRepairOrderEvent> events, List<PassportRepairReceipt> receipts) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", o.getId());
        out.put("passportId", o.getPassportId());
        out.put("providerId", o.getProviderId());
        out.put("providerName", providerName);
        out.put("status", o.getStatus());
        out.put("requestNotes", o.getRequestNotes());
        out.put("diagnosis", o.getDiagnosis());
        out.put("quoteAmount", o.getQuoteAmount());
        out.put("quoteCurrency", o.getQuoteCurrency());
        out.put("quoteValidUntil", o.getQuoteValidUntil());
        out.put("authorizedAt", o.getAuthorizedAt());
        out.put("authorizedBy", o.getAuthorizedBy());
        out.put("serviceSummary", o.getServiceSummary());
        out.put("providerStatement", o.getProviderStatement());
        out.put("deliveredAt", o.getDeliveredAt());
        out.put("shareScope", o.getShareScope());
        out.put("accessRevoked", o.getAccessRevokedAt() != null);
        out.put("attestation", o.getDeliveredAt() == null ? "NONE" : "PROVIDER_DECLARED");
        out.put("authenticity", "NOT_CERTIFIED");
        out.put("environmentalClaim", "NONE");
        out.put("role", role);
        out.put("version", o.getVersion());
        out.put("createdAt", o.getCreatedAt());
        out.put("events", events.stream().map(RepairOrderViews::event).toList());
        out.put("receipts", receipts.stream().filter(r -> r.getDeletedAt() == null).map(RepairOrderViews::receipt).toList());
        return out;
    }

    static Map<String, Object> event(PassportRepairOrderEvent e) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", e.getId());
        out.put("actorRole", e.getActorRole());
        out.put("fromStatus", e.getFromStatus());
        out.put("toStatus", e.getToStatus());
        out.put("notes", e.getNotes());
        out.put("correctsEventId", e.getCorrectsEventId());
        out.put("at", e.getCreatedAt());
        return out;
    }

    static Map<String, Object> receipt(PassportRepairReceipt r) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", r.getId());
        out.put("createdAt", r.getCreatedAt());
        return out;
    }
}
