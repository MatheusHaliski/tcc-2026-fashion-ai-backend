package br.com.fashionai.application.hype;

import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountOrigin;
import br.com.fashionai.domain.model.enums.HypeSignalType;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.HypeScoreSnapshotRepository;
import br.com.fashionai.domain.repository.HypeSignalDailyRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class HypeSnapshotRulesTest {
    static WardrobeItem piece(Visibility v, Visibility profile, ModerationStatus m, boolean test) {
        User u = new User();
        u.assignId(UUID.randomUUID());
        u.setProfileVisibility(profile);
        u.setAccountOrigin(test ? AccountOrigin.TEST_SEED : AccountOrigin.REAL);   // conta de teste = origem TEST_SEED (V30)
        WardrobeItem w = new WardrobeItem();
        w.setUser(u);
        w.setVisibility(v);
        w.setModerationStatus(m);
        w.setCategory("TOPS");
        w.setSubcategory("tshirt");
        w.setBrandName("Lacoste ");
        w.setColor("white");
        return w;
    }

    @Test
    void privateItemsNeverEnterPublicRankingsOrBaselines() {
        assertThat(HypeSnapshotService.publicPiece(piece(Visibility.PUBLIC, Visibility.PUBLIC, ModerationStatus.APPROVED, false))).isTrue();
        assertThat(HypeSnapshotService.publicPiece(piece(Visibility.PRIVATE, Visibility.PUBLIC, ModerationStatus.APPROVED, false))).isFalse();
        assertThat(HypeSnapshotService.publicPiece(piece(Visibility.FOLLOWERS, Visibility.PUBLIC, ModerationStatus.APPROVED, false))).isFalse();
        assertThat(HypeSnapshotService.publicPiece(piece(Visibility.PUBLIC, Visibility.PRIVATE, ModerationStatus.APPROVED, false))).isFalse();
        assertThat(HypeSnapshotService.publicPiece(piece(Visibility.PUBLIC, Visibility.PUBLIC, ModerationStatus.PENDING, false))).isFalse();
        assertThat(HypeSnapshotService.publicPiece(piece(Visibility.PUBLIC, Visibility.PUBLIC, ModerationStatus.APPROVED, true))).isFalse();
    }

    /** Perfil só para seguidores restringe as peças/looks aos seguidores: não entram em percentis, tendências nem rankings. */
    @Test
    void followersOnlyProfilesNeverEnterPublicData() {
        assertThat(HypeSnapshotService.publicPiece(piece(Visibility.PUBLIC, Visibility.FOLLOWERS, ModerationStatus.APPROVED, false))).isFalse();
        Scheme look = new Scheme();
        look.setUser(piece(Visibility.PUBLIC, Visibility.PUBLIC, ModerationStatus.APPROVED, false).getUser());
        look.setVisibility(Visibility.PUBLIC);
        look.setStatus(SchemeStatus.PUBLISHED);
        assertThat(HypeSnapshotService.publicScheme(look)).isTrue();
        look.getUser().setProfileVisibility(Visibility.FOLLOWERS);
        assertThat(HypeSnapshotService.publicScheme(look)).isFalse();
        look.getUser().setProfileVisibility(Visibility.PRIVATE);
        assertThat(HypeSnapshotService.publicScheme(look)).isFalse();
    }

    record Total(UUID entityId, HypeSignalType signalType, Long events, BigDecimal weighted) implements HypeSignalDailyRepository.SignalTotal {
        public UUID getEntityId() {
            return entityId;
        }

        public HypeSignalType getSignalType() {
            return signalType;
        }

        public Long getEvents() {
            return events;
        }

        public BigDecimal getWeighted() {
            return weighted;
        }
    }

    @Test
    void lifetimeComesFromTheIntegrityFilteredAggregate() {
        HypeScoreConfig config = HypeScoreConfig.defaults();
        UUID id = UUID.randomUUID();
        Map<UUID, HypeSnapshotService.Lifetime> out = HypeSnapshotService.lifetime(List.of(
                new Total(id, HypeSignalType.LIKE_CREATED, 4L, new BigDecimal("3.500")),
                new Total(id, HypeSignalType.COMMENT_CREATED, 1L, new BigDecimal("1.000")),
                new Total(id, HypeSignalType.PIECE_VIEWED, 7L, new BigDecimal("7.000")),
                new Total(id, HypeSignalType.PIECE_USED, 9L, new BigDecimal("9.000"))), config);   // uso não é interação nem visualização
        double expected = 3.5 * config.signalWeight(HypeSignalType.LIKE_CREATED) + 1.0 * config.signalWeight(HypeSignalType.COMMENT_CREATED);
        assertThat(out.get(id).interactions()).isEqualTo(expected);
        assertThat(out.get(id).events()).isEqualTo(5.0);
        assertThat(out.get(id).views()).isEqualTo(7.0);
    }

    /** Um evento vale o mesmo dentro e fora do horizonte: o peso do tipo de sinal não some quando ele envelhece. */
    @Test
    void lifetimeKeepsTheSignalWeightOfTheDailySeries() {
        HypeScoreConfig config = HypeScoreConfig.defaults();
        UUID id = UUID.randomUUID();
        double inside = HypeSignalSeries.build(List.of(row(id, HypeSignalType.SHARE_CREATED, java.time.LocalDate.now())),
                java.time.LocalDate.now(), config).get(id).activityBetween(0, config.horizonDays());
        double outside = HypeSnapshotService.lifetime(List.of(new Total(id, HypeSignalType.SHARE_CREATED, 1L, BigDecimal.ONE)), config)
                .get(id).interactions();
        assertThat(outside).isEqualTo(inside).isEqualTo(config.signalWeight(HypeSignalType.SHARE_CREATED));
    }

    private static br.com.fashionai.domain.model.HypeSignalDaily row(UUID id, HypeSignalType type, java.time.LocalDate day) {
        br.com.fashionai.domain.model.HypeSignalDaily r = new br.com.fashionai.domain.model.HypeSignalDaily();
        r.setEntityId(id);
        r.setSignalType(type);
        r.setSignalDate(day);
        r.setEventCount(1);
        r.setWeightedCount(BigDecimal.ONE);
        return r;
    }

    /**
     * Contadores brutos (likesCount, viewCount…) não passam pela política de integridade: três comentários do próprio dono
     * ou visualizações repetidas de visitante não podem subir a popularidade nem tirar o item de "dados insuficientes".
     */
    @Test
    void rawEntityCountersNeverFeedTheHype() {
        HypeScoreConfig config = HypeScoreConfig.defaults();
        HypeSnapshotService job = new HypeSnapshotService(config, mock(WardrobeItemRepository.class), mock(SchemeRepository.class),
                mock(SchemeItemRepository.class), mock(HypeSignalDailyRepository.class), mock(HypeScoreCurrentRepository.class),
                mock(HypeScoreSnapshotRepository.class), mock(HypeCache.class), mock(ApplicationEventPublisher.class));
        WardrobeItem p = piece(Visibility.PUBLIC, Visibility.PUBLIC, ModerationStatus.APPROVED, false);
        p.assignId(UUID.randomUUID());
        p.setCommentCount(3);
        p.setLikesCount(5);
        p.setViewCount(500);
        Instant now = Instant.now();
        p.markCreatedAt(now.minus(200, ChronoUnit.DAYS));

        HypeInputs raw = job.pieceEntries(List.of(p), Map.of(), Map.of(), now).get(0).inputs();
        assertThat(raw.lifetimeInteractions()).isZero();
        assertThat(raw.lifetimeViews()).isZero();
        assertThat(new HypeCalculator(config).compute(raw, HypeCalculator.Baseline.empty()).status()).isEqualTo(HypeStatus.INSUFFICIENT_DATA);

        HypeInputs filtered = job.pieceEntries(List.of(p), Map.of(), Map.of(p.getId(), new HypeSnapshotService.Lifetime(12, 4, 20)), now).get(0).inputs();
        assertThat(filtered.lifetimeInteractions()).isEqualTo(12.0);
        assertThat(filtered.lifetimeViews()).isEqualTo(20.0);
        assertThat(filtered.totalEvents()).as("eventos aceitos antes do horizonte contam 1 cada, não pelo peso").isEqualTo(4.0);
    }

    @Test
    void cohortIsTheCatalogProductOrCategoryPlusBrand() {
        WardrobeItem a = piece(Visibility.PUBLIC, Visibility.PUBLIC, ModerationStatus.APPROVED, false);
        WardrobeItem b = piece(Visibility.PRIVATE, Visibility.PUBLIC, ModerationStatus.APPROVED, false);
        b.setBrandName("lacoste");
        assertThat(HypeSnapshotService.cohortKey(a)).isEqualTo(HypeSnapshotService.cohortKey(b));
        UUID product = UUID.randomUUID();
        a.setCatalogProductId(product);
        assertThat(HypeSnapshotService.cohortKey(a)).isEqualTo("cat:" + product);
    }

    @Test
    void unusualAttributeCombinationsCarryMoreSurprise() {
        Map<String, Integer> freq = Map.of("common", 90, "rare", 1);
        double common = HypeSnapshotService.surprise(List.of("common"), freq, 100);
        double rare = HypeSnapshotService.surprise(List.of("rare"), freq, 100);
        assertThat(rare).isGreaterThan(common);
        assertThat(HypeSnapshotService.surprise(List.of(), freq, 100)).isNull();
    }

    @Test
    void limitedEditionTagsAreDetected() {
        assertThat(HypeSnapshotService.limitedEdition("[\"edição limitada\"]")).isTrue();
        assertThat(HypeSnapshotService.limitedEdition("Limited drop")).isTrue();
        assertThat(HypeSnapshotService.limitedEdition("basic")).isFalse();
        assertThat(HypeSnapshotService.limitedEdition(null)).isFalse();
    }
}
