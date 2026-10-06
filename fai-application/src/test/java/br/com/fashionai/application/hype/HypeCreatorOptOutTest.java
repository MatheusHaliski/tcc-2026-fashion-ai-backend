package br.com.fashionai.application.hype;

import br.com.fashionai.application.ports.RenderCachePort;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.HypeDimensions;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.assertj.core.groups.Tuple;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
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

/**
 * RF53 · Lote Final (P3-12) — opção de não aparecer em "Criadores em alta". Quem sai some do ranking de criadores (os
 * demais sobem de posição), o lote de chips devolve a chave dela sem dados (sem valor, faixa nem posição — nunca 0), as
 * peças dela continuam com o próprio Hype público e o cache por geração não serve o valor antigo depois da troca.
 */
@SuppressWarnings("unchecked")
class HypeCreatorOptOutTest {
    private final HypeScoreConfig config = HypeScoreConfig.defaults();
    private HypeScoreCurrentRepository current;
    private WardrobeItemRepository pieces;
    private UserPreferencesRepository preferences;
    private Guard guard;
    private HypeCache hypeCache;
    private HypeQueryService query;
    private final List<WardrobeItem> catalog = new ArrayList<>();
    private final List<HypeScoreCurrent> rows = new ArrayList<>();
    private final List<UUID> optedOut = new ArrayList<>();
    private final User ana = user("ana");
    private final User bia = user("bia");
    private final User carla = user("carla");

    static User user(String name) {
        User u = new User();
        u.assignId(UUID.randomUUID());
        u.setUsername(name);
        u.setProfileVisibility(Visibility.PUBLIC);
        u.setProfileType(ProfileType.PESSOAL);
        return u;
    }

    WardrobeItem piece(User owner, double score) {
        WardrobeItem w = new WardrobeItem();
        w.assignId(UUID.randomUUID());
        w.setUser(owner);
        w.setVisibility(Visibility.PUBLIC);
        w.setModerationStatus(ModerationStatus.APPROVED);
        w.setAvailabilityStatus(AvailabilityStatus.AVAILABLE);
        catalog.add(w);
        HypeScoreCurrent c = new HypeScoreCurrent();
        c.setEntityType(HypeEntityType.PIECE);
        c.setEntityId(w.getId());
        c.setOwnerId(owner.getId());
        c.setAlgorithmVersion(HypeScoreConfig.DEFAULT_VERSION);
        c.setStatus(HypeStatus.AVAILABLE);
        c.setScore(BigDecimal.valueOf(score));
        c.setDimensions(new HypeDimensions());
        c.setPublicEligible(true);
        c.setCalculatedAt(Instant.now());
        c.setWindowStart(Instant.now());
        c.setWindowEnd(Instant.now());
        rows.add(c);
        return w;
    }

    /** Cache em memória (como o fallback sem Redis): a geração e as chaves ficam guardadas de verdade. */
    static RenderCachePort memoryCache() {
        Map<String, String> store = new HashMap<>();
        return new RenderCachePort() {
            @Override
            public Optional<String> get(String key) {
                return Optional.ofNullable(store.get(key));
            }

            @Override
            public void put(String key, String value, Duration ttl) {
                store.put(key, value);
            }

            @Override
            public void evict(String key) {
                store.remove(key);
            }
        };
    }

    @BeforeEach
    void setUp() {
        current = mock(HypeScoreCurrentRepository.class);
        pieces = mock(WardrobeItemRepository.class);
        preferences = mock(UserPreferencesRepository.class);
        guard = mock(Guard.class);
        hypeCache = new HypeCache(memoryCache());
        query = new HypeQueryService(config, current, null, pieces, null, null, null, guard, null, null, hypeCache);
        query.setPreferences(preferences);
        // Carla: 90, 88, 85 (média 87,7) · Ana: 95, 80, 70, 60 (média 76,3) · Bia: só 2 itens (insuficiente)
        piece(carla, 90);
        piece(carla, 88);
        piece(carla, 85);
        piece(ana, 95);
        piece(ana, 80);
        piece(ana, 70);
        piece(ana, 60);
        piece(bia, 99);
        piece(bia, 98);
        when(current.findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(HypeEntityType.PIECE, HypeScoreConfig.DEFAULT_VERSION, HypeStatus.AVAILABLE)).thenReturn(rows);
        when(current.findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(HypeEntityType.SCHEME, HypeScoreConfig.DEFAULT_VERSION, HypeStatus.AVAILABLE)).thenReturn(List.of());
        when(current.findByEntityTypeAndEntityIdInAndAlgorithmVersion(eq(HypeEntityType.PIECE), anyCollection(), eq(HypeScoreConfig.DEFAULT_VERSION)))
                .thenAnswer(inv -> rows.stream().filter(c -> ((Collection<UUID>) inv.getArgument(1)).contains(c.getEntityId())).toList());
        when(pieces.findByIdIn(anyCollection()))
                .thenAnswer(inv -> catalog.stream().filter(w -> ((Collection<UUID>) inv.getArgument(0)).contains(w.getId())).toList());
        when(preferences.findHypeCreatorOptOutUserIds()).thenAnswer(inv -> List.copyOf(optedOut));
        when(guard.canView(any(), any(), any(Visibility.class))).thenReturn(true);
    }

