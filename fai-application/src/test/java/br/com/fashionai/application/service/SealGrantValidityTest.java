package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.Seal;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.model.enums.SealTier;
import br.com.fashionai.domain.repository.*;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

/** A validade do selo concedido não herda o fim da campanha; selo vencido sai do card do look. */
class SealGrantValidityTest {

    @Test
    void grantedSealCountsFromIssuanceNotFromCampaignEnd() {
        Seal seal = new Seal();
        Instant issued = Instant.parse("2026-10-25T23:59:00Z");
        seal.setAvailableUntil(Instant.parse("2026-10-26T00:00:00Z"));   // campanha termina 1 minuto depois do resgate

        assertThat(SealService.grantExpiry(seal, issued)).isEqualTo(issued.plus(SealService.DEFAULT_SEAL_VALIDITY));

        seal.setGrantValidityDays(30);
        assertThat(SealService.grantExpiry(seal, issued)).isEqualTo(issued.plus(Duration.ofDays(30)));
    }

    @Test
    void lookBadgesHideExpiredGrants() {
        UUID schemeId = UUID.randomUUID();
        User issuer = new User(); issuer.assignId(UUID.randomUUID()); issuer.setUsername("nike"); issuer.setProfileType(ProfileType.MARCA);
        Seal seal = new Seal(); seal.setName("Selo Nike"); seal.setOwner(issuer);
        SealBond valid = bond(issuer, seal, Instant.now().plus(Duration.ofDays(3)));
        SealBond expired = bond(issuer, seal, Instant.now().minus(Duration.ofMinutes(1)));
        SealBondRepository bonds = mock(SealBondRepository.class);
        when(bonds.findBySchemeId(schemeId)).thenReturn(List.of(valid, expired));
        SealService service = new SealService(mock(SealRepository.class), bonds, mock(PromotionRepository.class), mock(PromotionRedemptionRepository.class),
                mock(SchemeRepository.class), mock(SchemeItemRepository.class), mock(BrandProfileRepository.class), mock(CelebrityProfileRepository.class),
                mock(UserRepository.class), mock(WardrobeItemRepository.class), mock(NotificationService.class), mock(AiEngine.class), mock(Guard.class),
                mock(Audit.class), event -> {}, mock(OwnMedia.class));

        assertThat(service.approvedBadges(schemeId)).hasSize(1).first()
                .satisfies(b -> assertThat(b.get("expiresAt")).isEqualTo(valid.getExpiresAt()));
    }

    private static SealBond bond(User issuer, Seal seal, Instant expiresAt) {
        SealBond b = new SealBond();
        b.setStatus(SealBondStatus.APPROVED);
        b.setTier(SealTier.LOOK);
        b.setTargetOwner(issuer);
        b.setSeal(seal);
        b.setExpiresAt(expiresAt);
        b.setLinkedPieceIdsJson("[]");
        return b;
    }
}
