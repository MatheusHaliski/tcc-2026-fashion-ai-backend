package br.com.fashionai.application.service;

import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Portrait;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static br.com.fashionai.application.service.SearchServiceCharacterizationFixture.as;
import static br.com.fashionai.application.service.SearchServiceCharacterizationFixture.id;
import static br.com.fashionai.application.testkit.Portrait.attempt;

/**
 * Caracterização do {@link SearchService} sobre o mundo fixo de {@link SearchServiceCharacterizationFixture}: feed
 * comunitário (filtros, faixa mínima, cursor), The Runway (timeline, vínculos de marca, fallback), busca segmentada nas
 * cinco abas (índice ligado e desligado, cursor, sugestões da busca vazia), Peças Públicas, as regras puras usadas pelos
 * testes e todas as chamadas aos repositórios. Ordem dos resultados exata; cursores decodificados com o instante como
 * minutos antes da base do mundo. Retrato em {@code search/search-service-portrait.txt}.
 */
class SearchServiceCharacterizationTest {
    private static final String GOLDEN = "/search/search-service-portrait.txt";

    private final SearchServiceCharacterizationFixture w = new SearchServiceCharacterizationFixture();
    private final SearchService search = w.service;
    private final Portrait p = new Portrait(SearchServiceCharacterizationFixture.PREFIX);

    /** Views viram {@code tipo:id}; cursores de instante viram {@code cursor(-Nmin|id)}; o resto fica como está. */
    private Object slim(Object v) {
        if (v instanceof Views.SchemeView s) {
            return "look:" + s.id();
        }
        if (v instanceof Views.PieceView pv) {
            return "piece:" + pv.id();
        }
        if (v instanceof Map<?, ?> m) {
            Map<String, Object> out = new LinkedHashMap<>();
            m.forEach((k, x) -> out.put(String.valueOf(k), "nextCursor".equals(k) ? cursor((String) x) : slim(x)));
            return out;
        }
        if (v instanceof List<?> l) {
            List<Object> out = new ArrayList<>();
            l.forEach(x -> out.add(slim(x)));
            return out;
        }
        if (v instanceof Instant t) {
            return w.label(t);
        }
        return v;
    }

    private String cursor(String raw) {
        if (raw == null) {
            return null;
        }
        String[] parts = new String(Base64.getUrlDecoder().decode(raw), StandardCharsets.UTF_8).split("\\|");
        return parts.length == 2 ? "cursor(" + w.label(Instant.parse(parts[0])) + "|" + parts[1] + ")" : "offset(" + parts[0] + ")";
    }

    private void add(String label, Object value) {
        p.add(label, slim(value));
    }

    private static SearchService.Filters f(String style, String occasion, String color, String brand, String category, String level) {
        return new SearchService.Filters(style, occasion, color, brand, category, level);
    }

