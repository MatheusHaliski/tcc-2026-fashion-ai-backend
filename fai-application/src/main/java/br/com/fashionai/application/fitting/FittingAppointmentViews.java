package br.com.fashionai.application.fitting;

import br.com.fashionai.domain.model.fitting.FittingAppointment;
import br.com.fashionai.domain.model.fitting.FittingAppointmentItem;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Projeções da prova física. A loja nunca recebe medidas, fotos ou dados do avatar: só produto, tamanho e estado. */
public final class FittingAppointmentViews {
    private FittingAppointmentViews() {
    }

    public record ItemCmd(UUID productId, String sizeLabel, UUID variantId) { }
    public record RequestCmd(String sellerUsername, Instant requestedSlot, List<ItemCmd> items, String notes, String requestId) { }
    public record ConfirmCmd(long expectedVersion, Instant confirmedSlot) { }
    public record VersionCmd(long expectedVersion) { }
    public record ResultCmd(UUID itemId, String result) { }
    public record CompleteCmd(long expectedVersion, List<ResultCmd> results) { }

    static Map<String, Object> appointment(FittingAppointment a, String sellerName, String role, List<FittingAppointmentItem> items, Map<UUID, String> productNames, Instant now) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", a.getId());
        out.put("sellerId", a.getSellerId());
        out.put("sellerName", sellerName);
        boolean expired = "REQUESTED".equals(a.getStatus()) && !a.getExpiresAt().isAfter(now);
        out.put("status", expired ? "EXPIRED" : a.getStatus());
        out.put("requestedSlot", a.getRequestedSlot());
        out.put("confirmedSlot", a.getConfirmedSlot());
        out.put("expiresAt", a.getExpiresAt());
        out.put("notes", a.getNotes());
        out.put("confirmation", "CONFIRMED".equals(a.getStatus()) ? "STORE_CONFIRMED" : "PENDING_STORE");
        out.put("reservationsActive", !a.isReleased() && !expired && ("REQUESTED".equals(a.getStatus()) || "CONFIRMED".equals(a.getStatus())));
        out.put("role", role);
        out.put("version", a.getVersion());
        out.put("createdAt", a.getCreatedAt());
        out.put("items", items.stream().map(i -> item(i, productNames.get(i.getCatalogProductId()), expired)).toList());
        out.put("sharedWithStore", List.of("product", "sizeLabel", "requestedSlot"));
        return out;
    }

    static Map<String, Object> item(FittingAppointmentItem i, String productName, boolean expired) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", i.getId());
        out.put("productId", i.getCatalogProductId());
        out.put("productName", productName);
        out.put("variantId", i.getStoreVariantId());
        out.put("sizeLabel", i.getSizeLabel());
        out.put("state", expired && "RESERVED".equals(i.getState()) ? "RELEASED" : i.getState());
        out.put("reserved", "RESERVED".equals(i.getState()) && !expired);
        out.put("result", i.getResult());
        return out;
    }
}
