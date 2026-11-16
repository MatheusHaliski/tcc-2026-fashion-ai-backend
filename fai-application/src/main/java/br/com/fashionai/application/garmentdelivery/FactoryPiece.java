package br.com.fashionai.application.garmentdelivery;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.garmentdelivery.GarmentDeliveryViews.Frozen;
import br.com.fashionai.domain.model.TipoLavagem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.ImageOrigin;
import br.com.fashionai.domain.model.enums.ItemCondition;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.model.garmentdelivery.GarmentOrder;

import java.time.Instant;
import java.time.LocalDate;

/**
 * A peça que a encomenda entrega no guarda-roupa: tipo, cor, material e tamanho da ficha congelada, privada, nova, com
 * SKU = número de série, origem "Sob encomenda", cuidados em texto e o TipoLavagem que a Lavanderia agrupa. Sem preço:
 * nada foi cobrado. A imagem é a padrão do tipo de peça (aplicada por quem chama, como no cadastro sem foto).
 */
final class FactoryPiece {
    private FactoryPiece() {
    }

    static WardrobeItem create(User owner, GarmentOrder order, Frozen frozen, String care, TipoLavagem wash, Instant receivedAt) {
        WardrobeItem piece = new WardrobeItem();
        piece.setUser(owner);
        piece.setName(clip(order.getProjectTitle(), 180));
        piece.setCategory(frozen.garment().category());
        piece.setSubcategory(frozen.garment().subcategory());
        piece.setColor(frozen.garment().colorCode());
        piece.setMaterial(frozen.garment().materialCode());
        piece.setSizeLabel(GarmentSizeRules.sizeCode(order.getSizeLabel()));
        piece.setSex("UNISSEX");
        piece.setBrandName("FashionAI Atelier");
        piece.setVisibility(Visibility.PRIVATE);
        piece.setCondition(ItemCondition.NEW);
        piece.setCareInstructions(clip(care, 512));
        piece.setTipoLavagem(wash);
        piece.setPieceOrigin("SOB_ENCOMENDA");
        piece.setSku(order.getSerialNumber());
        piece.setPurchaseDate(LocalDate.ofInstant(receivedAt, FactoryPlanRules.FACTORY_ZONE));
        piece.setPurchaseLocation(clip(Msg.t("garmentDelivery.peca.local"), 160));
        piece.setImageOrigin(ImageOrigin.DEFAULT);
        return piece;
    }

    private static String clip(String value, int max) {
        return value == null ? null : value.substring(0, Math.min(value.length(), max));
    }
}
