package br.com.fashionai.application.marketplace;

import br.com.fashionai.application.common.ApiException;
import jakarta.persistence.EntityManager;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

@Component
public class MarketplaceListingExpiry {
    private static final ZoneId ZONE = ZoneId.of("America/Sao_Paulo");

    private final EntityManager entities;

    public MarketplaceListingExpiry(EntityManager entities) {
        this.entities = entities;
    }

    static Instant deadline(LocalDate date, Instant now) {
        if (date == null) return null;
        if (!date.isAfter(now.atZone(ZONE).toLocalDate())) {
            throw ApiException.badRequest("INVALID_LISTING_EXPIRY", "Escolha uma data de expiração futura.");
        }
        return date.atStartOfDay(ZONE).toInstant();
    }

    @Scheduled(initialDelay = 5000, fixedDelayString = "${fashionai.marketplace.listing-expiry-ms:30000}")
    @Transactional
    public void returnExpiredPiecesToCloset() {
        entities.createNativeQuery("""
                UPDATE wardrobe_items w
                JOIN users u ON u.id = w.user_id
                JOIN catalog_products p ON p.managed_wardrobe_item_id = w.id
                SET w.for_sale = FALSE, w.visibility = 'PRIVATE', w.version = w.version + 1,
                    p.status = 'EXPIRED', p.expires_at = w.expires_at, p.version = p.version + 1
                WHERE u.profile_type = 'MARCA' AND p.source_type = 'VERIFIED_BRAND_PROFILE'
                  AND w.for_sale = TRUE AND w.expires_at <= UTC_TIMESTAMP(6)
                """).executeUpdate();
        entities.createNativeQuery("""
                UPDATE wardrobe_items w
                JOIN marketplace_negotiations n ON n.id = w.negotiation_id AND n.piece_id = w.id
                SET w.for_sale = FALSE, w.visibility = 'PRIVATE', w.physical_store_item_id = NULL,
                    w.version = w.version + 1
                WHERE n.status = 'ACCEPTED' AND n.expires_at = w.expires_at
                  AND w.for_sale = TRUE AND w.expires_at <= UTC_TIMESTAMP(6)
                """).executeUpdate();
    }
}
