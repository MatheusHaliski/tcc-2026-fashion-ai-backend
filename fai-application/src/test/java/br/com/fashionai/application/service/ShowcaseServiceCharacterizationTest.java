package br.com.fashionai.application.service;

import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Portrait;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import org.junit.jupiter.api.Test;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.service.ShowcaseServiceCharacterizationFixture.as;
import static br.com.fashionai.application.service.ShowcaseServiceCharacterizationFixture.id;
import static br.com.fashionai.application.testkit.Portrait.attempt;

/**
 * Caracterização do {@link ShowcaseService} sobre o mundo fixo de {@link ShowcaseServiceCharacterizationFixture}: look e
 * peça no manequim, pedido de modelos 3D, fotos com o manequim (bytes por SHA-256), Passarela do dia em todos os rankings
 * e filtros (ordem exata das linhas e do lote), Eras/Coleções (lista, busca com ordenações, insights, palco), as regras
 * puras usadas pelos testes e todas as chamadas aos colaboradores. Retrato em {@code showcase/showcase-service-portrait.txt}.
 */
class ShowcaseServiceCharacterizationTest {
    private static final String GOLDEN = "/showcase/showcase-service-portrait.txt";

    private final ShowcaseServiceCharacterizationFixture w = new ShowcaseServiceCharacterizationFixture();
    private final ShowcaseService showcase = w.service;
    private final Portrait p = new Portrait(ShowcaseServiceCharacterizationFixture.PREFIX);

    private static Object slim(Object v) {
        if (v instanceof Views.SchemeView s) {
            return "look:" + s.id();
        }
        if (v instanceof Views.PieceView pv) {
            return "piece:" + pv.id();
        }
        if (v instanceof Map<?, ?> m) {
            Map<String, Object> out = new LinkedHashMap<>();
            m.forEach((k, x) -> out.put(String.valueOf(k), slim(x)));
            return out;
        }
        if (v instanceof List<?> l) {
            List<Object> out = new ArrayList<>();
            l.forEach(x -> out.add(slim(x)));
            return out;
        }
        return v;
    }

    private void add(String label, Object value) {
        p.add(label, slim(value));
    }

