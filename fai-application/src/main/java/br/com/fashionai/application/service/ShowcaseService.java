package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import java.util.HashSet;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.taxonomy.WorldRegions;
import br.com.fashionai.domain.model.enums.FollowStatus;
import br.com.fashionai.domain.repository.FollowRepository;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeGrouping;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.GroupingType;
import br.com.fashionai.domain.model.enums.MannequinSex;
import br.com.fashionai.domain.model.enums.Model3dStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.DailyLookRepository;
import br.com.fashionai.domain.repository.SchemeGroupingRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Vitrines 3D (cards Trello "Passarela 3D", "Eras da celebridade" e "Coleções da marca", e o botão "Gerar 3D" das
 * anatomias): monta o look de um esquema para o manequim (sexo do cadastro RF1, cabeça com a foto de perfil), a
 * passarela diária do Explorar com o Look do Dia de cada pessoa, e a busca/ranking de eras e coleções do RF22.
 * <p>
 * Tudo aqui é leitura de dados que já existem (esquemas, peças, agrupamentos, Look do Dia): a renderização 3D roda
 * no navegador (Three.js). Peças com modelo do RF16 pronto entram como GLB; as demais entram como a foto recortada
 * aplicada no manequim.
 */
@Service
public class ShowcaseService {
    /** Aba Eras (celebridade): eras, fases e turnês. Aba Coleções (marca): coleções. */
    static final Set<GroupingType> ERA_TYPES = EnumSet.of(GroupingType.ERA, GroupingType.PHASE, GroupingType.TOUR);
    static final Set<GroupingType> COLLECTION_TYPES = EnumSet.of(GroupingType.COLLECTION);
    /** Pesos do ranking de insights: curtidas, hype e volume de itens (normalizados pelo maior valor do perfil). */
    static final double W_LIKES = 0.5, W_HYPE = 0.35, W_ITEMS = 0.15;
    static final int RUNWAY_MAX = 24;

    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final WardrobeItemRepository pieces;
    private final SchemeGroupingRepository groupings;
    private final DailyLookRepository dailyLooks;
    private final DailyLookService dailyLookService;
    private final UserPreferencesRepository preferences;
    private final CelebrityProfileRepository celebrities;
    private final SchemeService schemeService;
    private final InstitutionalService institutional;
    private final Model3dService model3d;
    private final Guard guard;
    private final Avatar3dService avatars3d;
    private final UserRepository users;
    private final MediaService media;
    private final FollowRepository follows;

    public ShowcaseService(FollowRepository follows, UserRepository users, MediaService media, SchemeRepository schemes, SchemeItemRepository schemeItems, WardrobeItemRepository pieces,
                           SchemeGroupingRepository groupings, DailyLookRepository dailyLooks, DailyLookService dailyLookService,
                           UserPreferencesRepository preferences, CelebrityProfileRepository celebrities,
                           SchemeService schemeService, InstitutionalService institutional, Model3dService model3d, Guard guard,
                           Avatar3dService avatars3d) {
        this.avatars3d = avatars3d;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.pieces = pieces;
        this.groupings = groupings;
        this.dailyLooks = dailyLooks;
        this.dailyLookService = dailyLookService;
        this.preferences = preferences;
        this.celebrities = celebrities;
        this.schemeService = schemeService;
        this.institutional = institutional;
        this.model3d = model3d;
        this.guard = guard;
        this.users = users;
        this.media = media;
        this.follows = follows;
    }

    // ================================================================== look no manequim ("Gerar 3D")

    @Transactional(readOnly = true)
    public Map<String, Object> look3d(CurrentUser viewer, UUID schemeId) {
        Scheme s = schemes.findById(schemeId).orElseThrow(() -> ApiException.notFound(Msg.t("entity.esquema")));
        if (s.getStatus() == SchemeStatus.ARCHIVED && (viewer == null || !viewer.id().equals(s.getUser().getId()))
                || !schemeService.canView(viewer, s)) {
            throw ApiException.notFound(Msg.t("entity.esquema"));
        }
        return look(s, viewer);
    }

