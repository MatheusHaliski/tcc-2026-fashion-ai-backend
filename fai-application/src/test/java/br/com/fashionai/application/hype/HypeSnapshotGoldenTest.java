package br.com.fashionai.application.hype;

import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.HypeScoreSnapshot;
import br.com.fashionai.domain.model.HypeSignalDaily;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountOrigin;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeMomentum;
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
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Caracterização do job de snapshots: um universo fixo (peças, looks, sinais diários, histórico anterior, estado e
 * snapshots já gravados) e o retrato do que o {@code recalculate()} grava, apaga e publica — gerado no código original.
 */
class HypeSnapshotGoldenTest {
    private final HypeScoreConfig config = HypeScoreConfig.defaults();
    private final LocalDate today = LocalDate.now(HypeSignalRecorder.ZONE);
    private final Instant now = Instant.now();
    private final Random rnd = new Random(84L);
    private final List<WardrobeItem> pieces = new ArrayList<>();
    private final List<Scheme> looks = new ArrayList<>();
    private final List<SchemeItem> lookItems = new ArrayList<>();
    private final List<HypeSignalDaily> signals = new ArrayList<>();
    private final List<HypeScoreSnapshot> stored = new ArrayList<>();

    static UUID id(String key) {
        return UUID.nameUUIDFromBytes(key.getBytes(StandardCharsets.UTF_8));
    }

    static User user(String key, String country, Visibility profile, boolean test) {
        User u = new User();
        u.assignId(id(key));
        u.setUsername(key);
        u.setCountry(country);
        u.setProfileVisibility(profile);
        if (test) {
            u.setAccountOrigin(AccountOrigin.TEST_SEED);
        }
        return u;
    }

    WardrobeItem piece(String key, User owner, String category, String sub, String color, Visibility v) {
        WardrobeItem w = new WardrobeItem();
        w.assignId(id(key));
        w.setUser(owner);
        w.setName(key);
        w.setCategory(category);
        w.setSubcategory(sub);
        w.setColor(color);
        w.setMaterial(rnd.nextBoolean() ? "cotton" : null);
        w.setStyleTags(rnd.nextBoolean() ? "casual,street" : "classic");
        w.setOccasionTags("work");
        w.setTags(rnd.nextInt(5) == 0 ? "Edição limitada" : null);
        w.setBrandName(rnd.nextBoolean() ? " Nike " : null);
        w.setCatalogProductId(rnd.nextInt(4) == 0 ? id("cat-" + category) : null);
        w.setVisibility(v);
        w.setModerationStatus(ModerationStatus.APPROVED);
        w.setAvailabilityStatus(AvailabilityStatus.AVAILABLE);
        w.markCreatedAt(now.minus(5 + rnd.nextInt(150), ChronoUnit.DAYS));
        pieces.add(w);
        return w;
    }

    Scheme look(String key, User owner, Scheme original, WardrobeItem... parts) {
        Scheme s = new Scheme();
        s.assignId(id(key));
        s.setUser(owner);
        s.setTitle(key);
        s.setVisibility(Visibility.PUBLIC);
        s.setStatus(SchemeStatus.PUBLISHED);
        s.setStyle("casual");
        s.setOccasion("party,work");
        s.setRemixCount(rnd.nextInt(6));
        s.setOriginalScheme(original);
        s.setPublishedAt(now.minus(3 + rnd.nextInt(90), ChronoUnit.DAYS));
        s.markCreatedAt(now.minus(100, ChronoUnit.DAYS));
        for (int i = 0; i < parts.length; i++) {
            SchemeItem si = new SchemeItem();
            si.assignId(id(key + "-" + i));
            si.setScheme(s);
            si.setWardrobeItem(parts[i]);
            si.setSortOrder(i);
            lookItems.add(si);
        }
        looks.add(s);
        return s;
    }

