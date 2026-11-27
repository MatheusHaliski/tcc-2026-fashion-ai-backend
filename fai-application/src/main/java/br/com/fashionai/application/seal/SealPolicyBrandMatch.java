package br.com.fashionai.application.seal;

import java.util.UUID;

import br.com.fashionai.domain.model.WardrobeItem;

/**
 * Exercício 13 — a peça é da marca referenciada? Compara só IDs: o da marca do catálogo ({@code wardrobe_items.brand_id})
 * ou o do perfil de marca. O nome salvo na peça ({@code brandName}) não entra: duas marcas de nome parecido, ou uma
 * peça com o nome digitado igual, não satisfazem a regra.
 */
final class SealPolicyBrandMatch {
    private SealPolicyBrandMatch() {
    }

    static boolean matches(SealPolicyBrandReference reference, WardrobeItem piece) {
        UUID wanted = reference.id();
        if (SealPolicyBrandReference.PROFILE.equals(reference.kind())) {
            if (piece.getBrandProfile() != null) {
                return wanted.equals(piece.getBrandProfile().getId());
            }
            // peça ligada à marca do catálogo que pertence a esse perfil
            return piece.getBrand() != null && piece.getBrand().getBrandProfile() != null
                    && wanted.equals(piece.getBrand().getBrandProfile().getId());
        }
        return piece.getBrand() != null && wanted.equals(piece.getBrand().getId());
    }
}
