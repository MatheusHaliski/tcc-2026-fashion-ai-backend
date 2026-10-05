package br.com.fashionai.application.hype;

import br.com.fashionai.application.ports.RenderCachePort;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeMomentum;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** RF53 — o resumo de Hype (cards, detalhe, ranking, trending) carrega os selos de Hype; o detalhe traz o progresso. */
class HypeSealsQueryTest {
    private final HypeScoreConfig config = HypeScoreConfig.defaults();
    private HypeScoreCurrentRepository current;
    private WardrobeItemRepository pieces;
    private HypeQueryService query;
    private WardrobeItem piece;

    @BeforeEach
    void setUp() {
        current = mock(HypeScoreCurrentRepository.class);
        pieces = mock(WardrobeItemRepository.class);
        SchemeItemRepository schemeItems = mock(SchemeItemRepository.class);
        Guard guard = mock(Guard.class);
        when(guard.canView(any(), any(), any())).thenReturn(true);
        RenderCachePort cache = mock(RenderCachePort.class);
        when(cache.get(any())).thenReturn(Optional.empty());
        query = new HypeQueryService(config, current, null, pieces, null, schemeItems, null, guard, null, null, new HypeCache(cache));
        User owner = new User();
        owner.assignId(UUID.randomUUID());
        owner.setProfileVisibility(Visibility.PUBLIC);
        piece = new WardrobeItem();
        piece.assignId(UUID.randomUUID());
        piece.setUser(owner);
        piece.setVisibility(Visibility.PUBLIC);
        piece.setModerationStatus(ModerationStatus.APPROVED);
        when(pieces.findById(piece.getId())).thenReturn(Optional.of(piece));
        when(pieces.findByIdIn(anyCollection())).thenReturn(List.of(piece));
    }

    @Test
    void resumoTrazOsSelosDeHype() {
        HypeScoreCurrent c = HypeSealsTest.row(66, HypeLevel.HOT, HypeMomentum.RISING, 72.0, null);
        assertThat(query.summary(c, Instant.now()).get("seals")).isEqualTo(List.of("TRENDING", "CLASSIC"));
        assertThat(query.summary(HypeSealsTest.row(30, HypeLevel.NICHE, HypeMomentum.STABLE, null, null), Instant.now()).get("seals")).isEqualTo(List.of());
        assertThat(query.summary(null, Instant.now())).containsEntry("status", "NOT_CALCULATED").containsEntry("seals", List.of());
    }

    @Test
    void lotePorCardsTambemTrazOsSelos() {
        HypeScoreCurrent c = HypeSealsTest.row(91, HypeLevel.VIRAL, HypeMomentum.RISING, null, null);
        c.setEntityId(piece.getId());
        when(current.findByEntityTypeAndEntityIdInAndAlgorithmVersion(eq(HypeEntityType.PIECE), anyCollection(), eq("HYPE_V2"))).thenReturn(List.of(c));
        Map<String, Object> out = query.summaries(null, HypeEntityType.PIECE, List.of(piece.getId()));
        @SuppressWarnings("unchecked")
        Map<String, Map<String, Object>> items = (Map<String, Map<String, Object>>) out.get("items");
        assertThat(items.get(piece.getId().toString()).get("seals")).isEqualTo(List.of("VIRAL"));
    }

    @Test
    void detalheTrazOProgressoDosSelos() {
        HypeScoreCurrent c = HypeSealsTest.row(45, HypeLevel.RELEVANT, HypeMomentum.EMERGING, null, 80.0);
        c.setEntityId(piece.getId());
        when(current.findByEntityTypeAndEntityIdAndAlgorithmVersion(HypeEntityType.PIECE, piece.getId(), "HYPE_V2")).thenReturn(Optional.of(c));
        Map<String, Object> out = query.detail(null, HypeEntityType.PIECE, piece.getId());
        assertThat(out.get("seals")).isEqualTo(List.of("EMERGING", "RARE"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> progress = (List<Map<String, Object>>) out.get("sealProgress");
        assertThat(progress).hasSize(5);
        assertThat(progress).filteredOn(m -> Boolean.TRUE.equals(m.get("earned"))).extracting(m -> m.get("code")).containsExactly("EMERGING", "RARE");
        assertThat(progress.get(0)).containsEntry("criteria", "Nível Viral (≥ 90)");
    }
}