    @Test
    void retratoDaBusca() throws Exception {
        CurrentUser me = as(w.me);
        CurrentUser ana = as(w.ana);
        CurrentUser tester = as(w.bia);

        // feed comunitário
        add("feed.anon", search.communityFeed(null, null, 0, null));
        add("feed.me", search.communityFeed(me, null, 20, f(null, null, null, null, null, null)));
        Map<String, Object> page1 = search.communityFeed(me, null, 3, null);
        add("feed.page1", page1);
        add("feed.page2", search.communityFeed(me, (String) page1.get("nextCursor"), 3, null));
        add("feed.tester", search.communityFeed(tester, null, 100, null));
        add("feed.style", search.communityFeed(me, null, 10, f("casual", null, null, null, null, null)));
        add("feed.color", search.communityFeed(me, null, 10, f(null, null, "black", null, null, null)));
        add("feed.brand", search.communityFeed(null, null, 10, f(null, "work", null, "NIKE", "upper_piece", null)));
        add("feed.level", search.communityFeed(me, null, 10, f(null, null, null, null, null, "relevant")));
        add("feed.levelHot", search.communityFeed(null, null, 2, f(null, null, null, null, null, " hot ")));
        add("feed.badLevel", attempt(() -> search.communityFeed(null, null, 10, f(null, null, null, null, null, "ESTILOSO"))));
        add("feed.badCursor", attempt(() -> search.communityFeed(null, "%%%", 10, null)));

        // The Runway (Seguindo)
        add("runway.me", search.runway(me, null, 0));
        Map<String, Object> r1 = search.runway(me, null, 2);
        add("runway.page1", r1);
        add("runway.page2", search.runway(me, (String) r1.get("nextCursor"), 2));
        add("runway.fallback", search.runway(ana, null, 5));
        w.timelineAvailable = w.timeline;
        add("runway.timeline", search.runway(me, null, 10));
        w.timelineAvailable = null;

        // busca segmentada
        add("search.looks", search.search(null, null, null, null, 0));
        add("search.looks.me", search.search(me, "", "looks", f("casual", null, null, null, null, null), 10));
        add("search.looks.term", search.search(me, "  Fe<b>sta</b> ", "LOOKS", null, 10));
        Map<String, Object> l1 = search.search(me, "", "LOOKS", null, 2, null);
        add("search.looks.page1", l1);
        add("search.looks.page2", search.search(me, "", "LOOKS", null, 2, (String) l1.get("nextCursor")));
        add("search.looks.level", search.search(null, "", "LOOKS", f(null, null, null, null, null, "HOT"), 10, null));
        add("search.looks.color", search.search(null, "", "LOOKS", f(null, null, "black", "zara", "full_body_piece", null), 10, null));
        add("search.pecas", search.search(me, "", "PECAS", null, 30));
        add("search.pecas.term", search.search(me, "nike", "PECAS", f(null, "work", null, null, null, null), 30));
        add("search.pecas.level", search.search(null, "", "PECAS", f(null, null, null, null, null, "NICHE"), 30, null));
        add("search.pessoas", search.search(me, "a", "PESSOAS", null, 10));
        add("search.pessoas.anon", search.search(null, "", "pessoas", null, 10));
        add("search.pessoas.empty", search.search(me, "zzz", "PESSOAS", null, 10));
        add("search.marcas", search.search(null, "", "MARCAS", null, 3));
        add("search.marcas.term", search.search(null, "NIKE", "MARCAS", null, 10));
        add("search.celebs", search.search(null, "", "CELEBRIDADES", null, 10));
        add("search.celebs.term", search.search(null, "estrela", "CELEBRIDADES", null, 10));
        add("search.empty.alts", search.search(me, "casul", "LOOKS", null, 10));
        add("search.empty.freq", search.search(me, "xyzw", "PECAS", null, 10));
        add("search.empty.page", search.search(me, "xyzw", "LOOKS", null, 10, SearchService.encodeOffset(5)));
        add("search.badTab", attempt(() -> search.search(null, "", "VIDEOS", null, 10)));
        add("search.badCursor", attempt(() -> search.search(null, "", "LOOKS", null, 10, "%%%")));
        add("search.badLevel", attempt(() -> search.search(null, "", "LOOKS", f(null, null, null, null, null, "X"), 10, null)));
        w.indexAvailable = w.index;
        add("search.index.looks", search.search(me, "festa", "LOOKS", null, 10));
        add("search.index.pecas", search.search(me, "jaqueta", "PECAS", null, 10));
        add("search.index.empty", search.search(me, "", "LOOKS", null, 1));
        w.indexAvailable = null;

        // Peças Públicas
        add("pieces.anon", search.publicPieces(null, null, null, 0));
        Map<String, Object> pp1 = search.publicPieces(me, null, null, 2);
        add("pieces.page1", pp1);
        add("pieces.page2", search.publicPieces(me, null, (String) pp1.get("nextCursor"), 2));
        add("pieces.filters", search.publicPieces(me, f("casual", null, "blue", "nike", null, null), null, 30));
        add("pieces.level", search.publicPieces(null, f(null, null, null, null, null, "low_signal"), null, 30));

        rules();
        p.invocations("schemes", w.schemes);
        p.invocations("pieces", w.pieces);
        p.invocations("shares", w.shares);
        p.invocations("follows", w.follows);
        p.invocations("users", w.users);
        p.invocations("bonds", w.bonds);
        p.invocations("brands", w.brands);
        p.invocations("catalog", w.catalog);
        p.invocations("celebrities", w.celebrities);
        p.invocations("dnas", w.dnas);
        p.invocations("hype", w.hype);
        p.invocations("index", w.index);
        p.invocations("timeline", w.timeline);
        p.invocations("challenges", w.challenges);
        p.verify(SearchServiceCharacterizationTest.class, GOLDEN);
    }

