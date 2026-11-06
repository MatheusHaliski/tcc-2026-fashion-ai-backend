package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.domain.model.PhysicalStoreListing;
import br.com.fashionai.domain.model.PhysicalStoreOrder;
import br.com.fashionai.domain.model.PhysicalStoreVariant;
import br.com.fashionai.domain.repository.PhysicalStoreVariantRepository;

import java.util.UUID;

/**
 * RF-PESQ-01 — escolha e débito da variante no resgate. O servidor rejeita variante de outra oferta, variante
 * inexistente/inativa e SKU esgotado antes de qualquer lançamento de pontos; a linha da variante fica travada
 * ({@code lockById}) até o fim da transação, por isso duas compras concorrentes do último SKU debitam uma só vez.
 */
final class PhysicalStoreVariantStock {
    private PhysicalStoreVariantStock() {
    }

    /** {@code null} quando a oferta não tem variantes cadastradas (contrato legado por oferta). */
    static PhysicalStoreVariant pick(PhysicalStoreVariantRepository variants, PhysicalStoreListing listing, UUID variantId) {
        boolean hasVariants = variants.countByListingIdAndActiveTrue(listing.getId()) > 0;
        if (!hasVariants) {
            if (variantId != null) throw ApiException.badRequest("VARIANTE_INEXISTENTE", Msg.t("physicalStore.variante_inexistente"));
            return null;
        }
        if (variantId == null) throw ApiException.badRequest("VARIANTE_OBRIGATORIA", Msg.t("physicalStore.variante_obrigatoria"));
        PhysicalStoreVariant variant = variants.lockById(variantId)
                .orElseThrow(() -> ApiException.badRequest("VARIANTE_INEXISTENTE", Msg.t("physicalStore.variante_inexistente")));
        if (!variant.getListingId().equals(listing.getId())) {
            throw ApiException.badRequest("VARIANTE_DE_OUTRA_OFERTA", Msg.t("physicalStore.variante_de_outra_oferta"));
        }
        if (!variant.isActive()) throw ApiException.badRequest("VARIANTE_INEXISTENTE", Msg.t("physicalStore.variante_inexistente"));
        if (variant.available() < 1) throw ApiException.conflict("VARIANTE_ESGOTADA", Msg.t("physicalStore.variante_esgotada"));
        return variant;
    }

    /** Debita uma unidade e grava o retrato do SKU no pedido. */
    static void debit(PhysicalStoreVariant variant, PhysicalStoreOrder order) {
        variant.setStockQuantity(variant.getStockQuantity() - 1);
        order.setVariantId(variant.getId());
        order.setVariantSku(variant.getSku());
        order.setVariantColor(variant.getColorName());
        order.setVariantSize(variant.getSizeLabel());
    }
}