    static List<Map<String, Object>> items(Map<String, Object> out) {
        return (List<Map<String, Object>>) out.get("items");
    }

    static Map<String, Map<String, Object>> byKey(Map<String, Object> out) {
        return (Map<String, Map<String, Object>>) out.get("items");
    }

    List<Map<String, Object>> creators() {
        return items(query.trendingGroups(null, HypeQueryService.RankGroup.CREATOR, 7, null, null, null, 10));
    }

    @Test
    void semOptOutAmbasAparecemNoRanking() {
        assertThat(creators()).extracting(m -> m.get("ownerId"), m -> m.get("rank"))
                .containsExactly(Tuple.tuple(carla.getId().toString(), 1), Tuple.tuple(ana.getId().toString(), 2));
    }

    @Test
    void quemSaiSomeDoRankingDeCriadoresEOsDemaisSobem() {
        optedOut.add(carla.getId());
        List<Map<String, Object>> list = creators();
        assertThat(list).hasSize(1);
        assertThat(list.get(0)).containsEntry("ownerId", ana.getId().toString()).containsEntry("rank", 1);   // Ana sobe de 2 para 1
        assertThat(list).noneMatch(m -> carla.getId().toString().equals(m.get("ownerId")) || carla.getId().toString().equals(m.get("key")));
        // janela "hoje" (trend) e 30 dias também: o filtro está no agrupamento, não numa janela só
        assertThat(items(query.trendingGroups(null, HypeQueryService.RankGroup.CREATOR, 1, null, null, null, 10)))
                .noneMatch(m -> carla.getId().toString().equals(m.get("ownerId")));
    }

    @Test
    void loteDeChipsDevolveQuemSaiuComoSemDadosNuncaZeroNemPosicao() {
        optedOut.add(carla.getId());
        Map<String, Object> out = query.groups(null, HypeQueryService.RankGroup.CREATOR, List.of(carla.getId().toString(), ana.getId().toString()), 7);
        assertThat(out.get("total")).isEqualTo(1);                       // só a Ana conta no ranking público
        Map<String, Map<String, Object>> got = byKey(out);
        Map<String, Object> c = got.get(carla.getId().toString());
        assertThat(c).containsEntry("sufficient", false);
        assertThat(c.get("value")).isNull();
        assertThat(c.get("level")).isNull();
        assertThat(c.get("rank")).isNull();
        assertThat(c).doesNotContainKey("top");
        assertThat(got.get(ana.getId().toString())).containsEntry("sufficient", true).containsEntry("rank", 1);
    }

    @Test
    void asPecasDeQuemSaiuContinuamComOProprioHypePublico() {
        optedOut.add(carla.getId());
        List<UUID> carlaPieces = catalog.stream().filter(w -> w.getUser() == carla).map(WardrobeItem::getId).toList();
        // ranking de PEÇAS: as três da Carla seguem lá, com o próprio score
        List<Map<String, Object>> ranked = (List<Map<String, Object>>) query.rank(HypeEntityType.PIECE, 7, null, null, null, 20).get("items");
        assertThat(ranked).extracting(m -> UUID.fromString(String.valueOf(m.get("id")))).containsAll(carlaPieces);
        // card (lote de resumos) de quem vê de fora: Hype público disponível, com o número
        Map<String, Object> summaries = (Map<String, Object>) query.summaries(null, HypeEntityType.PIECE, carlaPieces).get("items");
        assertThat(summaries).hasSize(3);
        summaries.values().forEach(s -> assertThat((Map<String, Object>) s).containsEntry("status", "AVAILABLE").extractingByKey("score").isNotNull());
        // o opt-out é só do agregado de pessoa: a lista de quem saiu é a da preferência
        assertThat(query.creatorOptOuts()).containsExactly(carla.getId());
    }

    @Test
    void trocaDaOpcaoComNovaGeracaoNaoServeORankingAntigoDoCache() {
        assertThat(creators()).hasSize(2);                               // vai para o cache desta geração
        optedOut.add(carla.getId());
        assertThat(creators()).hasSize(2);                               // mesma geração: ainda o valor em cache
        hypeCache.bump();                                                 // o que a PreferencesService faz ao trocar a opção
        assertThat(creators()).extracting(m -> m.get("ownerId")).containsExactly(ana.getId().toString());
        Map<String, Object> chip = byKey(query.groups(null, HypeQueryService.RankGroup.CREATOR, List.of(carla.getId().toString()), 7)).get(carla.getId().toString());
        assertThat(chip).containsEntry("sufficient", false);
        assertThat(chip.get("rank")).isNull();
        optedOut.clear();                                                 // voltou a aparecer
        hypeCache.bump();
        assertThat(creators()).extracting(m -> m.get("rank")).containsExactly(1, 2);
    }

    @Test
    void semORepositorioNinguemSaiuDoRanking() {
        HypeQueryService legacy = new HypeQueryService(config, current, null, pieces, null, null, null, guard, null, null, new HypeCache(memoryCache()));
        assertThat(legacy.creatorOptOuts()).isEmpty();
        assertThat(items(legacy.trendingGroups(null, HypeQueryService.RankGroup.CREATOR, 7, null, null, null, 10))).hasSize(2);
    }
}