    void activity(HypeEntityType type, UUID entity, int days, int intensity) {
        HypeSignalType[] kinds = type == HypeEntityType.PIECE
                ? new HypeSignalType[]{HypeSignalType.LIKE_CREATED, HypeSignalType.SAVE_CREATED, HypeSignalType.PIECE_VIEWED, HypeSignalType.PIECE_USED}
                : new HypeSignalType[]{HypeSignalType.LIKE_CREATED, HypeSignalType.LOOK_REMIXED, HypeSignalType.LOOK_VIEWED, HypeSignalType.COMMENT_CREATED};
        for (int d = 0; d < days; d++) {
            if (rnd.nextInt(3) == 0) {
                continue;
            }
            HypeSignalDaily r = new HypeSignalDaily();
            r.setEntityType(type);
            r.setEntityId(entity);
            r.setSignalType(kinds[rnd.nextInt(kinds.length)]);
            r.setSignalDate(today.minusDays(d));
            int n = 1 + rnd.nextInt(intensity);
            r.setEventCount(n);
            r.setWeightedCount(rnd.nextBoolean() ? null : BigDecimal.valueOf(n * 0.75));
            signals.add(r);
        }
    }

    record Total(UUID getEntityId, HypeSignalType getSignalType, Long getEvents, BigDecimal getWeighted) implements HypeSignalDailyRepository.SignalTotal {
    }

    static HypeScoreCurrent existing(HypeEntityType type, UUID id, HypeLevel level, HypeMomentum momentum) {
        HypeScoreCurrent c = new HypeScoreCurrent();
        c.setEntityType(type);
        c.setEntityId(id);
        c.setStatus(HypeStatus.AVAILABLE);
        c.setLevel(level);
        c.setMomentum(momentum);
        return c;
    }

    HypeScoreSnapshot past(HypeEntityType type, UUID id, int daysAgo, double score) {
        HypeScoreSnapshot s = new HypeScoreSnapshot();
        s.setEntityType(type);
        s.setEntityId(id);
        s.setSnapshotDate(today.minusDays(daysAgo));
        s.setScore(BigDecimal.valueOf(score));
        stored.add(s);
        return s;
    }

    static Map<String, Object> portrait(HypeScoreCurrent c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("type", c.getEntityType());
        m.put("id", c.getEntityId());
        m.put("owner", c.getOwnerId());
        m.put("version", c.getAlgorithmVersion());
        m.put("status", c.getStatus());
        m.put("score", c.getScore());
        m.put("level", c.getLevel());
        m.put("dimensions", HypeCards.dimensions(c.getDimensions()));
        m.put("delta", List.of(String.valueOf(c.getDeltaPoints()), String.valueOf(c.getDeltaPercent()), String.valueOf(c.getDirection())));
        m.put("momentum", c.getMomentum());
        m.put("public", c.isPublicEligible());
        m.put("cuts", List.of(String.valueOf(c.getCategory()), String.valueOf(c.getStyles()), String.valueOf(c.getOccasions()), String.valueOf(c.getCountry()),
                String.valueOf(c.getRegion()), String.valueOf(c.getCategories()), String.valueOf(c.getSubcategories())));
        // byType: a contagem de cada sinal nasce de Map.of(current, previous, total), cuja ordem muda a cada JVM — ordena só ali
        m.put("signals", c.getSignalsJson() == null ? null : c.getSignalsJson().replaceAll(
                "\\{\"(current|previous|total)\":(\\d+),\"(current|previous|total)\":(\\d+),\"(current|previous|total)\":(\\d+)}", "<$1=$2 $3=$4 $5=$6>")
                .replaceAll("<(?=[^>]*current=(\\d+))(?=[^>]*previous=(\\d+))(?=[^>]*total=(\\d+))[^>]*>", "{current=$1,previous=$2,total=$3}"));
        m.put("reasons", c.getReasonsJson());
        m.put("window", c.getWindowEnd() != null && c.getCalculatedAt() != null && c.getWindowStart() != null
                && ChronoUnit.DAYS.between(c.getWindowStart(), c.getWindowEnd()) == 84);
        return m;
    }

    static Map<String, Object> portrait(HypeScoreSnapshot s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("type", s.getEntityType());
        m.put("id", s.getEntityId());
        m.put("status", s.getStatus());
        m.put("score", s.getScore());
        m.put("level", s.getLevel());
        m.put("dimensions", HypeCards.dimensions(s.getDimensions()));
        m.put("public", s.isPublicEligible());
        return m;
    }