    /** Uma peça sozinha no manequim (card de peça): o modelo do RF16 quando existe, senão a foto aplicada. */
    @Transactional(readOnly = true)
    public Map<String, Object> piece3d(CurrentUser viewer, UUID pieceId) {
        WardrobeItem w = pieces.findById(pieceId).orElseThrow(() -> ApiException.notFound(Msg.t("common.peca")));
        guard.requireView(viewer, w.getUser().getId(), SchemeService.moreRestrictive(w.getVisibility(), w.getUser().getProfileVisibility()), "piece:" + pieceId);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("pieceId", w.getId());
        out.put("title", w.getName());
        out.put("owner", Views.user(w.getUser()));
        out.put("mannequin", mannequin(w.getUser(), List.of(w), viewer));
        out.put("pieces", List.of(piece(w)));
        boolean own = viewer != null && viewer.id().equals(w.getUser().getId());
        out.put("canRequest", own && canRequest(w));
        out.put("missing3d", w.getModel3dStatus() == Model3dStatus.COMPLETED ? 0 : 1);
        return out;
    }

    Map<String, Object> look(Scheme s, CurrentUser viewer) {
        List<WardrobeItem> ws = schemeItems.findBySchemeIdOrderBySortOrder(s.getId()).stream().map(SchemeItem::getWardrobeItem)
                .filter(Objects::nonNull).toList();
        boolean own = viewer != null && viewer.id().equals(s.getUser().getId());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("schemeId", s.getId());
        out.put("title", s.getTitle());
        out.put("owner", Views.user(s.getUser()));
        out.put("hypeScore", s.getHypeScore());
        out.put("likes", s.getLikeCount());
        out.put("mannequin", mannequin(s.getUser(), ws, viewer));
        out.put("pieces", ws.stream().map(ShowcaseService::piece).toList());
        long ready = ws.stream().filter(w -> w.getModel3dStatus() == Model3dStatus.COMPLETED && w.getModel3dUrl() != null).count();
        out.put("ready3d", ready);
        out.put("missing3d", ws.size() - ready);
        out.put("canRequest", own && ws.stream().anyMatch(this::canRequest));
        return out;
    }

    private boolean canRequest(WardrobeItem w) {
        return !w.isDefaultImage() && w.getImageUrl() != null && w.getModel3dStatus() != Model3dStatus.COMPLETED
                && w.getModel3dStatus() != Model3dStatus.QUEUED && w.getModel3dStatus() != Model3dStatus.PROCESSING;
    }

