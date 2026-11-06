package br.com.fashionai.application.service;

import java.util.Map;
import java.util.UUID;

/**
 * RF47 — o que vem do produto do catálogo para a peça nova do guarda-roupa: referência ao produto e à variante, a foto
 * do card (com o recorte semântico) e, na etapa 3, o modelo 3D de vitrine publicado do produto ({@code model3dUrl},
 * {@code /media/...}; null quando o produto ainda não tem). Era um record dentro do WardrobeService.
 */
public record CatalogPick(UUID productId, UUID variantId, String imageUrl, String thumbnailUrl, Map<String, Object> catalogImage,
                          String model3dUrl) {
    public CatalogPick(UUID productId, UUID variantId, String imageUrl, String thumbnailUrl, Map<String, Object> catalogImage) {
        this(productId, variantId, imageUrl, thumbnailUrl, catalogImage, null);
    }

    public CatalogPick(UUID productId, UUID variantId, String imageUrl) {
        this(productId, variantId, imageUrl, null, null, null);
    }
}
