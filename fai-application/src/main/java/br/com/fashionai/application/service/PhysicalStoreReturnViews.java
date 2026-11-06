package br.com.fashionai.application.service;

import br.com.fashionai.domain.model.store.PhysicalStoreReturnCase;
import br.com.fashionai.domain.model.store.PhysicalStoreReturnEvent;
import br.com.fashionai.domain.model.store.PhysicalStoreReturnEvidence;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Projeções dos casos de troca/devolução; o comprovante nunca expõe conteúdo, só id e estado. */
final class PhysicalStoreReturnViews {
    private PhysicalStoreReturnViews() {
    }

    static Map<String, Object> caseView(PhysicalStoreReturnCase c, List<PhysicalStoreReturnEvent> events, List<PhysicalStoreReturnEvidence> evidence, String role) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", c.getId());
        out.put("orderId", c.getOrderId());
        out.put("kind", c.getKind());
        out.put("reasonCode", c.getReasonCode());
        out.put("reasonNotes", c.getReasonNotes());
        out.put("variantId", c.getVariantId());
        out.put("exchangeVariantId", c.getExchangeVariantId());
        out.put("exchangeOrderId", c.getExchangeOrderId());
        out.put("status", c.getStatus());
        out.put("policyVersion", c.getPolicyVersion());
        out.put("windowDays", c.getWindowDays());
        out.put("deadlineAt", c.getDeadlineAt());
        out.put("inspectionOutcome", c.getInspectionOutcome());
        out.put("divergenceReason", c.getDivergenceReason());
        out.put("restocked", c.isRestocked());
        out.put("refunded", c.getRefundRef() != null);
        out.put("fitFeedbackConsent", c.isFitFeedbackConsent());
        out.put("closedAt", c.getClosedAt());
        out.put("version", c.getVersion());
        out.put("role", role);
        out.put("createdAt", c.getCreatedAt());
        out.put("events", events.stream().map(PhysicalStoreReturnViews::eventView).toList());
        out.put("evidence", evidence.stream().filter(e -> e.getDeletedAt() == null).map(PhysicalStoreReturnViews::evidenceView).toList());
        return out;
    }

    static Map<String, Object> eventView(PhysicalStoreReturnEvent e) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", e.getId());
        out.put("fromStatus", e.getFromStatus());
        out.put("toStatus", e.getToStatus());
        out.put("notes", e.getNotes());
        out.put("at", e.getCreatedAt());
        return out;
    }

    static Map<String, Object> evidenceView(PhysicalStoreReturnEvidence e) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", e.getId());
        out.put("uploaderId", e.getUploaderId());
        out.put("createdAt", e.getCreatedAt());
        return out;
    }

    static Map<String, Object> eligibilityView(PhysicalStoreReturnPolicy.Eligibility e) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("eligible", e.eligible());
        out.put("reason", e.reason());
        out.put("deadlineAt", e.deadlineAt());
        out.put("policyVersion", e.policyVersion());
        out.put("windowDays", e.windowDays());
        out.put("legacyPolicy", PhysicalStoreReturnPolicy.LEGACY_VERSION.equals(e.policyVersion()));
        out.put("reasonCodes", PhysicalStoreReturnPolicy.REASONS.stream().sorted().toList());
        return out;
    }
}