    static Map<String, Object> piece(WardrobeItem w) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", w.getId());
        m.put("name", w.getName());
        m.put("slot", MirrorService.slotOf(w));
        m.put("category", w.getCategory());
        m.put("subcategory", w.getSubcategory());
        m.put("imageUrl", w.getImageUrl());                 // recorte sem fundo: é o que "veste" o manequim
        m.put("studioUrl", w.getStudioImageUrl());
        m.put("colorHex", Taxonomy.hex(w.getColor()));
        m.put("model3dStatus", w.getModel3dStatus() == null ? null : w.getModel3dStatus().name());
        m.put("model3dUrl", w.getModel3dStatus() == Model3dStatus.COMPLETED ? w.getModel3dUrl() : null);
        m.put("defaultImage", w.isDefaultImage());
        return m;
    }

    /**
     * Manequim da pessoa: sexo do cadastro (RF1) → preferência do provador → sexo das peças → feminino padrão.
     * Com foto de perfil, a cabeça do manequim recebe a foto; sem foto, é o manequim padrão (cabeça lisa).
     */
    Map<String, Object> mannequin(User u, List<WardrobeItem> ws) {
        return mannequin(u, ws, null);
    }

    /**
     * Com o Avatar 3D (RF40) confirmado e visível para quem está vendo (público na Passarela, ou o próprio dono), a
     * cabeça é o busto da pessoa ({@code head=AVATAR}); senão continua a foto de perfil ou o manequim padrão.
     */
    Map<String, Object> mannequin(User u, List<WardrobeItem> ws, CurrentUser viewer) {
        Map<String, Object> m = mannequinBase(u, ws);
        if (u.getProfileType() != ProfileType.MARCA) {
            avatars3d.forMannequin(u.getId(), viewer == null ? null : viewer.id()).ifPresent(a -> {
                m.put("avatar", a);
                m.put("head", "AVATAR");
            });
        }
        return m;
    }

    private Map<String, Object> mannequinBase(User u, List<WardrobeItem> ws) {
        MannequinSex sex = u.getSex();
        String source = "cadastro";
        var prefs = preferences.findByUserId(u.getId());
        if (sex == null && prefs.isPresent() && prefs.get().getMannequinSex() != null) {
            sex = prefs.get().getMannequinSex();
            source = "provador";
        }
        if (sex == null) {
            long fem = ws.stream().filter(w -> "FEMININO".equalsIgnoreCase(w.getSex())).count();
            long mas = ws.stream().filter(w -> "MASCULINO".equalsIgnoreCase(w.getSex())).count();
            if (fem != mas) {
                sex = fem > mas ? MannequinSex.FEMININO : MannequinSex.MASCULINO;
                source = "pecas";
            } else {
                sex = MannequinSex.FEMININO;
                source = "padrao";
            }
        }
        String photo = u.getAvatarUrl();
        if (u.getProfileType() == ProfileType.MARCA) {
            photo = null;                                   // logo não vira rosto: marca desfila com o manequim padrão
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("sex", sex.name());
        m.put("sexSource", source);
        m.put("photoUrl", photo);
        // a foto de perfil não vai para a cabeça 3D (levava o fundo e a roupa para o rosto): o rosto só vem do Avatar 3D
        m.put("head", "PADRAO");
        m.put("skinTone", prefs.map(p -> p.getMannequinSkinTone()).orElse(null));
        m.put("build", prefs.map(p -> p.getMannequinBuild() == null ? null : p.getMannequinBuild().name()).orElse(null));
        m.put("face", prefs.map(p -> p.getMannequinFaceJson() == null ? null : br.com.fashionai.application.common.Json.map(p.getMannequinFaceJson())).orElse(null));
        return m;
    }

    /** Dono pede o RF16 para todas as peças do esquema que ainda não têm modelo 3D (cada uma vira um job). */
    @Transactional
    public Map<String, Object> requestModels(CurrentUser user, UUID schemeId) {
        guard.requireCanCreate(user);
        Scheme s = schemeService.owned(user, schemeId);
        int requested = 0;
        List<Map<String, Object>> skipped = new ArrayList<>();
        for (SchemeItem si : schemeItems.findBySchemeIdOrderBySortOrder(s.getId())) {
            WardrobeItem w = si.getWardrobeItem();
            if (w == null || w.getModel3dStatus() == Model3dStatus.COMPLETED) {
                continue;
            }
            if (!w.getUser().getId().equals(user.id())) {
                skipped.add(Map.of("id", w.getId(), "name", w.getName(), "reason", Msg.t("showcase.peca_de_outra_pessoa")));
                continue;
            }
            try {
                model3d.request(w);
                requested++;
            } catch (ApiException ex) {
                skipped.add(Map.of("id", w.getId(), "name", w.getName(), "reason", ex.getMessage()));
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("requested", requested);
        out.put("skipped", skipped);
        out.put("look", look(s, user));
        return out;
    }

    // ================================================================== Foto com meu manequim (RF4 · RF5)

    /** Só peça superior (inclui camadas externas) e de corpo inteiro: inferior, calçado e acessório não vestem sozinhos. */
    static final Set<String> MANNEQUIN_PHOTO_CATEGORIES = Set.of("upper_piece", "full_body_piece");

    /**
     * RF4 — a foto da peça vestindo o manequim da pessoa (rosto 3D a partir da foto de perfil) ou o manequim padrão
     * masc./fem. quando não há foto. A imagem é renderizada no navegador (Three.js, mesmo manequim da Passarela) e
     * enviada aqui; o servidor valida, recodifica e guarda.
     */
    @Transactional
    public Map<String, Object> pieceMannequinPhoto(CurrentUser user, UUID id, byte[] bytes) {
        guard.requireCanCreate(user);
        WardrobeItem w = pieces.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("common.peca")));
        guard.requireOwner(user, w.getUser().getId(), "piece:" + id);
        if (!MANNEQUIN_PHOTO_CATEGORIES.contains(w.getCategory())) {
            throw new ApiException(422, "SEM_FOTO_NO_MANEQUIM", Msg.t("showcase.a_foto_com_manequim_e"));
        }
        String url = storeMannequinPhoto(user, "pieces/" + id, bytes);
        w.setMannequinImageUrl(url);
        w.setMannequinImageFace(faceOf(w.getUser()));
        return Map.of("url", url, "face", w.getMannequinImageFace());
    }

    /** RF5 — o look inteiro (todas as peças do esquema) no manequim; opcionalmente vira a foto do post (capa). */
    @Transactional
    public Map<String, Object> schemeMannequinPhoto(CurrentUser user, UUID id, byte[] bytes, boolean asCover) {
        guard.requireCanCreate(user);
        Scheme s = schemeService.owned(user, id);
        String url = storeMannequinPhoto(user, "schemes/" + id, bytes);
        s.setMannequinImageUrl(url);
        s.setMannequinImageFace(faceOf(s.getUser()));
        if (asCover) {
            s.setCoverImageUrl(url);
        }
        return Map.of("url", url, "face", s.getMannequinImageFace(), "cover", asCover);
    }

    @Transactional
    public void deleteMannequinPhoto(CurrentUser user, String kind, UUID id) {
        if ("scheme".equals(kind)) {
            Scheme s = schemeService.owned(user, id);
            if (s.getMannequinImageUrl() != null && s.getMannequinImageUrl().equals(s.getCoverImageUrl())) {
                s.setCoverImageUrl(null);
            }
            s.setMannequinImageUrl(null);
            s.setMannequinImageFace(null);
        } else {
            WardrobeItem w = pieces.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("common.peca")));
            guard.requireOwner(user, w.getUser().getId(), "piece:" + id);
            w.setMannequinImageUrl(null);
            w.setMannequinImageFace(null);
        }
    }

    private String storeMannequinPhoto(CurrentUser user, String base, byte[] bytes) {
        br.com.fashionai.application.imaging.ImageOps.requireAcceptedImage(bytes);
        java.awt.image.BufferedImage img = br.com.fashionai.application.imaging.ImageOps.scaleToFit(
                br.com.fashionai.application.imaging.ImageOps.decode(bytes), 1600, 1600);
        byte[] jpeg = br.com.fashionai.application.imaging.ImageOps.jpeg(img, 0.92f);
        return media.put("users/" + user.id() + "/" + base + "/mannequin-" + System.currentTimeMillis() + ".jpg", jpeg, "image/jpeg").url();
    }

    private static String faceOf(User u) {
        return u.getAvatarUrl() != null && u.getProfileType() != ProfileType.MARCA ? "FOTO" : "PADRAO";
    }

    /** Foto da era / arte da coleção (header da busca e vitrine da mini loja 3D): só o dono do agrupamento envia. */
    @Transactional
    public Map<String, Object> groupingCover(CurrentUser user, UUID id, byte[] bytes) {
        guard.requireCanCreate(user);
        SchemeGrouping g = groupings.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("entity.agrupamento")));
        guard.requireOwner(user, g.getOwner().getId(), "grouping:" + id);
        br.com.fashionai.application.imaging.ImageOps.requireAcceptedImage(bytes);
        java.awt.image.BufferedImage img = br.com.fashionai.application.imaging.ImageOps.scaleToFit(
                br.com.fashionai.application.imaging.ImageOps.decode(bytes), 1800, 1200);
        byte[] jpeg = br.com.fashionai.application.imaging.ImageOps.jpeg(img, 0.9f);
        String url = media.put("users/" + user.id() + "/groupings/" + id + "/cover-" + System.currentTimeMillis() + ".jpg", jpeg, "image/jpeg").url();
        g.setCoverUrl(url);
        return Map.of("id", g.getId(), "coverUrl", url);
    }

    // ================================================================== Passarela 3D (Explorar)

    /** Rankings da Passarela: o desfile mostra um lote por vez (nunca "todo mundo") e a tabela vai até o Top 100. */
    public static final List<String> RUNWAY_RANKINGS = List.of("TOP100_GLOBAL", "TOP100_REGIONAL", "TOP100_PAIS", "SEGUINDO", "EM_ALTA", "RECENTES");
    static final int RUNWAY_TOP = 100;

    public record RunwayFilter(String ranking, String region, String country, List<String> colors, List<String> occasions, List<String> styles,
                               String sex, Integer limit, Integer offset) {
        public static RunwayFilter of(Integer limit) {
            return new RunwayFilter(null, null, null, List.of(), List.of(), List.of(), null, limit, 0);
        }
    }

    /** Atributos de um Look do Dia usados nos filtros (país/região do dono, famílias de cor, ocasiões e estilos). */
    record RunwayEntry(DailyLook dl, String country, String region, Set<String> colors, Set<String> occasions, Set<String> styles, String sex) {
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

    @Transactional
    public Map<String, Object> runway(CurrentUser viewer, Integer limit) {
        return runway(viewer, RunwayFilter.of(limit));
    }

    /**
     * O desfile do dia: o Look do Dia de hoje de cada perfil visível. Quem registrou look na última semana e não trocou
     * hoje continua desfilando com o último (mesma virada de dia do RF6). Rankings: Top 100 Global (Hype Score), Top 100
     * Regional (região do mundo), Top 100 do país, Seguindo, Em alta (curtidas) e Recentes; filtros por região, cores,
     * ocasiões, estilos e manequim. Como seria inviável desfilar todo mundo, a passarela 3D mostra um lote de até 24
     * looks por vez ({@code limit}/{@code offset}) e a tabela lateral vai até o Top 100.
     */
    @Transactional
    public Map<String, Object> runway(CurrentUser viewer, RunwayFilter f) {
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
                .filter(dl -> dl.getUser().getStatus() == AccountStatus.ACTIVE && !dl.getUser().isRunwayOptOut() && SearchService.showcaseAllows(viewer, dl.getUser()))
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
        facets.put("countries", count(scoped.stream().map(RunwayEntry::country).filter(Objects::nonNull).toList()));
        facets.put("colors", count(scoped.stream().flatMap(e -> e.colors().stream()).toList()));
        facets.put("occasions", count(scoped.stream().flatMap(e -> e.occasions().stream()).toList()));
        facets.put("styles", count(scoped.stream().flatMap(e -> e.styles().stream()).toList()));
        // filtros
        List<String> colors = f.colors() == null ? List.of() : f.colors(), occ = f.occasions() == null ? List.of() : f.occasions(),
                styles = f.styles() == null ? List.of() : f.styles();
        String sex = f.sex() == null || f.sex().isBlank() ? null : f.sex().toUpperCase(Locale.ROOT);
        Comparator<RunwayEntry> order = switch (ranking) {
            case "EM_ALTA" -> Comparator.comparingLong((RunwayEntry e) -> e.dl().getScheme().getLikeCount() + 2 * e.dl().getScheme().getSaveCount()).reversed()
                    .thenComparing(e -> -hype(e.dl().getScheme().getHypeScore()));
            case "RECENTES" -> Comparator.comparing((RunwayEntry e) -> e.dl().getCreatedAt() == null ? java.time.Instant.EPOCH : e.dl().getCreatedAt()).reversed();
            default -> Comparator.comparing((RunwayEntry e) -> hype(e.dl().getScheme().getHypeScore())).reversed()
                    .thenComparing(e -> -e.dl().getScheme().getLikeCount());
        };
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
            row.put("hypeScore", e.dl().getScheme().getHypeScore());
            row.put("likes", e.dl().getScheme().getLikeCount());
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
            m.put("look", look(e.dl().getScheme(), viewer));
            looks.add(m);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("date", today);
        out.put("nextUpdate", ZonedDateTime.now(FaiPointsService.ZONE).toLocalDate().plusDays(1).atStartOfDay(FaiPointsService.ZONE).toInstant());
        out.put("totalToday", pool.size());
        out.put("total", ranked.size());
        out.put("ranking", ranking);
        out.put("rankings", RUNWAY_RANKINGS);
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

    static List<Map<String, Object>> count(List<String> values) {
        Map<String, Long> c = new java.util.TreeMap<>();
        values.forEach(v -> c.merge(v, 1L, Long::sum));
        return c.entrySet().stream().sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .map(e -> Map.<String, Object>of("value", e.getKey(), "count", e.getValue())).toList();
    }

    private static double hype(BigDecimal b) {
        return b == null ? 0 : b.doubleValue();
    }

    // ================================================================== Eras (celebridade) e Coleções (marca) — RF22

    public enum Kind { ERAS, COLLECTIONS }

    public static Kind kind(String k) {
        String v = k == null ? "" : k.toUpperCase(Locale.ROOT);
        return switch (v) {
            case "ERAS" -> Kind.ERAS;
            case "COLLECTIONS", "COLECOES" -> Kind.COLLECTIONS;
            default -> throw ApiException.badRequest("ABA_INVALIDA", Msg.t("showcase.use_eras_ou_collections"));
        };
    }

    private User owner(String slug, Kind kind) {
        User u = institutional.institutionalUser(slug);
        if (kind == Kind.ERAS && u.getProfileType() != ProfileType.CELEBRIDADE) {
            throw ApiException.notFound(Msg.t("showcase.eras_so_perfis_de_celebridade"));
        }
        if (kind == Kind.COLLECTIONS && u.getProfileType() != ProfileType.MARCA) {
            throw ApiException.notFound(Msg.t("showcase.colecoes_so_perfis_de_marca"));
        }
        return u;
    }

    private List<SchemeGrouping> groupingsOf(User u, Kind kind) {
        Set<GroupingType> types = kind == Kind.ERAS ? ERA_TYPES : COLLECTION_TYPES;
        return groupings.findByOwnerIdOrderByCreatedAtDesc(u.getId()).stream().filter(g -> types.contains(g.getType()))
                .sorted(Comparator.comparingInt(SchemeGrouping::getSortOrder)
                        .thenComparing(g -> g.getPeriodFrom() == null ? Integer.MAX_VALUE : g.getPeriodFrom()))
                .toList();
    }

    private List<Scheme> visibleSchemes(CurrentUser viewer, User u) {
        boolean self = viewer != null && viewer.id().equals(u.getId());
        return schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(u.getId(), SchemeStatus.ARCHIVED).stream()
                .filter(s -> self || s.getStatus() == SchemeStatus.PUBLISHED)
                .filter(s -> schemeService.canView(viewer, s)).toList();
    }

    private List<WardrobeItem> visiblePieces(CurrentUser viewer, User u) {
        return pieces.findByUserIdOrderByCreatedAtDesc(u.getId()).stream()
                .filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED)
                .filter(w -> guard.canView(viewer, u.getId(), SchemeService.moreRestrictive(w.getVisibility(), u.getProfileVisibility())))
                .toList();
    }

    /** Lista de eras/coleções com contagem, capa (ou a capa do esquema mais hypado) e período. */
    @Transactional(readOnly = true)
    public Map<String, Object> list(CurrentUser viewer, String slug, Kind kind) {
        User u = owner(slug, kind);
        List<Scheme> ss = visibleSchemes(viewer, u);
        List<WardrobeItem> ps = visiblePieces(viewer, u);
        List<Map<String, Object>> out = new ArrayList<>();
        for (SchemeGrouping g : groupingsOf(u, kind)) {
            out.add(groupingCard(g, ss, ps));
        }
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("kind", kind.name());
        res.put("owner", Views.user(u));
        res.put("items", out);
        res.put("ungrouped", Map.of("schemes", ss.stream().filter(s -> s.getGroupingId() == null).count(),
                "pieces", ps.stream().filter(w -> w.getGroupingId() == null).count()));
        return res;
    }

    private Map<String, Object> groupingCard(SchemeGrouping g, List<Scheme> ss, List<WardrobeItem> ps) {
        List<Scheme> gs = ss.stream().filter(s -> g.getId().equals(s.getGroupingId())).toList();
        List<WardrobeItem> gp = ps.stream().filter(w -> g.getId().equals(w.getGroupingId())).toList();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", g.getId());
        m.put("type", g.getType().name());
        m.put("label", g.getLabel());
        m.put("description", g.getDescription());
        m.put("periodFrom", g.getPeriodFrom());
        m.put("periodTo", g.getPeriodTo());
        m.put("period", period(g));
        m.put("accentColor", g.getAccentColor() == null ? "#2D55C9" : g.getAccentColor());
        String cover = g.getCoverUrl();
        String coverSource = "upload";
        if (cover == null) {
            cover = gs.stream().filter(s -> s.getCoverImageUrl() != null).max(Comparator.comparing((Scheme s) -> hype(s.getHypeScore())))
                    .map(Scheme::getCoverImageUrl).orElse(gp.stream().map(w -> w.getStudioImageUrl() != null ? w.getStudioImageUrl() : w.getImageUrl())
                            .filter(Objects::nonNull).findFirst().orElse(null));
            coverSource = cover == null ? "nenhuma" : "esquema";
        }
        m.put("coverUrl", cover);
        m.put("coverSource", coverSource);
        m.put("schemes", gs.size());
        m.put("pieces", gp.size());
        return m;
    }

    static String period(SchemeGrouping g) {
        if (g.getPeriodFrom() == null) {
            return null;
        }
        return g.getPeriodTo() == null || g.getPeriodTo().equals(g.getPeriodFrom()) ? String.valueOf(g.getPeriodFrom())
                : g.getPeriodFrom() + "–" + g.getPeriodTo();
    }

    /**
     * Busca da aba Eras/Coleções: esquemas e peças filtrados por era/coleção (ou todas), texto e ano; o header traz a
     * foto/arte da era ou coleção escolhida.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> items(CurrentUser viewer, String slug, Kind kind, UUID groupingId, String q, String type,
                                     String sort, Integer year) {
        User u = owner(slug, kind);
        List<SchemeGrouping> gs = groupingsOf(u, kind);
        Set<UUID> ids = new LinkedHashSet<>();
        SchemeGrouping selected = null;
        for (SchemeGrouping g : gs) {
            boolean inYear = year == null || g.getPeriodFrom() != null && year >= g.getPeriodFrom()
                    && year <= (g.getPeriodTo() == null ? g.getPeriodFrom() : g.getPeriodTo());
            if ((groupingId == null || g.getId().equals(groupingId)) && inYear) {
                ids.add(g.getId());
            }
            if (g.getId().equals(groupingId)) {
                selected = g;
            }
        }
        if (groupingId != null && selected == null) {
            throw ApiException.notFound(kind == Kind.ERAS ? "Era" : Msg.t("showcase.colecao"));
        }
        String needle = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
        String t = type == null ? "TODOS" : type.toUpperCase(Locale.ROOT);
        List<Scheme> ss = visibleSchemes(viewer, u).stream().filter(s -> s.getGroupingId() != null && ids.contains(s.getGroupingId()))
                .filter(s -> needle.isEmpty() || contains(s.getTitle(), needle) || contains(s.getTags(), needle) || contains(s.getStyle(), needle))
                .sorted(order(sort, Scheme::getHypeScore, Scheme::getLikeCount, Scheme::getCreatedAt)).toList();
        List<WardrobeItem> ps = visiblePieces(viewer, u).stream().filter(w -> w.getGroupingId() != null && ids.contains(w.getGroupingId()))
                .filter(w -> needle.isEmpty() || contains(w.getName(), needle) || contains(w.getBrandName(), needle) || contains(w.getTags(), needle))
                .sorted(order(sort, WardrobeItem::getHypeScore, WardrobeItem::getLikesCount, WardrobeItem::getCreatedAt)).toList();
        Map<UUID, SchemeGrouping> byId = new HashMap<>();
        gs.forEach(g -> byId.put(g.getId(), g));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("kind", kind.name());
        out.put("header", selected == null ? null : groupingCard(selected, visibleSchemes(viewer, u), visiblePieces(viewer, u)));
        out.put("schemes", t.equals("PECAS") ? List.of() : ss.stream().limit(60).map(s -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("scheme", schemeService.view(viewer, s, schemeItems.findBySchemeIdOrderBySortOrder(s.getId())));
            m.put("grouping", byId.get(s.getGroupingId()).getLabel());
            return m;
        }).toList());
        out.put("pieces", t.equals("ESQUEMAS") ? List.of() : ps.stream().limit(60).map(w -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("piece", Views.piece(w, null, null));
            m.put("grouping", byId.get(w.getGroupingId()).getLabel());
            return m;
        }).toList());
        out.put("years", gs.stream().filter(g -> g.getPeriodFrom() != null).flatMap(g -> java.util.stream.IntStream
                .rangeClosed(g.getPeriodFrom(), g.getPeriodTo() == null ? g.getPeriodFrom() : g.getPeriodTo()).boxed()).distinct().sorted().toList());
        return out;
    }

    private static boolean contains(String hay, String needle) {
        return hay != null && hay.toLowerCase(Locale.ROOT).contains(needle);
    }

    private static <T> Comparator<T> order(String sort, java.util.function.Function<T, BigDecimal> hype,
                                           java.util.function.ToLongFunction<T> likes, java.util.function.Function<T, java.time.Instant> created) {
        String s = sort == null ? "HYPE" : sort.toUpperCase(Locale.ROOT);
        return switch (s) {
            case "CURTIDAS", "LIKES" -> Comparator.comparingLong(likes).reversed();
            case "RECENTES", "RECENT" -> Comparator.comparing(created, Comparator.nullsLast(Comparator.reverseOrder()));
            default -> Comparator.comparing((T x) -> hype(hype.apply(x))).reversed();
        };
    }

    /**
     * Insights de eras/coleções: curtidas totais (esquemas + peças), maior Hype Score e volume. A pontuação é
     * 0,5·curtidas + 0,35·hype + 0,15·itens, cada termo dividido pelo maior valor do próprio perfil. A plateia do palco
     * (ou o público em volta da mini loja) é proporcional à pontuação: o 1º lugar lota.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> insights(CurrentUser viewer, String slug, Kind kind) {
        User u = owner(slug, kind);
        List<Scheme> ss = visibleSchemes(viewer, u);
        List<WardrobeItem> ps = visiblePieces(viewer, u);
        List<Map<String, Object>> rows = new ArrayList<>();
        double maxLikes = 0, maxHype = 0, maxItems = 0;
        for (SchemeGrouping g : groupingsOf(u, kind)) {
            List<Scheme> gs = ss.stream().filter(s -> g.getId().equals(s.getGroupingId())).toList();
            List<WardrobeItem> gp = ps.stream().filter(w -> g.getId().equals(w.getGroupingId())).toList();
            long likes = gs.stream().mapToLong(Scheme::getLikeCount).sum() + gp.stream().mapToLong(WardrobeItem::getLikesCount).sum();
            double topHype = java.util.stream.Stream.concat(gs.stream().map(Scheme::getHypeScore), gp.stream().map(WardrobeItem::getHypeScore))
                    .mapToDouble(ShowcaseService::hype).max().orElse(0);
            Map<String, Object> r = groupingCard(g, ss, ps);
            r.put("likes", likes);
            r.put("topHype", Math.round(topHype * 10) / 10.0);
            r.put("items", gs.size() + gp.size());
            r.put("comments", gs.stream().mapToLong(Scheme::getCommentCount).sum());
            r.put("shares", gs.stream().mapToLong(Scheme::getShareCount).sum());
            r.put("topScheme", gs.stream().max(Comparator.comparing((Scheme s) -> hype(s.getHypeScore())))
                    .map(s -> Map.of("id", s.getId(), "title", s.getTitle())).orElse(null));
            maxLikes = Math.max(maxLikes, likes);
            maxHype = Math.max(maxHype, topHype);
            maxItems = Math.max(maxItems, gs.size() + gp.size());
            rows.add(r);
        }
        for (Map<String, Object> r : rows) {
            double score = W_LIKES * norm(((Number) r.get("likes")).doubleValue(), maxLikes)
                    + W_HYPE * norm(((Number) r.get("topHype")).doubleValue(), maxHype)
                    + W_ITEMS * norm(((Number) r.get("items")).doubleValue(), maxItems);
            r.put("score", Math.round(score * 1000) / 10.0);
        }
        rows.sort(Comparator.comparingDouble((Map<String, Object> r) -> ((Number) r.get("score")).doubleValue()).reversed());
        double top = rows.isEmpty() ? 0 : ((Number) rows.get(0).get("score")).doubleValue();
        int capacity = kind == Kind.ERAS ? 120 : 80;
        for (int i = 0; i < rows.size(); i++) {
            Map<String, Object> r = rows.get(i);
            double s = ((Number) r.get("score")).doubleValue();
            double fraction = top <= 0 ? 0 : s / top;
            r.put("rank", i + 1);
            r.put("audienceFraction", Math.round(fraction * 100) / 100.0);
            r.put("audience", (int) Math.round(fraction * capacity));
            r.put("capacity", capacity);
            r.put("fireworks", kind == Kind.COLLECTIONS ? Math.max(0, 4 - i) * (fraction >= 0.25 ? 1 : 0) : 0);
            r.put("spotlights", Math.max(1, 4 - i));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("kind", kind.name());
        out.put("owner", Views.user(u));
        out.put("ranking", rows);
        out.put("mostLiked", rows.stream().max(Comparator.comparingLong(r -> ((Number) r.get("likes")).longValue())).map(r -> r.get("label")).orElse(null));
        out.put("mostHype", rows.stream().max(Comparator.comparingDouble(r -> ((Number) r.get("topHype")).doubleValue())).map(r -> r.get("label")).orElse(null));
        out.put("method", Msg.t("showcase.pontuacao_0_5_curtidas_0", (kind == Kind.ERAS ? "eras" : Msg.t("showcase.colecoes")), capacity));
        return out;
    }

    private static double norm(double v, double max) {
        return max <= 0 ? 0 : v / max;
    }

    /**
     * My Stage 3D (aba Eras): a foto oficial da celebridade na cabeça do manequim, vestindo o look de maior Hype Score,
     * no palco com as cores das eras.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> stage(CurrentUser viewer, String slug, UUID schemeId) {
        User u = owner(slug, Kind.ERAS);
        List<Scheme> ss = visibleSchemes(viewer, u);
        Scheme chosen = schemeId == null ? ss.stream().max(Comparator.comparing((Scheme s) -> hype(s.getHypeScore()))).orElse(null)
                : ss.stream().filter(s -> s.getId().equals(schemeId)).findFirst().orElseThrow(() -> ApiException.notFound(Msg.t("entity.esquema")));
        String photo = celebrities.findByOwnerId(u.getId()).map(c -> c.getAvatarUrl()).filter(Objects::nonNull).orElse(u.getAvatarUrl());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("celebrity", Views.user(u));
        out.put("photoUrl", photo);
        out.put("look", chosen == null ? null : look(chosen, viewer));
        if (chosen == null) {
            Map<String, Object> m = mannequin(u, List.of());
            m.put("photoUrl", photo);
            // a foto de perfil não vai para a cabeça 3D (levava o fundo e a roupa para o rosto): o rosto só vem do Avatar 3D
        m.put("head", "PADRAO");
            out.put("mannequin", m);
        }
        out.put("eras", groupingsOf(u, Kind.ERAS).stream().map(g -> Map.of("id", g.getId(), "label", g.getLabel(),
                "accentColor", g.getAccentColor() == null ? "#2D55C9" : g.getAccentColor())).toList());
        out.put("looks", ss.stream().sorted(Comparator.comparing((Scheme s) -> hype(s.getHypeScore())).reversed()).limit(12)
                .map(s -> Map.of("id", s.getId(), "title", s.getTitle())).toList());
        return out;
    }
}
