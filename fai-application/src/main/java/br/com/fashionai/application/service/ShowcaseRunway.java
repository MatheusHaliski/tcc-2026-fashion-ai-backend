package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.ShowcaseService.RunwayEntry;
import br.com.fashionai.application.service.ShowcaseService.RunwayFilter;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.taxonomy.WorldRegions;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.FollowStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.repository.DailyLookRepository;
import br.com.fashionai.domain.repository.FollowRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.UserRepository;

import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import static br.com.fashionai.application.service.ShowcaseService.RUNWAY_MAX;
import static br.com.fashionai.application.service.ShowcaseService.RUNWAY_RANKINGS;
import static br.com.fashionai.application.service.ShowcaseService.RUNWAY_TOP;

/**
 * Passarela 3D do Explorar: o desfile do dia com o Look do Dia de cada perfil visível (escopo do ranking, facetas,
 * filtros, tabela até o Top 100 e o lote de looks no manequim).
 */
final class ShowcaseRunway {
    private final SchemeItemRepository schemeItems;
    private final DailyLookRepository dailyLooks;
    private final DailyLookService dailyLookService;
    private final UserRepository users;
    private final FollowRepository follows;
    private final SchemeService schemeService;
    private final ShowcaseMannequin mannequins;
    private final ShowcaseHype hypes;
    private final HypeScoreConfig hypeConfig;

    ShowcaseRunway(SchemeItemRepository schemeItems, DailyLookRepository dailyLooks, DailyLookService dailyLookService,
                   UserRepository users, FollowRepository follows, SchemeService schemeService, ShowcaseMannequin mannequins,
                   ShowcaseHype hypes, HypeScoreConfig hypeConfig) {
        this.schemeItems = schemeItems;
        this.dailyLooks = dailyLooks;
        this.dailyLookService = dailyLookService;
        this.users = users;
        this.follows = follows;
        this.schemeService = schemeService;
        this.mannequins = mannequins;
        this.hypes = hypes;
        this.hypeConfig = hypeConfig;
    }

    RunwayEntry entry(DailyLook dl) {
        Scheme s = dl.getScheme();
        List<WardrobeItem> ws = schemeItems.findBySchemeIdOrderBySortOrder(s.getId()).stream().map(SchemeItem::getWardrobeItem).filter(Objects::nonNull).toList();
        Set<String> colors = new java.util.TreeSet<>(), occ = new java.util.TreeSet<>(), styles = new java.util.TreeSet<>();
        for (WardrobeItem w : ws) {
            if (w.getColor() != null) {
                colors.add(Taxonomy.COLOR_FAMILY.getOrDefault(w.getColor(), w.getColor()));
            }
            occ.addAll(Json.csv(w.getOccasionTags()));
            styles.addAll(Json.csv(w.getStyleTags()));
        }
        occ.addAll(Json.csv(s.getOccasion()));
        styles.addAll(Json.csv(s.getStyle()));
        User u = dl.getUser();
        String country = u.getCountry() == null ? null : u.getCountry().toUpperCase(Locale.ROOT);
        return new RunwayEntry(dl, country, WorldRegions.of(country), colors, occ, styles, u.getSex() == null ? null : u.getSex().name());
    }

