package br.com.fashionai.application.service;

import br.com.fashionai.application.room.RoomAddress;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.domain.model.ChallengeTemplate;
import br.com.fashionai.domain.model.InventoryScoreSnapshot;
import br.com.fashionai.domain.model.PieceUsageDiaryEntry;
import br.com.fashionai.domain.model.RoomLayout;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeAvailabilityChange;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.SchemeSlot;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.StyleArchetype;
import br.com.fashionai.domain.repository.ChallengeTemplateRepository;
import br.com.fashionai.domain.repository.InventoryScoreSnapshotRepository;
import br.com.fashionai.domain.repository.PieceUsageDiaryEntryRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeAvailabilityChangeRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Cenário fixo do Inventory Score, relativo ao dia da execução: ids {@code UUID(0xB00, n)}, criações ao meio-dia de
 * N dias atrás (a exposição em dias fica inteira), diário de uso com MANUAL/SCHEME/DAILY_LOOK, resgates, transições de
 * disponibilidade, quarto (rótulos e endereços), DNA de estilo, snapshots anteriores e modelos de desafio.
 */
final class InventoryScoreScenario {
    /** categoria, subcategoria, cor, estilos, ocasiões, dias desde o cadastro. */
    static final String[][] WARDROBE = {
            {"upper_piece", "t_shirt", "white", "basic,streetwear", "casual,work", "200"},
            {"upper_piece", "shirt", "light_blue", "classic", "work", "180"},
            {"upper_piece", "hoodie", "black", "streetwear", "casual", "160"},
            {"upper_piece", "blazer", "navy", "classic,tailored", "work,party", "150"},
            {"lower_piece", "jeans", "blue", "basic", "casual", "140"},
            {"lower_piece", "tailored_pants", "black", "classic", "work", "130"},
            {"lower_piece", "skirt", "pink", "romantic", "party", "120"},
            {"shoes_piece", "casual_sneakers", "white", "basic", "casual", "110"},
            {"shoes_piece", "oxford_shoes", "brown", "classic", "work", "100"},
            {"full_body_piece", "dress", "red", "glam", "party", "90"},
            {"accessory_piece", "handbag", "black", "classic", "", "80"},
            {"accessory_piece", "cap", "red", "streetwear", "casual", "60"},
            {"upper_piece", "jacket", "#336699", "", "", "20"},
            {"lower_piece", "shorts", "green", "sporty", "beach", "3"},
            {"upper_piece", "sweater", "grey", "basic", "casual", "50"},
    };
    /** peças, dias desde a criação, status (A = arquivado). */
    static final int[][] LOOKS = {{0, 4, 7}, {1, 5, 8}, {2, 4, 7}, {3, 5, 8, 10}, {9, 8}, {0, 6, 7}, {2, 5}, {1, 4}, {0}};
    static final int[] LOOK_AGE = {100, 60, 40, 20, 10, 5, 0, 30, 15};

    final Kit kit;
    final LocalDate today = LocalDate.now(FaiPointsService.ZONE);
    final List<WardrobeItem> pieces = new ArrayList<>();
    final List<Scheme> looks = new ArrayList<>();
    User ana;
    User bia;
    User caio;

    InventoryScoreScenario(Kit kit) {
        this.kit = kit;
    }

    static UUID id(int n) {
        return new UUID(0xB00L, n);
    }

    Instant at(int daysAgo) {
        return today.minusDays(daysAgo).atStartOfDay(FaiPointsService.ZONE).plusHours(12).toInstant();
    }

    User user(String name, int n, String country) {
        User u = Kit.user(name);
        u.assignId(id(n));
        u.markCreatedAt(at(400));
        u.setCountry(country);
        return kit.dep(UserRepository.class).save(u);
    }

    WardrobeItem piece(User owner, int n, String[] p) {
        WardrobeItem w = Kit.piece(owner, p[1].replace('_', ' ') + " " + n, p[0], p[1], p[2]);
        w.assignId(id((owner == ana ? 100 : owner == bia ? 200 : 250) + n));
        w.markCreatedAt(at(Integer.parseInt(p[5])));
        w.setStyleTags(p[3]);
        w.setOccasionTags(p[4]);
        w.setModerationStatus(n % 2 == 0 ? ModerationStatus.APPROVED : ModerationStatus.PENDING);
        w.setBrandName(n % 3 == 0 ? "Marca" + n : null);
        w.setPrice(n % 4 == 3 ? null : new BigDecimal(30 + 10 * n));
        w.setWearCount(n % 5);
        return kit.dep(WardrobeItemRepository.class).save(w);
    }

