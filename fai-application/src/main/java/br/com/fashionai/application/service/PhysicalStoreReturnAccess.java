package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.PhysicalStoreOrder;
import br.com.fashionai.domain.model.store.PhysicalStoreReturnCase;
import br.com.fashionai.domain.repository.PhysicalStoreOrderRepository;
import br.com.fashionai.domain.repository.store.PhysicalStoreReturnCaseRepository;

import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.UUID;

/** Quem pode ver/agir em um caso (CA2): comprador, vendedor da oferta e equipe autorizada; mais validações puras. */
final class PhysicalStoreReturnAccess {
    private final PhysicalStoreReturnCaseRepository cases;
    private final PhysicalStoreOrderRepository orders;
    private final Guard guard;

    PhysicalStoreReturnAccess(PhysicalStoreReturnCaseRepository cases, PhysicalStoreOrderRepository orders, Guard guard) {
        this.cases = cases;
        this.orders = orders;
        this.guard = guard;
    }

    PhysicalStoreOrder ownOrder(CurrentUser user, UUID orderId) {
        guard.requireCanCreate(user);
        PhysicalStoreOrder order = orders.findById(orderId).orElseThrow(() -> ApiException.notFound("Order"));
        if (!order.getBuyerUserId().equals(user.id())) throw ApiException.forbidden(Msg.t("storeReturn.acesso_negado"));
        return order;
    }

    PhysicalStoreReturnCase locked(UUID caseId) {
        return cases.lockById(caseId).orElseThrow(() -> ApiException.notFound(Msg.t("storeReturn.caso")));
    }

    PhysicalStoreReturnCase buyerOwned(CurrentUser user, UUID caseId) {
        PhysicalStoreReturnCase c = locked(caseId);
        if (!c.getBuyerId().equals(user.id())) throw ApiException.forbidden(Msg.t("storeReturn.acesso_negado"));
        return c;
    }

    void operator(CurrentUser user, PhysicalStoreReturnCase c) {
        guard.requireCanCreate(user);
        if (!user.admin() && !c.getSellerId().equals(user.id())) throw ApiException.forbidden(Msg.t("storeReturn.acesso_negado"));
    }

    void party(CurrentUser user, PhysicalStoreReturnCase c) {
        guard.requireCanCreate(user);
        if (!user.admin() && !c.getSellerId().equals(user.id()) && !c.getBuyerId().equals(user.id())) {
            throw ApiException.forbidden(Msg.t("storeReturn.acesso_negado"));
        }
    }

    static String role(CurrentUser user, PhysicalStoreReturnCase c) {
        return c.getBuyerId().equals(user.id()) ? "BUYER" : c.getSellerId().equals(user.id()) ? "SELLER" : "OPERATOR";
    }

    static void version(PhysicalStoreReturnCase c, long expected) {
        if (c.getVersion() != expected) throw ApiException.conflict("RETURN_VERSION_CONFLICT", "O caso mudou. Atualize a página.");
    }

    static ApiException invalid() {
        return ApiException.conflict("TRANSICAO_INVALIDA", Msg.t("storeReturn.transicao_invalida"));
    }

    static String key(String key) {
        if (key == null || !key.matches("[a-zA-Z0-9_-]{8,80}")) throw ApiException.badRequest("IDEMPOTENCY_KEY_REQUIRED", "Envie uma chave de idempotência válida.");
        return key;
    }

    static String text(String value, int max) {
        return value == null || value.isBlank() ? null : InputSanitizer.clean(value, max);
    }

    static String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }
}