    /**
     * O desfile do dia: o Look do Dia de hoje de cada perfil visível. Quem registrou look na última semana e não trocou
     * hoje continua desfilando com o último (mesma virada de dia do RF6). Rankings: Top 100 Global (HypeScore v2 público;
     * sem Hype público = no fim), Top 100 Regional (região do mundo), Top 100 do país, Seguindo, Em alta (crescimento:
     * momento RISING/EMERGING e dimensão TREND do v2 — não curtidas) e Recentes; filtros por região, cores, ocasiões,
     * estilos e manequim. Cada linha da tabela e cada look trazem {@code hype} (resumo v2). Como seria inviável desfilar todo mundo, a passarela 3D mostra um lote de até 24
     * looks por vez ({@code limit}/{@code offset}) e a tabela lateral vai até o Top 100.
     */
    Map<String, Object> runway(CurrentUser viewer, RunwayFilter f) {
        LocalDate today = LocalDate.now(FaiPointsService.ZONE);
        Set<UUID> recent = new LinkedHashSet<>();
        for (DailyLook dl : dailyLooks.findByLookDateGreaterThanEqual(today.minusDays(7))) {
            recent.add(dl.getUser().getId());
        }
        recent.forEach(dailyLookService::today);
        int max = Math.max(1, Math.min(RUNWAY_MAX, f.limit() == null ? 12 : f.limit()));
        int offset = Math.max(0, f.offset() == null ? 0 : f.offset());
        String ranking = f.ranking() == null || f.ranking().isBlank() ? "TOP100_GLOBAL" : f.ranking().toUpperCase(Locale.ROOT);
        if (!RUNWAY_RANKINGS.contains(ranking)) {
            throw ApiException.badRequest("RANKING_INVALIDO", "Rankings: " + RUNWAY_RANKINGS);
        }
        User me = viewer == null ? null : users.findById(viewer.id()).orElse(null);
        List<RunwayEntry> pool = dailyLooks.findByLookDate(today).stream()
                .filter(dl -> dl.getUser().getStatus() == AccountStatus.ACTIVE && !dl.getUser().isRunwayOptOut() && SearchVisibility.showcaseAllows(viewer, dl.getUser()))
                .filter(dl -> dl.getScheme().getStatus() != SchemeStatus.ARCHIVED && schemeService.canView(viewer, dl.getScheme()))
                .map(this::entry).toList();

        // escopo do ranking
        String region = f.region() == null || f.region().isBlank() ? null : f.region().toUpperCase(Locale.ROOT);
        String country = f.country() == null || f.country().isBlank() ? null : f.country().toUpperCase(Locale.ROOT);
        if ("TOP100_REGIONAL".equals(ranking) && region == null) {
            region = me == null ? "AMERICA_DO_SUL" : WorldRegions.of(me.getCountry());
        }
        if ("TOP100_PAIS".equals(ranking) && country == null) {
            country = me == null || me.getCountry() == null ? "BR" : me.getCountry().toUpperCase(Locale.ROOT);
        }
        Set<UUID> following = new HashSet<>();
        if ("SEGUINDO".equals(ranking)) {
            if (viewer == null) {
                throw ApiException.unauthorized(Msg.t("showcase.entre_na_conta_para_ver"));
            }
            follows.findByFollowerIdAndStatus(viewer.id(), FollowStatus.ACEITO).forEach(x -> following.add(x.getFollowing().getId()));
            following.add(viewer.id());
        }
        final String fr = region, fc = country;
        List<RunwayEntry> scoped = pool.stream()
                .filter(e -> fr == null || fr.equals(e.region()))
                .filter(e -> fc == null || fc.equals(e.country()))
                .filter(e -> following.isEmpty() || following.contains(e.dl().getUser().getId()))
                .toList();
        // facetas (contagens do escopo, antes dos filtros de cor/ocasião/estilo)
        Map<String, Object> facets = new LinkedHashMap<>();
        facets.put("regions", WorldRegions.codes().stream().map(c -> Map.of("code", c, "label", WorldRegions.label(c), "count", pool.stream().filter(e -> c.equals(e.region())).count()))
                .filter(m -> ((Long) m.get("count")) > 0 || "AMERICA_DO_SUL".equals(m.get("code"))).toList());
        facets.put("countries", ShowcaseRunwayOrder.count(scoped.stream().map(RunwayEntry::country).filter(Objects::nonNull).toList()));
        facets.put("colors", ShowcaseRunwayOrder.count(scoped.stream().flatMap(e -> e.colors().stream()).toList()));
        facets.put("occasions", ShowcaseRunwayOrder.count(scoped.stream().flatMap(e -> e.occasions().stream()).toList()));
        facets.put("styles", ShowcaseRunwayOrder.count(scoped.stream().flatMap(e -> e.styles().stream()).toList()));
        // filtros
        List<String> colors = f.colors() == null ? List.of() : f.colors(), occ = f.occasions() == null ? List.of() : f.occasions(),
                styles = f.styles() == null ? List.of() : f.styles();
        String sex = f.sex() == null || f.sex().isBlank() ? null : f.sex().toUpperCase(Locale.ROOT);
        // HypeScore v2 do pool inteiro numa consulta; a ORDEM usa só o Hype público (é um ranking compartilhado)
        Map<UUID, HypeScoreCurrent> hype = hypes.of(HypeEntityType.SCHEME, pool.stream().map(e -> e.dl().getScheme().getId()).toList());
        Comparator<RunwayEntry> order = ShowcaseRunwayOrder.runwayOrder(ranking, e -> hype.get(e.dl().getScheme().getId()));
        List<RunwayEntry> ranked = scoped.stream()
                .filter(e -> colors.isEmpty() || colors.stream().anyMatch(e.colors()::contains))
                .filter(e -> occ.isEmpty() || occ.stream().anyMatch(e.occasions()::contains))
                .filter(e -> styles.isEmpty() || styles.stream().anyMatch(e.styles()::contains))
                .filter(e -> sex == null || sex.equals(e.sex()))
                .sorted(order).limit(RUNWAY_TOP).toList();

        Integer yourPosition = null;
        List<Map<String, Object>> table = new ArrayList<>();
        for (int i = 0; i < ranked.size(); i++) {
            RunwayEntry e = ranked.get(i);
            boolean you = viewer != null && viewer.id().equals(e.dl().getUser().getId());
            if (you) {
                yourPosition = i + 1;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("position", i + 1);
            row.put("schemeId", e.dl().getScheme().getId());
            row.put("title", e.dl().getScheme().getTitle());
            row.put("owner", Views.user(e.dl().getUser()));
            row.put("hype", SearchHype.hypeSummary(hype.get(e.dl().getScheme().getId()), you, hypeConfig));
            row.put("likes", e.dl().getScheme().getLikeCount());       // popularidade, exibida à parte
            row.put("country", e.country());
            row.put("region", WorldRegions.label(e.region()));
            row.put("you", you);
            table.add(row);
        }
        List<Map<String, Object>> looks = new ArrayList<>();
        for (int i = offset; i < Math.min(ranked.size(), offset + max); i++) {
            RunwayEntry e = ranked.get(i);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("position", i + 1);
            m.put("you", viewer != null && viewer.id().equals(e.dl().getUser().getId()));
            m.put("source", e.dl().getSource().name());
            m.put("carriedOver", e.dl().getMaterializedFrom() != null);
            m.put("country", e.country());
            m.put("region", WorldRegions.label(e.region()));
            m.put("look", mannequins.look(e.dl().getScheme(), viewer, hype.get(e.dl().getScheme().getId())));
            looks.add(m);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("date", today);
        out.put("nextUpdate", ZonedDateTime.now(FaiPointsService.ZONE).toLocalDate().plusDays(1).atStartOfDay(FaiPointsService.ZONE).toInstant());
        out.put("totalToday", pool.size());
        out.put("total", ranked.size());
        out.put("ranking", ranking);
        out.put("rankings", RUNWAY_RANKINGS);
        out.put("algorithmVersion", hypeConfig == null ? null : hypeConfig.algorithmVersion());
        out.put("applied", Map.of("region", region == null ? "" : region, "country", country == null ? "" : country, "colors", colors, "occasions", occ, "styles", styles,
                "sex", sex == null ? "" : sex));
        out.put("batch", Map.of("offset", offset, "limit", max, "from", ranked.isEmpty() ? 0 : offset + 1, "to", Math.min(ranked.size(), offset + max),
                "hasNext", offset + max < ranked.size(), "hasPrev", offset > 0));
        out.put("looks", looks);
        out.put("table", table);
        out.put("facets", facets);
        if (viewer != null) {
            Map<String, Object> you = new LinkedHashMap<>();
            you.put("optedOut", me != null && me.isRunwayOptOut());
            you.put("hasLook", dailyLooks.findByUserIdAndLookDate(viewer.id(), today).isPresent());
            you.put("position", yourPosition);
            you.put("region", me == null ? null : WorldRegions.of(me.getCountry()));
            you.put("country", me == null ? null : me.getCountry());
            out.put("you", you);
        }
        return out;
    }
}