    Scheme look(User owner, int n, int age, SchemeStatus status, List<WardrobeItem> ws) {
        Scheme s = Kit.look(owner, "Look " + n);
        s.assignId(id((owner == ana ? 300 : 350) + n));
        s.markCreatedAt(at(age));
        s.setStatus(status);
        s.setStyle(n % 3 == 0 ? "classic,glam" : n % 3 == 1 ? "streetwear" : "basic,romantic");
        kit.dep(SchemeRepository.class).save(s);
        for (int i = 0; i < ws.size(); i++) {
            var item = Kit.slot(s, ws.get(i), SchemeSlot.ACCESSORY, i);
            item.assignId(id(5000 + n * 10 + i + (owner == ana ? 0 : 500)));
            kit.dep(SchemeItemRepository.class).save(item);
        }
        return s;
    }

    void use(int piece, int daysAgo, String source, Integer look, String note) {
        PieceUsageDiaryEntry e = new PieceUsageDiaryEntry();
        e.setUserId(ana.getId());
        e.setWardrobeItemId(pieces.get(piece).getId());
        e.setUsedOn(today.minusDays(daysAgo));
        e.setSource(source);
        e.setSchemeId(look == null ? null : looks.get(look).getId());
        e.setNote(note);
        kit.dep(PieceUsageDiaryEntryRepository.class).save(e);
    }

    void change(int piece, int daysAgo, boolean available) {
        WardrobeAvailabilityChange c = new WardrobeAvailabilityChange();
        c.setUserId(ana.getId());
        c.setWardrobeItemId(pieces.get(piece).getId());
        c.setAvailable(available);
        c.setChangedAt(at(daysAgo));
        kit.dep(WardrobeAvailabilityChangeRepository.class).save(c);
    }

    void snapshot(UUID user, String type, LocalDate date, Integer score, Map<String, Object> dims, Map<String, Object> metrics) {
        InventoryScoreSnapshot s = new InventoryScoreSnapshot();
        s.setUserId(user);
        s.setPeriodType(type);
        s.setPeriodDate(date);
        s.setScore(score);
        s.setEligible(true);
        s.setDimensionsJson(br.com.fashionai.application.common.Json.write(new java.util.TreeMap<>(dims)));
        s.setMetricsJson(br.com.fashionai.application.common.Json.write(new java.util.TreeMap<>(metrics)));
        kit.dep(InventoryScoreSnapshotRepository.class).save(s);
    }

    void template(String code, String dims, boolean active) {
        ChallengeTemplate t = new ChallengeTemplate();
        t.setCode(code);
        t.setName("Desafio " + code);
        t.setRuleText("regra " + code);
        t.setScoreDimensionsJson(dims);
        t.setActive(active);
        kit.dep(ChallengeTemplateRepository.class).save(t);
    }

