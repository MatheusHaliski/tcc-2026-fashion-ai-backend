package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.domain.model.FaiPointsLedgerEntry;
import br.com.fashionai.domain.model.PhysicalStoreListing;
import br.com.fashionai.domain.model.PhysicalStoreOrder;
import br.com.fashionai.domain.model.PhysicalStoreVariant;
import br.com.fashionai.domain.model.store.PhysicalStoreReturnCase;
import br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository;
import br.com.fashionai.domain.repository.PhysicalStoreListingRepository;
import br.com.fashionai.domain.repository.PhysicalStoreOrderRepository;
import br.com.fashionai.domain.repository.PhysicalStoreVariantRepository;

import java.util.UUID;

/**
 * Liquidação de um caso inspecionado: estorno único no ledger (chave de idempotência por caso), pedido de troca com
 * débito da variante escolhida e reposição de estoque só quando a inspeção decide. Chamado dentro da transação do
 * {@link PhysicalStoreReturnService}; não tem transação nem autorização próprias.
 */
final class PhysicalStoreReturnSettlement {
    private final PhysicalStoreOrderRepository orders;
    private final PhysicalStoreListingRepository listings;
    private final PhysicalStoreVariantRepository variants;
    private final FaiPointsLedgerEntryRepository ledger;

    PhysicalStoreReturnSettlement(PhysicalStoreOrderRepository orders, PhysicalStoreListingRepository listings,
                                  PhysicalStoreVariantRepository variants, FaiPointsLedgerEntryRepository ledger) {
        this.orders = orders;
        this.listings = listings;
        this.variants = variants;
        this.ledger = ledger;
    }

    /** CA3 — o estorno acontece uma vez por caso; repetir a inspeção ou o clique não cria outro lançamento. */
    void refund(PhysicalStoreReturnCase c, PhysicalStoreOrder order) {
        String key = c.getBuyerId() + ":PHYSICAL_STORE_REFUND:" + c.getId();
        if (c.getRefundRef() == null && !ledger.existsByIdempotencyKey(key)) {
            FaiPointsLedgerEntry credit = PhysicalStoreViews.pointsEntry(c.getBuyerId(), order.getPricePoints(), "PHYSICAL_STORE_REFUND", "RETURN_CASE", c.getId().toString());
            ledger.save(credit);
            ledger.save(PhysicalStoreViews.pointsEntry(c.getSellerId(), -order.getPricePoints(), "PHYSICAL_STORE_SALE_REVERSAL", "RETURN_CASE", c.getId().toString()));
        }
        c.setRefundRef(key);
    }

    /** A troca gera um pedido novo (sem nova cobrança) debitando a variante escolhida no momento da liquidação. */
    void exchange(PhysicalStoreReturnCase c, PhysicalStoreOrder order) {
        if (c.getExchangeOrderId() != null) return;
        PhysicalStoreVariant target = variants.lockById(c.getExchangeVariantId())
                .orElseThrow(() -> ApiException.conflict("VARIANTE_ESGOTADA", Msg.t("physicalStore.variante_esgotada")));
        if (!target.isActive() || target.available() < 1) throw ApiException.conflict("VARIANTE_ESGOTADA", Msg.t("physicalStore.variante_esgotada"));
        PhysicalStoreOrder next = new PhysicalStoreOrder();
        PhysicalStoreVariantStock.debit(target, next);
        next.setListing(order.getListing());
        next.setBuyerUserId(order.getBuyerUserId());
        next.setPricePoints(0);
        next.setShippingAddress(order.getShippingAddress());
        next.setStatus("PROCESSING");
        next.setReturnPolicyVersion(order.getReturnPolicyVersion());
        next.setReturnWindowDays(order.getReturnWindowDays());
        orders.save(next);
        c.setExchangeOrderId(next.getId());
    }

    /** CA4 — a peça só volta ao estoque vendável por decisão explícita da inspeção, uma única vez. */
    void restock(PhysicalStoreOrder order, PhysicalStoreReturnCase c) {
        if (c.isRestocked()) return;
        if (c.getVariantId() != null) {
            variants.lockById(c.getVariantId()).ifPresent(v -> v.setStockQuantity(v.getStockQuantity() + 1));
        } else {
            listings.lockById(order.getListing().getId()).ifPresent(l -> l.setStockQuantity(l.getStockQuantity() + 1));
        }
        c.setRestocked(true);
    }

    PhysicalStoreVariant exchangeVariant(PhysicalStoreListing listing, UUID variantId) {
        if (variantId == null) throw ApiException.badRequest("VARIANTE_TROCA", Msg.t("storeReturn.variante_troca"));
        return variants.findById(variantId).filter(v -> v.getListingId().equals(listing.getId()) && v.isActive() && v.available() > 0)
                .orElseThrow(() -> ApiException.badRequest("VARIANTE_TROCA", Msg.t("storeReturn.variante_troca")));
    }
}
