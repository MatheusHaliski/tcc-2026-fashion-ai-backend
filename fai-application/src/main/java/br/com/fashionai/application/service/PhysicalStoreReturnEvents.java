package br.com.fashionai.application.service;

import java.util.UUID;

/** Eventos do pós-venda consumidos por outros módulos (ex.: demanda agregada, RF-PESQ-10). */
public final class PhysicalStoreReturnEvents {
    private PhysicalStoreReturnEvents() {
    }

    /** Publicado só com consentimento explícito no pedido de devolução; nunca carrega identidade do comprador. */
    public record FitFeedbackRecorded(UUID sellerId, UUID productId, UUID variantId, String sizeLabel, String reasonCode, UUID contributorId) { }
}
