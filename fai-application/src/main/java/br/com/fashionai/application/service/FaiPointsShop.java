package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.FaiPointsService.Level;
import br.com.fashionai.domain.model.FaiPointsLedgerEntry;
import br.com.fashionai.domain.model.RoomCatalogItem;
import br.com.fashionai.domain.model.RoomInventoryItem;
import br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository;
import br.com.fashionai.domain.repository.RoomCatalogItemRepository;
import br.com.fashionai.domain.repository.RoomInventoryItemRepository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Loja do quarto (Molde de Fábrica, RF35): vitrine, prova sem compra e compra com saldo em FAI Points. Saldo, total e
 * nível são lidos do próprio {@link FaiPointsService}, como antes (chamada direta, sem proxy).
 */
final class FaiPointsShop {
    private final FaiPointsService points;
    private final FaiPointsLedgerEntryRepository ledger;
    private final RoomCatalogItemRepository catalog;
    private final RoomInventoryItemRepository inventory;
    private final FaiPointsService.RoomLayoutAccess layouts;
    private final WardrobeCreatorService creator;
    private final FaiPointsStatements statements;

    FaiPointsShop(FaiPointsService points, FaiPointsLedgerEntryRepository ledger, RoomCatalogItemRepository catalog,
                  RoomInventoryItemRepository inventory, FaiPointsService.RoomLayoutAccess layouts,
                  WardrobeCreatorService creator, FaiPointsStatements statements) {
        this.points = points;
        this.ledger = ledger;
        this.catalog = catalog;
        this.inventory = inventory;
        this.layouts = layouts;
        this.creator = creator;
        this.statements = statements;
    }

    /** Vitrine do Molde de Fábrica com nível, saldo, unidades compradas e módulos compatíveis de cada item. */
    List<Map<String, Object>> shop(CurrentUser user) {
        Level lvl = points.level(user.id());
        long bal = points.balance(user.id());
        Map<String, List<Map<String, Object>>> mine = new java.util.HashMap<>();
        for (RoomInventoryItem i : inventory.findByUserId(user.id())) {
            Map<String, Object> e = new LinkedHashMap<>();
            e.put("inventoryId", i.getId());
            e.put("appliedModule", i.getAppliedModule());
            e.put("serial", i.getSerial());
            e.put("acquiredAt", i.getAcquiredAt());
            mine.computeIfAbsent(i.getSku(), k -> new ArrayList<>()).add(e);
        }
        return catalog.findByActiveTrueOrderByPricePoints().stream()
                .filter(c -> !"EXPIRADO".equals(WardrobeCreatorService.availability(c, Instant.now())) || mine.containsKey(c.getSku()))
                .filter(c -> mine.containsKey(c.getSku()) || creator.sellerActive(c))   // criador pendente/suspenso sai da vitrine
                .map(c -> {
                    Map<String, Object> m = creator.view(c, user.id());
                    m.put("levelOk", lvl.atLeast(Level.parse(c.getRequiredLevel())));
                    m.put("affordable", bal >= c.getPricePoints());
                    m.put("owned", mine.containsKey(c.getSku()));
                    m.put("inventory", mine.getOrDefault(c.getSku(), List.of()));   // unidades compradas e onde estão aplicadas
                    m.put("compatibleModules", layouts.compatibleModules(user.id(), c));
                    return m;
                }).toList();
    }

    /** RF35.CA06 — "Provar no meu quarto": prévia aplicada na cena, sem compra, saldo intacto. */
    Map<String, Object> tryOn(CurrentUser user, String sku, String moduleId) {
        RoomCatalogItem c = catalog.findById(sku).orElseThrow(() -> ApiException.notFound(Msg.t("faiPoints.item_da_loja")));
        List<String> compatible = layouts.compatibleModules(user.id(), c);
        if (moduleId != null && !compatible.contains(moduleId)) {
            throw new ApiException(409, "ENCAIXE_INCOMPATIVEL", Msg.t("faiPoints.este_item_nao_cabe_no", (compatible.isEmpty() ? Msg.t("faiPoints.nenhum_modulo_do_seu_nivel") : String.join(", ", compatible))));
        }
        return Map.of("preview", true, "sku", sku, "module", moduleId == null ? (compatible.isEmpty() ? "" : compatible.get(0)) : moduleId,
                "finish", Json.map(c.getFinishJson()), "balance", points.balance(user.id()), "note", Msg.t("faiPoints.previa_descartada_ao_sair_nada"));
    }

