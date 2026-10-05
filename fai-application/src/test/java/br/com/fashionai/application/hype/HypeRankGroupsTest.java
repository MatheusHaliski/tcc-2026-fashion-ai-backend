package br.com.fashionai.application.hype;

import br.com.fashionai.application.ports.RenderCachePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
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

/** "Marcas em alta" e "Criadores em alta" (RF53): agregados só de itens públicos elegíveis, com mínimo de itens por grupo. */
class HypeRankGroupsTest {
    private final HypeScoreConfig config = HypeScoreConfig.defaults();
    private HypeScoreCurrentRepository current;
    private WardrobeItemRepository pieces;
    private Guard guard;
    private HypeQueryService query;
    private final List<WardrobeItem> catalog = new ArrayList<>();
    private final List<HypeScoreCurrent> rows = new ArrayList<>();
    private final User ana = user("ana");
    private final User bia = user("bia");

    static User user(String name) {
        User u = new User();
        u.assignId(UUID.randomUUID());
        u.setUsername(name);
        u.setProfileVisibility(Visibility.PUBLIC);
        u.setProfileType(ProfileType.PESSOAL);
        return u;
    }

    void piece(User owner, String brand, double score) {
        WardrobeItem w = new WardrobeItem();
        w.assignId(UUID.randomUUID());
        w.setUser(owner);
        w.setBrandName(brand);
        catalog.add(w);
        HypeScoreCurrent c = new HypeScoreCurrent();
        c.setEntityType(HypeEntityType.PIECE);
        c.setEntityId(w.getId());
        c.setOwnerId(owner.getId());
        c.setAlgorithmVersion("HYPE_V2");
        c.setStatus(HypeStatus.AVAILABLE);
        c.setScore(BigDecimal.valueOf(score));
        c.setPublicEligible(true);
        c.setCalculatedAt(Instant.now());
        c.setWindowStart(Instant.now());
        c.setWindowEnd(Instant.now());
        rows.add(c);
    }

    @BeforeEach
    void setUp() {
        current = mock(HypeScoreCurrentRepository.class);
        pieces = mock(WardrobeItemRepository.class);
        guard = mock(Guard.class);
        RenderCachePort cache = mock(RenderCachePort.class);
        when(cache.get(any())).thenReturn(Optional.empty());
        query = new HypeQueryService(config, current, null, pieces, null, null, null, guard, null, null, new HypeCache(cache));
        // Ana: 3 peças Nike (80, 70, 60) + 1 sem marca; Bia: 2 peças Zara muito altas (99, 98)
        piece(ana, "Nike", 80);
        piece(ana, " nike ", 70);
        piece(ana, "Nike", 60);
        piece(ana, null, 95);
        piece(bia, "Zara", 99);
        piece(bia, "Zara", 98);
        when(current.findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(HypeEntityType.PIECE, "HYPE_V2", HypeStatus.AVAILABLE)).thenReturn(rows);
        when(current.findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(HypeEntityType.SCHEME, "HYPE_V2", HypeStatus.AVAILABLE)).thenReturn(List.of());
        when(pieces.findByIdIn(anyCollection())).thenReturn(catalog);
        when(guard.canView(any(), any(), eq(Visibility.PUBLIC))).thenReturn(true);
    }

    @SuppressWarnings("unchecked")
    static List<Map<String, Object>> items(Map<String, Object> out) {
        return (List<Map<String, Object>>) out.get("items");
    }

    @Test
    void brandNeedsAMinimumOfPublicItemsAndAveragesItsBestOnes() {
        List<Map<String, Object>> brands = items(query.trendingGroups(null, HypeQueryService.RankGroup.BRAND, 7, null, null, null, 10));
        assertThat(brands).hasSize(1);                               // Zara tem só 2 peças: fora, apesar das notas altas
        assertThat(brands.get(0).get("name")).isEqualTo("Nike");     // " nike " conta para a mesma marca
        assertThat(((Number) brands.get(0).get("value")).doubleValue()).isEqualTo(70.0);
        assertThat(brands.get(0).get("items")).isEqualTo(3);         // a peça sem marca não entra em marca nenhuma
    }

    @Test
    void creatorsAggregateTheirPublicItemsAndBlockedOnesDisappear() {
        List<Map<String, Object>> creators = items(query.trendingGroups(null, HypeQueryService.RankGroup.CREATOR, 7, null, null, null, 10));
        assertThat(creators).hasSize(1);                             // Bia tem só 2 itens públicos
        assertThat(creators.get(0).get("ownerId")).isEqualTo(ana.getId().toString());
        assertThat(((Number) creators.get(0).get("value")).doubleValue()).isEqualTo(76.3);   // média das 4: 95, 80, 70, 60

        CurrentUser viewer = new CurrentUser(UUID.randomUUID(), "leitor", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
        when(guard.canView(eq(viewer), eq(ana.getId()), eq(Visibility.PUBLIC))).thenReturn(false);   // bloqueio
        assertThat(items(query.trendingGroups(viewer, HypeQueryService.RankGroup.CREATOR, 7, null, null, null, 10))).isEmpty();
    }

    @Test
    void parsesPortugueseAndEnglishGroupNames() {
        assertThat(HypeQueryService.RankGroup.parse("marcas")).isEqualTo(HypeQueryService.RankGroup.BRAND);
        assertThat(HypeQueryService.RankGroup.parse("CREATOR")).isEqualTo(HypeQueryService.RankGroup.CREATOR);
        assertThat(HypeQueryService.RankGroup.parse("PIECE")).isNull();
    }
}