    private static byte[] photo(int w, int h) {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(new Color(30, 90, 160));
        g.fillRect(0, 0, w, h);
        g.setColor(Color.ORANGE);
        g.fillOval(w / 4, h / 4, w / 2, h / 2);
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            javax.imageio.ImageIO.write(img, "png", out);
        } catch (java.io.IOException e) {
            throw new java.io.UncheckedIOException(e);
        }
        return out.toByteArray();
    }

    private static ShowcaseService.RunwayFilter rf(String ranking, String region, String country, List<String> colors, List<String> occ,
                                                   List<String> styles, String sex, Integer limit, Integer offset) {
        return new ShowcaseService.RunwayFilter(ranking, region, country, colors, occ, styles, sex, limit, offset);
    }

    @Test
    void retratoDaVitrine() throws Exception {
        CurrentUser me = as(w.me);
        CurrentUser ana = as(w.ana);
        CurrentUser celeb = as(w.celeb);
        CurrentUser marca = as(w.marca);
        Scheme s1 = w.looks.get(0);
        Scheme s2 = w.looks.get(1);
        WardrobeItem p1 = w.items.get(0);
        WardrobeItem secret = w.items.get(8);

        // look e peça no manequim, modelos 3D
        add("look3d.anon", attempt(() -> showcase.look3d(null, s1.getId())));
        add("look3d.ana", attempt(() -> showcase.look3d(ana, w.looks.get(2).getId())));
        add("look3d.archived.owner", attempt(() -> showcase.look3d(me, s2.getId())));
        add("look3d.archived.other", attempt(() -> showcase.look3d(ana, s2.getId())));
        add("look3d.private", attempt(() -> showcase.look3d(ana, w.looks.get(14).getId())));
        add("look3d.celeb", attempt(() -> showcase.look3d(ana, w.looks.get(9).getId())));
        add("look3d.missing", attempt(() -> showcase.look3d(ana, id(999))));
        add("piece3d.owner", attempt(() -> showcase.piece3d(me, p1.getId())));
        add("piece3d.other", attempt(() -> showcase.piece3d(ana, w.items.get(1).getId())));
        add("piece3d.private", attempt(() -> showcase.piece3d(ana, secret.getId())));
        add("piece3d.privateOwner", attempt(() -> showcase.piece3d(me, secret.getId())));
        add("piece3d.missing", attempt(() -> showcase.piece3d(me, id(998))));
        add("requestModels.owner", attempt(() -> showcase.requestModels(me, s1.getId())));
        add("requestModels.other", attempt(() -> showcase.requestModels(ana, s1.getId())));

        // fotos com o manequim (RF4/RF5) e capa do agrupamento
        add("photo.piece", attempt(() -> showcase.pieceMannequinPhoto(me, p1.getId(), photo(900, 1200))));
        add("photo.piece.lower", attempt(() -> showcase.pieceMannequinPhoto(me, w.items.get(1).getId(), photo(10, 10))));
        add("photo.piece.other", attempt(() -> showcase.pieceMannequinPhoto(ana, p1.getId(), photo(10, 10))));
        add("photo.piece.missing", attempt(() -> showcase.pieceMannequinPhoto(me, id(997), photo(10, 10))));
        add("photo.piece.bad", attempt(() -> showcase.pieceMannequinPhoto(me, p1.getId(), new byte[]{1, 2, 3})));
        add("photo.scheme.cover", attempt(() -> showcase.schemeMannequinPhoto(me, s1.getId(), photo(2000, 1000), true)));
        add("photo.scheme", attempt(() -> showcase.schemeMannequinPhoto(ana, w.looks.get(2).getId(), photo(300, 300), false)));
        add("photo.celeb.face", attempt(() -> showcase.schemeMannequinPhoto(marca, w.looks.get(8).getId(), photo(300, 300), false)));
        add("photo.state", List.of(String.valueOf(p1.getMannequinImageUrl()), String.valueOf(p1.getMannequinImageFace()),
                String.valueOf(s1.getMannequinImageUrl()), String.valueOf(s1.getCoverImageUrl()), String.valueOf(w.looks.get(8).getMannequinImageFace())));
        add("photo.delete.piece.other", attempt(() -> {
            showcase.deleteMannequinPhoto(ana, "piece", p1.getId());
            return "ok";
        }));
        showcase.deleteMannequinPhoto(me, "piece", p1.getId());
        showcase.deleteMannequinPhoto(me, "scheme", s1.getId());
        showcase.deleteMannequinPhoto(ana, "scheme", w.looks.get(2).getId());
        add("photo.deleted", Arrays.asList(p1.getMannequinImageUrl(), p1.getMannequinImageFace(), s1.getMannequinImageUrl(), s1.getCoverImageUrl(),
                w.looks.get(2).getMannequinImageUrl(), w.looks.get(2).getCoverImageUrl()));
        add("cover.owner", attempt(() -> showcase.groupingCover(celeb, w.groups.get(0).getId(), photo(2400, 900))));
        add("cover.other", attempt(() -> showcase.groupingCover(me, w.groups.get(0).getId(), photo(10, 10))));
        add("cover.missing", attempt(() -> showcase.groupingCover(me, id(996), photo(10, 10))));
        add("media", w.stored);

        // Passarela 3D
        add("runway.limit", showcase.runway(me, (Integer) null));
        add("runway.anon", showcase.runway(null, 3));
        for (String ranking : ShowcaseService.RUNWAY_RANKINGS) {
            add("runway." + ranking + ".me", attempt(() -> showcase.runway(me, rf(ranking, null, null, null, null, null, null, 30, null))));
            add("runway." + ranking + ".anon", attempt(() -> showcase.runway(null, rf(ranking.toLowerCase(), "", " ", List.of(), List.of(), List.of(), "", 2, 1))));
        }
        add("runway.region", showcase.runway(ana, rf("top100_regional", "europa", null, null, null, null, null, 5, 0)));
        add("runway.country", showcase.runway(ana, rf("TOP100_PAIS", null, "jp", null, null, null, null, 5, 0)));
        add("runway.colors", showcase.runway(me, rf(null, null, null, List.of("Azul", "Vermelho"), null, null, null, 12, 0)));
        add("runway.occasions", showcase.runway(me, rf(null, null, null, null, List.of("party"), List.of("street"), "masculino", 12, -4)));
        add("runway.batch", showcase.runway(me, rf("RECENTES", null, null, null, null, null, null, 1, 2)));
        add("runway.bigBatch", showcase.runway(me, rf("EM_ALTA", null, null, null, null, null, null, 500, 0)));
        add("runway.bad", attempt(() -> showcase.runway(me, rf("NADA", null, null, null, null, null, null, 6, 0))));

        // Eras e Coleções
        for (CurrentUser viewer : Arrays.asList(null, ana, celeb)) {
            String who = viewer == null ? "anon" : viewer.username();
            add("eras.list." + who, attempt(() -> showcase.list(viewer, "estrela", ShowcaseService.Kind.ERAS)));
            add("eras.insights." + who, attempt(() -> showcase.insights(viewer, "estrela", ShowcaseService.Kind.ERAS)));
            add("eras.stage." + who, attempt(() -> showcase.stage(viewer, "estrela", null)));
            for (String sort : List.of("HYPE", "GROWTH", "CURTIDAS", "RECENTES", "likes", "em_crescimento", "recent", "outra")) {
                add("eras.items." + who + "." + sort, attempt(() -> showcase.items(viewer, "estrela", ShowcaseService.Kind.ERAS, null, null, null, sort, null)));
            }
        }
        UUID era = w.groups.get(0).getId();
        add("eras.items.era", showcase.items(ana, "estrela", ShowcaseService.Kind.ERAS, era, null, "TODOS", null, null));
        add("eras.items.year", showcase.items(ana, "estrela", ShowcaseService.Kind.ERAS, null, null, null, null, 2012));
        add("eras.items.year2016", showcase.items(ana, "estrela", ShowcaseService.Kind.ERAS, null, null, "pecas", "HYPE", 2016));
        add("eras.items.q", showcase.items(ana, "estrela", ShowcaseService.Kind.ERAS, null, " SHOW ", "esquemas", null, null));
        add("eras.items.qPiece", showcase.items(ana, "estrela", ShowcaseService.Kind.ERAS, null, "marca luva", null, null, null));
        add("eras.items.yearEra", showcase.items(ana, "estrela", ShowcaseService.Kind.ERAS, era, null, null, null, 2020));
        add("eras.items.missing", attempt(() -> showcase.items(ana, "estrela", ShowcaseService.Kind.ERAS, id(995), null, null, null, null)));
        add("eras.stage.scheme", attempt(() -> showcase.stage(ana, "estrela", w.looks.get(9).getId())));
        add("eras.stage.missing", attempt(() -> showcase.stage(ana, "estrela", w.looks.get(0).getId())));
        add("eras.stage.empty", attempt(() -> showcase.stage(null, "quieta", null)));
        add("eras.list.empty", attempt(() -> showcase.list(null, "quieta", ShowcaseService.Kind.ERAS)));
        add("eras.insights.empty", attempt(() -> showcase.insights(null, "quieta", ShowcaseService.Kind.ERAS)));
        add("eras.wrongKind", attempt(() -> showcase.list(null, "marcax", ShowcaseService.Kind.ERAS)));
        add("eras.stage.wrongKind", attempt(() -> showcase.stage(null, "marcax", null)));
        add("col.wrongKind", attempt(() -> showcase.list(null, "estrela", ShowcaseService.Kind.COLLECTIONS)));
        add("col.missingSlug", attempt(() -> showcase.list(null, "ninguem", ShowcaseService.Kind.COLLECTIONS)));
        for (CurrentUser viewer : Arrays.asList(null, marca)) {
            String who = viewer == null ? "anon" : viewer.username();
            add("col.list." + who, showcase.list(viewer, "marcax", ShowcaseService.Kind.COLLECTIONS));
            add("col.insights." + who, showcase.insights(viewer, "marcax", ShowcaseService.Kind.COLLECTIONS));
            add("col.items." + who, showcase.items(viewer, "marcax", ShowcaseService.Kind.COLLECTIONS, null, null, null, "growth", null));
        }
        add("col.items.missing", attempt(() -> showcase.items(null, "marcax", ShowcaseService.Kind.COLLECTIONS, era, null, null, null, null)));

        rules(me);
        for (String name : List.of("schemes", "schemeItems", "pieces", "groupings", "dailyLooks", "dailyLookService", "preferences", "celebrities",
                "schemeService", "institutional", "model3d", "guard", "avatars3d", "users", "follows", "hype")) {
            p.invocations(name, ShowcaseServiceCharacterizationFixture.class.getDeclaredField(name).get(w));
        }
        p.verify(ShowcaseServiceCharacterizationTest.class, GOLDEN);
    }

    private void rules(CurrentUser me) {
        add("rules.kind", Arrays.asList(ShowcaseService.kind("eras"), ShowcaseService.kind("Collections"), ShowcaseService.kind("COLECOES"),
                attempt(() -> ShowcaseService.kind(null)), attempt(() -> ShowcaseService.kind("nada"))));
        add("rules.period", w.groups.stream().map(ShowcaseGroupings::period).map(String::valueOf).toList());
        add("rules.count", Arrays.asList(ShowcaseRunwayOrder.count(List.of("b", "a", "b", "c", "a", "b")), ShowcaseRunwayOrder.count(List.of())));
        add("rules.constants", List.of(ShowcaseService.RUNWAY_RANKINGS, ShowcaseService.SHOWCASE_SORTS, ShowcaseService.RUNWAY_MAX,
                ShowcaseService.RUNWAY_TOP, ShowcaseService.W_LIKES, ShowcaseService.W_ITEMS, ShowcaseService.ERA_TYPES,
                ShowcaseService.COLLECTION_TYPES, ShowcaseService.MANNEQUIN_PHOTO_CATEGORIES));
        add("rules.piece", w.items.stream().map(ShowcaseMannequin::piece).toList());
        add("rules.mannequin", List.of(showcase.mannequins.mannequin(w.me, List.of()), showcase.mannequins.mannequin(w.quiet, w.items.subList(0, 3)),
                showcase.mannequins.mannequin(w.quiet, w.items.subList(1, 3)), showcase.mannequins.mannequin(w.marca, List.of(), me),
                showcase.mannequins.mannequin(w.celeb, List.of(), null), showcase.mannequins.mannequin(w.me, List.of(), me),
                showcase.mannequins.mannequin(w.rui, w.items.subList(2, 3), me)));
        add("rules.look", List.of(showcase.mannequins.look(w.looks.get(3), null), showcase.mannequins.look(w.looks.get(3), as(w.rui)),
                showcase.mannequins.look(w.looks.get(7), as(w.looks.get(7).getUser()), null)));
        add("rules.hypeOf", showcase.hypeOf(HypeEntityType.SCHEME, w.looks.stream().map(Scheme::getId).toList()).keySet().stream().sorted().toList());
        List<Object> entries = new ArrayList<>();
        for (DailyLook dl : w.daily) {
            ShowcaseService.RunwayEntry e = showcase.runwayFlow.entry(dl);
            entries.add(Arrays.asList(e.dl(), e.country(), e.region(), e.colors(), e.occasions(), e.styles(), e.sex()));
        }
        add("rules.entry", entries);
        List<ShowcaseService.RunwayEntry> pool = w.daily.stream().map(showcase.runwayFlow::entry).toList();
        Map<UUID, HypeScoreCurrent> hype = showcase.hypeOf(HypeEntityType.SCHEME, w.looks.stream().map(Scheme::getId).toList());
        for (String ranking : List.of("TOP100_GLOBAL", "EM_ALTA", "RECENTES", "SEGUINDO")) {
            add("rules.runwayOrder." + ranking, pool.stream().sorted(ShowcaseRunwayOrder.runwayOrder(ranking, e -> hype.get(e.dl().getScheme().getId())))
                    .map(e -> e.dl().getScheme()).toList());
        }
        for (String sort : Arrays.asList(null, "HYPE", "GROWTH", "CURTIDAS", "RECENTES", "x")) {
            for (boolean self : List.of(false, true)) {
                Comparator<Scheme> c = ShowcaseGroupingItems.order(sort, s -> hype.get(s.getId()), self, Scheme::getLikeCount, Scheme::getCreatedAt);
                add("rules.order." + sort + "." + self, w.looks.stream().sorted(c).toList());
            }
        }
        List<HypeScoreCurrent> group = new ArrayList<>(w.rows.subList(5, 9));
        group.add(null);
        add("rules.groupHype", List.of(ShowcaseInsights.groupHype(group, false, null), ShowcaseInsights.groupHype(group, true, HypeScoreConfig.defaults()),
                ShowcaseInsights.groupHype(List.of(), false, null)));
    }
}