    private void rules() {
        Scheme s1 = w.looks.get(0);
        Scheme s6 = w.looks.get(5);
        WardrobeItem p1 = w.items.get(0);
        add("rules.visible", List.of(search.visible(null, s1, Set.of()), search.visible(null, s1, Set.of(w.ana.getId())),
                search.visible(null, w.looks.get(2), Set.of()), search.visible(as(w.bia), w.looks.get(2), Set.of()),
                search.visible(null, w.looks.get(6), Set.of()), search.visible(null, w.looks.get(7), Set.of()),
                search.visible(as(w.ana), w.looks.get(7), Set.of()), search.visible(null, p1, Set.of()),
                search.visible(null, w.items.get(5), Set.of()), search.visible(null, w.items.get(6), Set.of())));
        add("rules.showcaseAllows", List.of(SearchService.showcaseAllows(null, w.bia), SearchService.showcaseAllows(as(w.bia), w.bia),
                SearchService.showcaseAllows(null, w.ana)));
        add("rules.blockedFor", List.of(search.blockedFor(null), search.blockedFor(w.me.getId())));
        add("rules.dnaStyles", List.of(search.dnaStyles(null), search.dnaStyles(w.me.getId()), search.dnaStyles(w.ana.getId())));
        add("rules.sharerVisible", List.of(search.sharerVisible(null, null, Set.of()), search.sharerVisible(null, w.duda, Set.of()),
                search.sharerVisible(null, w.ana, Set.of(w.ana.getId())), search.sharerVisible(null, w.ana, Set.of())));
        SearchService.Filters all = f("casual", "work", "blue", "nike", "upper_piece", " hot ");
        add("rules.filters", List.of(all.empty(), all.chips(), f(null, " ", null, null, null, "HOT").empty(),
                new SearchService.Filters(null, null, null, null, null).chips()));
        List<Boolean> matches = new ArrayList<>();
        for (SearchService.Filters x : Arrays.asList(null, all, f("casual", null, null, null, null, null), f(null, "work", null, null, null, null),
                f(null, null, "blue", null, null, null), f(null, null, null, "NIKE", null, null), f(null, null, null, null, "upper_piece", null),
                f("party", null, null, null, null, null), f(null, null, "red", null, null, null), f(null, null, null, "Zara", null, null),
                f(null, null, null, null, "footwear", null), f(null, "party", null, null, null, null))) {
            matches.add(SearchService.matches(x, s1, w.itemsByScheme.get(s1.getId())));
            matches.add(SearchService.matches(x, p1));
        }
        add("rules.matches", matches);
        add("rules.relevance", List.of(SearchService.relevance(s1, List.of(), Set.of(), 80.0), SearchService.relevance(s1, List.of(), Set.of(), null),
                SearchService.relevance(s6, List.of(), Set.of("party"), 140.0), SearchService.relevance(s6, List.of(), Set.of("party", "x"), -3.0),
                SearchService.relevance(w.hoursAgo(-5), List.of("a"), Set.of("a"), 50.0)));
        Scheme draft = new Scheme();
        draft.markCreatedAt(SearchServiceCharacterizationFixture.T0);
        p.add("rules.publishedAt", List.of(SearchService.publishedAt(draft), w.label(SearchService.publishedAt(s1))));
        HypeScoreCurrent pub = w.rows.get(0);
        HypeScoreCurrent personal = w.rows.get(2);
        HypeScoreCurrent rising = w.rows.get(3);
        HypeScoreCurrent noScore = new HypeScoreCurrent();
        noScore.setStatus(br.com.fashionai.domain.model.enums.HypeStatus.INSUFFICIENT_DATA);
        noScore.setPublicEligible(true);
        noScore.setCalculatedAt(SearchServiceCharacterizationFixture.T0);
        List<Object> hype = new ArrayList<>();
        for (HypeScoreCurrent c : Arrays.asList(null, pub, personal, rising, noScore)) {
            hype.add(Arrays.asList(SearchService.publicRow(c) != null, SearchService.publicScore(c), SearchService.scoreFor(c, true),
                    SearchService.scoreFor(c, false), SearchService.trendFor(c, true), SearchService.growthFor(c, true),
                    SearchService.growthFor(c, false), SearchService.risingFor(c, false), SearchService.risingFor(c, true),
                    SearchService.meetsLevel(c, null, null), SearchService.meetsLevel(c, HypeLevel.HOT, HypeScoreConfig.defaults()),
                    SearchService.meetsLevel(c, HypeLevel.RELEVANT, null), SearchService.hypeSummary(c, false, null),
                    SearchService.hypeSummary(c, true, HypeScoreConfig.defaults())));
        }
        add("rules.hype", hype);
        List<Object> levels = new ArrayList<>();
        for (HypeLevel l : HypeLevel.values()) {
            levels.add(List.of(l, SearchService.levelMinimum(null, l), SearchService.levelMinimum(HypeScoreConfig.defaults(), l)));
        }
        levels.add(SearchService.levelMinimum(null, null));
        levels.add(Arrays.asList(SearchService.parseLevel(null), SearchService.parseLevel(" "), SearchService.parseLevel(" viral ")));
        levels.add(attempt(() -> SearchService.parseLevel("nada")));
        add("rules.levels", levels);
        add("rules.round1", List.of(SearchService.round1(1.25), SearchService.round1(-1.25), SearchService.round1(59.95)));
        add("rules.hypeRows", List.of(SearchService.hypeRows(null, null, HypeEntityType.SCHEME, List.of(s1.getId())).size(),
                SearchService.hypeRows(w.hype, HypeScoreConfig.defaults(), HypeEntityType.SCHEME, Arrays.asList(null, null)).size(),
                SearchService.hypeRows(w.hype, HypeScoreConfig.defaults(), HypeEntityType.SCHEME, List.of(s1.getId(), s1.getId(), s6.getId())).keySet()
                        .stream().sorted().toList(),
                search.hypeRows(HypeEntityType.PIECE, List.of(p1.getId(), id(999))).keySet()));
        SearchService.Cursor c = new SearchService.Cursor(SearchServiceCharacterizationFixture.T0, id(7));
        add("rules.cursor", Arrays.asList(c.encode(), String.valueOf(SearchService.Cursor.parse(c.encode())), SearchService.Cursor.parse(null) == null,
                SearchService.Cursor.parse(" ") == null,
                c.before(SearchServiceCharacterizationFixture.T0, id(6)), c.before(SearchServiceCharacterizationFixture.T0, id(8)),
                c.before(SearchServiceCharacterizationFixture.T0.minusSeconds(1), id(9)), attempt(() -> SearchService.Cursor.parse("bm9wZQ"))));
        add("rules.offset", Arrays.asList(SearchService.encodeOffset(30), SearchService.offsetOf(SearchService.encodeOffset(30)), SearchService.offsetOf(null),
                SearchService.offsetOf(SearchService.encodeOffset(50_000)), SearchService.offsetOf(c.encode()),
                attempt(() -> SearchService.offsetOf("%%%")), SearchService.TABS, SearchService.NEUTRAL_HYPE, SearchService.TRENDING_POOL));
        add("rules.alternatives", List.of(search.alternatives(""), search.alternatives("casul"), search.alternatives("nik"), search.alternatives("partyy")));
        add("rules.personProfiles", search.personProfiles(null, List.of()));
    }
}
