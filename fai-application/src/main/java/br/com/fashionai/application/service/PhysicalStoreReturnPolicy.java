package br.com.fashionai.application.service;

import br.com.fashionai.domain.model.PhysicalStoreOrder;

import java.time.Duration;
import java.time.Instant;
import java.util.Set;

/**
 * RF-PESQ-02 — política de troca/devolução. A versão vigente é gravada no pedido no momento da compra; a elegibilidade
 * de um pedido antigo usa sempre a versão gravada nele, nunca a atual.
 */
public record PhysicalStoreReturnPolicy(String version, int windowDays, Set<String> reasonCodes) {
    public static final String LEGACY_VERSION = "RETURN_POLICY_V0";
    public static final Set<String> REASONS = Set.of("FIT_TOO_SMALL", "FIT_TOO_LARGE", "COLOR_DIFFERS", "QUALITY_DEFECT", "WRONG_ITEM", "CHANGED_MIND", "OTHER");
    private static final PhysicalStoreReturnPolicy CURRENT = new PhysicalStoreReturnPolicy("RETURN_POLICY_V1", 7, REASONS);

    public static PhysicalStoreReturnPolicy current() {
        return CURRENT;
    }

    /** Pedidos anteriores à política explícita ficam com a versão legada (7 dias), declarada como tal na tela. */
    public static PhysicalStoreReturnPolicy of(PhysicalStoreOrder order) {
        if (order.getReturnPolicyVersion() == null || order.getReturnWindowDays() == null) {
            return new PhysicalStoreReturnPolicy(LEGACY_VERSION, 7, REASONS);
        }
        return new PhysicalStoreReturnPolicy(order.getReturnPolicyVersion(), order.getReturnWindowDays(), REASONS);
    }

    public void attach(PhysicalStoreOrder order) {
        order.setReturnWindowDays(windowDays);
        order.setReturnPolicyVersion(version);
    }

    public record Eligibility(boolean eligible, String reason, Instant deadlineAt, String policyVersion, int windowDays) { }

    /** Prazo conta da entrega; sem entrega registrada não há elegibilidade. */
    public Eligibility evaluate(PhysicalStoreOrder order, boolean openCase, Instant now) {
        if (openCase) return new Eligibility(false, "CASE_ALREADY_OPEN", deadline(order), version, windowDays);
        if (!"DELIVERED".equals(order.getStatus()) || order.getDeliveredAt() == null) return new Eligibility(false, "NOT_DELIVERED", null, version, windowDays);
        Instant deadline = deadline(order);
        if (!now.isBefore(deadline)) return new Eligibility(false, "WINDOW_EXPIRED", deadline, version, windowDays);
        return new Eligibility(true, null, deadline, version, windowDays);
    }

    public Instant deadline(PhysicalStoreOrder order) {
        return order.getDeliveredAt() == null ? null : order.getDeliveredAt().plus(Duration.ofDays(windowDays));
    }
}