    @Test
    @SuppressWarnings("unchecked")
    void recalculoIgualAoRetrato() throws Exception {
        User ana = user("ana", "BR", Visibility.PUBLIC, false);
        User bia = user("bia", "fr ", Visibility.PUBLIC, false);
        User cai = user("cai", null, Visibility.PRIVATE, false);
        User e2e = user("e2e_dan", "US", Visibility.PUBLIC, true);
        List<User> owners = List.of(ana, bia, cai, e2e);
        String[][] kinds = {{"upper_piece", "t_shirt", "white"}, {"shoes_piece", "casual_sneakers", "black"}, {"lower_piece", "jeans", "blue"}};
        for (int i = 0; i < 18; i++) {
            String[] k = kinds[i % kinds.length];
            WardrobeItem w = piece("p" + i, owners.get(i % owners.size()), k[0], k[1], i % 4 == 0 ? "red" : k[2], i % 5 == 4 ? Visibility.PRIVATE : Visibility.PUBLIC);
            activity(HypeEntityType.PIECE, w.getId(), 10 + rnd.nextInt(80), 1 + i % 6);
        }
        WardrobeItem archived = piece("archived", ana, "upper_piece", "t_shirt", "white", Visibility.PUBLIC);
        archived.setAvailabilityStatus(AvailabilityStatus.ARCHIVED);
        Scheme a = look("la", ana, null, pieces.get(0), pieces.get(1), pieces.get(2));
        Scheme b = look("lb", bia, a, pieces.get(3), pieces.get(4));
        look("lc", bia, b, pieces.get(5), pieces.get(1));
        Scheme draft = look("ld", cai, null, pieces.get(6));
        draft.setStatus(SchemeStatus.DRAFT);
        look("le", ana, a, pieces.get(7), pieces.get(8), pieces.get(9), pieces.get(10));
        looks.forEach(s -> activity(HypeEntityType.SCHEME, s.getId(), 5 + rnd.nextInt(60), 4));

        List<HypeSignalDailyRepository.SignalTotal> before = List.of(new Total(id("p0"), HypeSignalType.LIKE_CREATED, 40L, BigDecimal.valueOf(30)),
                new Total(id("p1"), HypeSignalType.PIECE_VIEWED, 300L, null), new Total(id("p2"), HypeSignalType.SAVE_CREATED, 12L, null),
                new Total(null, HypeSignalType.LIKE_CREATED, 5L, null), new Total(id("p3"), null, 5L, null), new Total(id("p4"), HypeSignalType.LIKE_CREATED, null, null));
        List<HypeSignalDailyRepository.SignalTotal> beforeLooks = List.of(new Total(id("la"), HypeSignalType.LOOK_REMIXED, 9L, BigDecimal.valueOf(7.5)));

        WardrobeItemRepository pieceRepo = mock(WardrobeItemRepository.class);
        SchemeRepository schemeRepo = mock(SchemeRepository.class);
        SchemeItemRepository itemRepo = mock(SchemeItemRepository.class);
        HypeSignalDailyRepository signalRepo = mock(HypeSignalDailyRepository.class);
        HypeScoreCurrentRepository current = mock(HypeScoreCurrentRepository.class);
        HypeScoreSnapshotRepository snaps = mock(HypeScoreSnapshotRepository.class);
        ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);
        when(pieceRepo.findAll()).thenReturn(pieces);
        when(schemeRepo.findAll()).thenReturn(looks);
        when(itemRepo.findBySchemeIdIn(anyCollection())).thenAnswer(x -> lookItems.stream()
                .filter(si -> ((java.util.Collection<UUID>) x.getArgument(0)).contains(si.getScheme().getId())).toList());
        when(signalRepo.findByEntityTypeAndSignalDateGreaterThanEqual(any(), any())).thenAnswer(x -> signals.stream()
                .filter(r -> r.getEntityType() == x.getArgument(0) && !r.getSignalDate().isBefore(x.getArgument(1))).toList());
        when(signalRepo.totalsBefore(eq(HypeEntityType.PIECE), any())).thenReturn(before);
        when(signalRepo.totalsBefore(eq(HypeEntityType.SCHEME), any())).thenReturn(beforeLooks);
        when(current.findByEntityTypeAndAlgorithmVersion(HypeEntityType.PIECE, config.algorithmVersion())).thenReturn(List.of(
                existing(HypeEntityType.PIECE, id("p0"), HypeLevel.LOW_SIGNAL, HypeMomentum.STABLE),
                existing(HypeEntityType.PIECE, id("p1"), null, HypeMomentum.COOLING),
                existing(HypeEntityType.PIECE, id("p5"), HypeLevel.NICHE, HypeMomentum.STABLE),
                existing(HypeEntityType.PIECE, id("p14"), HypeLevel.RELEVANT, HypeMomentum.RISING),
                existing(HypeEntityType.PIECE, id("gone"), HypeLevel.HOT, null)));
        when(current.findByEntityTypeAndAlgorithmVersion(HypeEntityType.SCHEME, config.algorithmVersion())).thenReturn(List.of(
                existing(HypeEntityType.SCHEME, id("la"), HypeLevel.NICHE, HypeMomentum.COOLING),
                existing(HypeEntityType.SCHEME, id("lb"), HypeLevel.RELEVANT, HypeMomentum.STABLE)));
        for (int i = 0; i < 12; i++) {
            past(HypeEntityType.PIECE, id("p" + i), 7 + i % 5, 20 + 5 * i);
        }
        past(HypeEntityType.PIECE, id("p0"), 0, 10);   // snapshot de hoje: é reaproveitado
        past(HypeEntityType.SCHEME, id("la"), 8, 33.3);
        past(HypeEntityType.SCHEME, id("lb"), 9, 0);
        when(snaps.findByEntityTypeAndAlgorithmVersionAndSnapshotDateBetween(any(), any(), any(), any())).thenAnswer(x -> stored.stream()
                .filter(s -> s.getEntityType() == x.getArgument(0) && !s.getSnapshotDate().isBefore(x.getArgument(2)) && !s.getSnapshotDate().isAfter(x.getArgument(3)))
                .toList());

