package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Msg;

import java.util.Map;

/** Validação pura dos formulários da loja física (endereço de entrega e link de rastreio). */
final class PhysicalStoreForms {
    private PhysicalStoreForms() {
    }

    static PhysicalStoreService.ShippingAddress validateAddress(PhysicalStoreService.ShippingAddress address) {
        if (address == null) throw ApiException.badRequest("ENDERECO_OBRIGATORIO", Msg.t("physicalStore.endereco_obrigatorio"));
        return new PhysicalStoreService.ShippingAddress(
                required(address.fullName(), 120, "fullName"),
                required(address.phone(), 40, "phone"),
                required(address.postalCode(), 20, "postalCode"),
                required(address.state(), 80, "state"),
                required(address.city(), 120, "city"),
                required(address.neighborhood(), 120, "neighborhood"),
                required(address.street(), 180, "street"),
                required(address.number(), 30, "number"),
                address.complement() == null || address.complement().isBlank() ? null : InputSanitizer.clean(address.complement(), 160));
    }

    private static String required(String value, int max, String field) {
        if (value == null || value.isBlank() || value.trim().length() > max) {
            throw ApiException.badRequest("ENDERECO_INVALIDO", Msg.t("physicalStore.endereco_invalido"), Map.of("field", field));
        }
        return InputSanitizer.clean(value, max);
    }

    static String cleanTrackingUrl(String value) {
        if (value == null || value.isBlank()) return null;
        String url = value.trim();
        if (!url.matches("https://[^\\s]{1,1000}")) {
            throw ApiException.badRequest("RASTREIO_INVALIDO", "Tracking links must use HTTPS.");
        }
        return url;
    }
}
