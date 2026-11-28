package br.com.fashionai.application.marketplace;

import br.com.fashionai.application.common.ApiException;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class MarketplaceListingExpiryTest {
    @Test
    void chosenDateStartsAtMidnightInSaoPaulo() {
        LocalDate date = LocalDate.parse("2026-11-28");
        Instant lastMomentOfPreviousDay = Instant.parse("2026-11-28T02:59:59Z");
        Instant midnight = Instant.parse("2026-11-28T03:00:00Z");

        assertEquals(midnight, MarketplaceListingExpiry.deadline(date, lastMomentOfPreviousDay));
        var error = assertThrows(ApiException.class, () -> MarketplaceListingExpiry.deadline(date, midnight));
        assertEquals("INVALID_LISTING_EXPIRY", error.code());
    }

    @Test
    void brandCanPublishWithoutSettingAnExpiry() {
        assertNull(MarketplaceListingExpiry.deadline(null, Instant.parse("2026-11-28T03:00:00Z")));
    }
}