    /** Compra com carteiras travadas em ordem de UUID, pedido idempotente por chave e crédito ao criador. */
    Map<String, Object> buy(CurrentUser user, String sku, String requestKey) {
        // Read creator identity without loading a managed SKU, then lock all wallets in UUID order.
        UUID seller = catalog.sellerOf(sku).orElse(null);
        if (user.id().equals(seller)) throw new ApiException(409, "COMPRA_PROPRIA", Msg.t("faiPoints.compra_propria"));
        java.util.stream.Stream.of(user.id(), seller).filter(java.util.Objects::nonNull).distinct().sorted()
                .forEach(id -> ledger.lockOwner(id).orElseThrow(() -> ApiException.notFound(Msg.t("common.usuario"))));
        String requestRef = requestRef(requestKey);
        if (requestRef != null) {
            var done = ledger.findByIdempotencyKey(user.id() + ":SHOP_PURCHASE:" + requestRef);
            if (done.isPresent()) return repeatedPurchase(user, done.get().getRefId());
        }
        RoomCatalogItem c = catalog.lockBySku(sku).orElseThrow(() -> ApiException.notFound(Msg.t("faiPoints.item_da_loja")));
        if (!java.util.Objects.equals(seller, c.getCreatorUserId()))
            throw new ApiException(409, "OFERTA_ALTERADA", Msg.t("faiPoints.oferta_alterada"));
        String purchaseRef = requestRef != null ? requestRef : UUID.randomUUID().toString();
        Level lvl = points.level(user.id());
        if (!lvl.atLeast(Level.parse(c.getRequiredLevel()))) {
            throw new ApiException(409, "NIVEL_INSUFICIENTE", Msg.t("faiPoints.disponivel_a_partir_do_nivel", c.getRequiredLevel()));
        }
        if (c.getStockLimit() != null && c.getSoldCount() >= c.getStockLimit()) {
            throw new ApiException(409, "ESGOTADO", Msg.t("faiPoints.edicao_limitada_esgotada_item_cosmetico"));
        }
        String blocker = creator.blocker(user.id(), c);
        if (blocker != null) {
            throw new ApiException(409, "CONDICAO_DE_COMPRA", blocker);
        }
        long bal = points.balance(user.id());
        if (bal < c.getPricePoints()) {
            throw new ApiException(409, "SALDO_INSUFICIENTE", Msg.t("faiPoints.saldo_de_fai_pts_o", bal, c.getPricePoints()));
        }
        // item gratuito também deixa o lançamento (de 0 pontos) quando há chave: é ele que reconhece o pedido repetido
        if (c.getPricePoints() > 0 || requestRef != null) {
            FaiPointsLedgerEntry e = new FaiPointsLedgerEntry();
            e.setUserId(user.id());
            e.setDelta(-c.getPricePoints());
            e.setActionCode("SHOP_PURCHASE");
            e.setRefType("SKU");
            e.setRefId(sku);
            e.setIdempotencyKey(user.id() + ":SHOP_PURCHASE:" + purchaseRef);
            e.setCountsLifetime(false);
            ledger.save(e);
            if (c.getPricePoints() > 0) statements.statement(e, WardrobeCreatorService.displayName(c));
        }
        c.setSoldCount(c.getSoldCount() + 1);
        RoomInventoryItem item = new RoomInventoryItem();
        item.setUserId(user.id());
        item.setSku(sku);
        item.setSerial(c.getStockLimit() == null ? null : c.getSoldCount());
        item.setSource("PURCHASE");
        item.setAcquiredAt(Instant.now());
        inventory.save(item);
        if (seller != null && c.getPricePoints() > 0) {
            FaiPointsLedgerEntry credit = new FaiPointsLedgerEntry();
            credit.setUserId(seller);
            credit.setDelta(c.getPricePoints()); // zero platform fee; no cash conversion
            credit.setActionCode("SHOP_SALE");
            credit.setRefType("SHOP_PURCHASE");
            credit.setRefId(purchaseRef);
            credit.setIdempotencyKey(seller + ":SHOP_SALE:" + purchaseRef);
            credit.setCountsLifetime(false); // sales never farm progression levels
            ledger.save(credit);
            statements.statement(credit, WardrobeCreatorService.displayName(c));
        }
        return Map.of("inventoryId", item.getId(), "sku", sku, "balance", points.balance(user.id()), "lifetime", points.lifetime(user.id()),
                "level", points.level(user.id()).name(), "serial", String.valueOf(item.getSerial()));
    }

    /** Chave de pedido aceita: só letras, números e hífen (um UUID do navegador cabe), para caber na chave do ledger. */
    static String requestRef(String key) {
        return key != null && key.matches("[A-Za-z0-9-]{16,64}") ? key : null;
    }

    /** Resposta da compra já feita: o item mais recente desse SKU no inventário da pessoa e o saldo atual. */
    private Map<String, Object> repeatedPurchase(CurrentUser user, String sku) {
        RoomInventoryItem item = inventory.findByUserId(user.id()).stream().filter(i -> sku.equals(i.getSku()))
                .max(java.util.Comparator.comparing(RoomInventoryItem::getAcquiredAt, java.util.Comparator.nullsFirst(java.util.Comparator.naturalOrder())))
                .orElseThrow(() -> ApiException.notFound(Msg.t("faiPoints.item_da_loja")));
        return Map.of("inventoryId", item.getId(), "sku", sku, "balance", points.balance(user.id()), "lifetime", points.lifetime(user.id()),
                "level", points.level(user.id()).name(), "serial", String.valueOf(item.getSerial()), "repeated", true);
    }
}