    InventoryScoreScenario build() {
        ana = user("ana", 1, "BR");
        bia = user("bia", 2, "BR");
        caio = user("caio", 3, null);
        for (int n = 0; n < WARDROBE.length; n++) {
            pieces.add(piece(ana, n, WARDROBE[n]));
        }
        WardrobeItem first = pieces.get(0);
        first.setFlatLayMetadataJson("{\"detected\":{\"color\":\"black\",\"category\":\"upper_piece\",\"material\":null,"
                + "\"confidence\":{\"color\":0.92,\"category\":0.99,\"brand\":\"alta\"}}}");
        pieces.get(3).setModel3dUrl("/media/blazer.glb");
        pieces.get(5).setLastWornDate(today.minusDays(50));
        pieces.get(6).setFavorite(true);
        pieces.get(11).markAvailable(false);
        pieces.get(12).setDefaultImage(true);
        pieces.get(12).setMaterial(null);
        pieces.get(14).setAvailabilityStatus(AvailabilityStatus.ARCHIVED);
        for (int n = 0; n < LOOKS.length; n++) {
            List<WardrobeItem> ws = java.util.Arrays.stream(LOOKS[n]).mapToObj(pieces::get).toList();
            looks.add(look(ana, n, LOOK_AGE[n], n == 7 ? SchemeStatus.ARCHIVED : SchemeStatus.PUBLISHED, ws));
        }
        use(0, 160, "MANUAL", null, null);
        use(0, 85, "MANUAL", null, "resgate antigo");
        use(0, 10, "MANUAL", null, null);
        use(1, 55, "SCHEME", 1, null);
        use(1, 25, "SCHEME", 1, null);
        use(9, 20, "MANUAL", null, "resgate do fundo");
        use(5, 20, "SCHEME", 3, "resgate da gaveta");
        use(11, 70, "MANUAL", null, null);
        use(13, 1, "MANUAL", null, null);
        use(12, 0, "SCHEME", 6, null);
        use(6, 30, "SCHEME", null, null);
        int[][] daily = {{4, 2}, {3, 3}, {2, 4}, {1, 5}, {0, 2}};
        for (int[] d : daily) {
            for (int p : LOOKS[d[1]]) {
                use(p, d[0], "DAILY_LOOK", d[1], null);
            }
        }
        change(2, 50, false);
        change(2, 35, true);
        change(11, 40, false);
        StyleDna dna = new StyleDna();
        dna.setUser(ana);
        dna.setArchetype(StyleArchetype.values()[1]);
        dna.setSynthesizedAt(at(5));
        dna.setColorPalette("black,white,navy");
        dna.setStyleKeywords("Classic, streetwear");
        dna.setIconPieceName("blazer 3");
        kit.dep(StyleDnaRepository.class).save(dna);
        LocalDate prevMonth = today.withDayOfMonth(1).minusMonths(1);
        snapshot(ana.getId(), "MONTH", prevMonth, 400, Map.of("V", 35), Map.of("rescued", 1, "uniqueLooks", 4, "forgotten", 3));
        snapshot(ana.getId(), "DAY", today.minusDays(45), 380, Map.of("U", 40, "R", 30, "V", 20), Map.of());
        snapshot(ana.getId(), "DAY", today.minusDays(10), 420, Map.of("U", 50, "R", 35, "V", 30), Map.of());
        template("ESQUECIDAS", "[\"U\",\"R\"]", true);
        template("GAVETAS", "[\"O\"]", true);
        template("CORES", "[\"D\"]", true);
        template("ANTIGO", "[\"U\"]", false);
        template("ROTA", "[\"U\"]", true);
        for (int n = 0; n < 12; n++) {
            piece(bia, n, WARDROBE[n]);
        }
        look(bia, 0, 12, SchemeStatus.PUBLISHED, List.of());
        for (int n = 0; n < 4; n++) {
            piece(caio, n, WARDROBE[n]);
        }
        stubRoom();
        return this;
    }

    private void stubRoom() {
        RoomService room = kit.dep(RoomService.class);
        RoomLayout layout = new RoomLayout();
        when(room.layout(any())).thenReturn(layout);
        when(room.labels(any())).thenReturn(Map.of("1", "Jeans", "2", "Acessórios"));
        when(room.labelSources(any())).thenReturn(Map.of("1", "USER", "2", "DEFAULT"));
        Map<UUID, RoomService.Location> where = new LinkedHashMap<>();
        where.put(pieces.get(0).getId(), new RoomService.Location(RoomAddress.door(1, 1), "Porta 1", "m1"));
        where.put(pieces.get(4).getId(), new RoomService.Location(RoomAddress.of("drawer", 1), "Gaveta 1", "m2"));
        where.put(pieces.get(5).getId(), new RoomService.Location(RoomAddress.of("drawer", 1), "Gaveta 1", "m2"));
        where.put(pieces.get(10).getId(), new RoomService.Location(RoomAddress.of("drawer", 2), "Gaveta 2", "m2"));
        where.put(pieces.get(7).getId(), new RoomService.Location(RoomAddress.of("shoe", 0), "Sapateira", "m3"));
        where.put(pieces.get(8).getId(), new RoomService.Location(RoomAddress.of("drawer", 3), "Gaveta 3", "m2"));
        where.put(pieces.get(9).getId(), new RoomService.Location(RoomAddress.of("drawer", 2), "Gaveta 2", "m2"));
        when(room.locateAll(any())).thenReturn(where);
    }
}