        HypeSnapshotService job = new HypeSnapshotService(config, pieceRepo, schemeRepo, itemRepo, signalRepo, current, snaps, mock(HypeCache.class), events);
        Map<String, Object> out = new LinkedHashMap<>(job.recalculate());
        out.remove("calculatedAt");

        ArgumentCaptor<List<HypeScoreCurrent>> saved = ArgumentCaptor.forClass(List.class);
        ArgumentCaptor<List<HypeScoreSnapshot>> snapped = ArgumentCaptor.forClass(List.class);
        ArgumentCaptor<List<HypeScoreCurrent>> deleted = ArgumentCaptor.forClass(List.class);
        ArgumentCaptor<Object> published = ArgumentCaptor.forClass(Object.class);
        verify(current, atLeast(1)).saveAll(saved.capture());
        verify(snaps, atLeast(1)).saveAll(snapped.capture());
        verify(current, atLeast(1)).deleteAll(deleted.capture());
        verify(events, atLeast(0)).publishEvent(published.capture());
        verify(current, atLeast(1)).saveAll(anyList());

        StringBuilder sb = new StringBuilder(HypeGolden.canonical(out)).append('\n');
        saved.getAllValues().forEach(l -> l.forEach(c -> sb.append(HypeGolden.canonical(portrait(c))).append('\n')));
        snapped.getAllValues().forEach(l -> l.forEach(s -> sb.append(HypeGolden.canonical(portrait(s))).append('\n')));
        deleted.getAllValues().forEach(l -> l.forEach(c -> sb.append("deleted ").append(c.getEntityId()).append('\n')));
        published.getAllValues().forEach(e -> sb.append("event ").append(e).append('\n'));
        HypeGolden.assertMatches("snapshot-recalculate", sb.toString());
    }
}
