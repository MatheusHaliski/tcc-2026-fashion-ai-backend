package br.com.fashionai.application.hype;

import br.com.fashionai.application.ports.RenderCachePort;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Privacidade do HypeScore v2: itens privados não aparecem para terceiros nem entram no ranking público. */
class HypeQueryPrivacyTest {
    private final HypeScoreConfig config = HypeScoreConfig.defaults();
    private HypeScoreCurrentRepository current;
    private WardrobeItemRepository pieces;
    private Guard guard;
    private HypeQueryService query;
    private final UUID owner = UUID.randomUUID();
    private WardrobeItem pub;
    private WardrobeItem priv;

    static WardrobeItem piece(UUID ownerId, Visibility v) {
        User u = new User();
        u.assignId(ownerId);
        u.setProfileVisibility(Visibility.PUBLIC);
        WardrobeItem w = new WardrobeItem();
        w.assignId(UUID.randomUUID());
        w.setUser(u);
        w.setVisibility(v);
        w.setModerationStatus(ModerationStatus.APPROVED);
        w.setAvailabilityStatus(AvailabilityStatus.AVAILABLE);
        return w;
    }

    static HypeScoreCurrent row(UUID id, boolean eligible) {
        HypeScoreCurrent c = new HypeScoreCurrent();
        c.setEntityType(HypeEntityType.PIECE);
        c.setEntityId(id);
        c.setAlgorithmVersion("HYPE_V2");
        c.setStatus(HypeStatus.AVAILABLE);
        c.setScore(BigDecimal.valueOf(70));
        c.setPublicEligible(eligible);
        c.setCalculatedAt(Instant.now());
        c.setWindowStart(Instant.now());
        c.setWindowEnd(Instant.now());
        return c;
    }

    @BeforeEach
    void setUp() {
        current = mock(HypeScoreCurrentRepository.class);
        pieces = mock(WardrobeItemRepository.class);
        guard = mock(Guard.class);
        RenderCachePort cache = mock(RenderCachePort.class);
        when(cache.get(any())).thenReturn(Optional.empty());
        query = new HypeQueryService(config, current, null, pieces, null, null, null, guard, null, null, new HypeCache(cache));
        pub = piece(owner, Visibility.PUBLIC);
        priv = piece(owner, Visibility.PRIVATE);
        when(pieces.findByIdIn(anyCollection())).thenReturn(List.of(pub, priv));
        when(guard.canView(isNull(), eq(owner), eq(Visibility.PUBLIC))).thenReturn(true);
        when(guard.canView(isNull(), eq(owner), eq(Visibility.PRIVATE))).thenReturn(false);
        when(current.findByEntityTypeAndEntityIdInAndAlgorithmVersion(eq(HypeEntityType.PIECE), anyCollection(), eq("HYPE_V2")))
                .thenReturn(List.of(row(pub.getId(), true)));
    }

    @Test
    @SuppressWarnings("unchecked")
    void visitorNeverSeesTheHypeOfAPrivatePiece() {
        Map<String, Object> out = query.summaries(null, HypeEntityType.PIECE, List.of(pub.getId(), priv.getId()));
        Map<String, Object> items = (Map<String, Object>) out.get("items");
        assertThat(items).containsOnlyKeys(pub.getId().toString());
        ArgumentCaptor<Collection<UUID>> asked = ArgumentCaptor.forClass(Collection.class);
        verify(current).findByEntityTypeAndEntityIdInAndAlgorithmVersion(eq(HypeEntityType.PIECE), asked.capture(), eq("HYPE_V2"));
        assertThat(asked.getValue()).containsExactly(pub.getId());   // nem chega a consultar o privado
    }

    @Test
    void rankingOnlyReadsThePublicEligiblePopulation() {
        when(current.findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(HypeEntityType.PIECE, "HYPE_V2", HypeStatus.AVAILABLE))
                .thenReturn(List.of(row(pub.getId(), true)));
        Map<String, Object> ranked = query.rank(HypeEntityType.PIECE, 7, null, null, null, 10);
        assertThat(ranked.get("items")).asList().hasSize(1);
        verify(current, never()).findByEntityTypeAndAlgorithmVersion(any(), any());
    }

    @Test
    void moversFollowTheComputedDirectionNotTheDeltaSign() {
        HypeScoreCurrent stable = row(UUID.randomUUID(), true);
        stable.setDeltaPoints(BigDecimal.valueOf(-1.9));
        stable.setDirection("STABLE");
        HypeScoreCurrent down = row(UUID.randomUUID(), true);
        down.setDeltaPoints(BigDecimal.valueOf(-8));
        down.setDirection("DOWN");
        HypeScoreCurrent fresh = row(UUID.randomUUID(), true);   // sem histórico: sem delta, nunca "subiu"
        fresh.setDirection("UP");
        assertThat(HypeQueryService.isMoving(stable)).isFalse();
        assertThat(HypeQueryService.isMoving(down)).isTrue();
        assertThat(HypeQueryService.isMoving(fresh)).isFalse();
    }
}
