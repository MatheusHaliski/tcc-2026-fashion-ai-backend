package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.local.Similarity;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.CelebrityProfile;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.FollowStatus;
import br.com.fashionai.domain.model.enums.GroupingType;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.ReactionType;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.model.enums.SealStatus;
import br.com.fashionai.domain.model.enums.TargetType;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.FollowRepository;
import br.com.fashionai.domain.repository.ReactionRepository;
import br.com.fashionai.domain.repository.SavedItemRepository;
import br.com.fashionai.domain.repository.SchemeGroupingRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.SealBondRepository;
import br.com.fashionai.domain.repository.SealRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * RF14 (Maison — marcas) e RF22 (Art Celebrity — celebridades verificadas), artefato #11: um layout, dois
 * materiais (têxtil/dourado × vítreo/holográfico), header com contadores de rede e métricas do RF19, seis abas no
 * modo administrador e três no modo visitante (Promoções, Looks consagrados, Catálogo), feed ordenado por afinidade
 * com o arquétipo do DNA (RF24.CA06, alternável para "mais recentes") e link da loja (HU12).
 */
@Service
public class InstitutionalService {
    private final UserRepository users;
    private final BrandProfileRepository brands;
    private final CelebrityProfileRepository celebrities;
    private final FollowRepository follows;
    private final SealRepository seals;
    private final SealBondRepository bonds;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final WardrobeItemRepository pieces;
    private final SavedItemRepository saved;
    private final ReactionRepository reactions;
    private final SchemeGroupingRepository groupings;
    private final StyleDnaRepository dnas;
    private final SchemeService schemeService;
    private final SealService sealService;
    private final AiEngine ai;
    private final Guard guard;

    public InstitutionalService(UserRepository users, BrandProfileRepository brands, CelebrityProfileRepository celebrities, FollowRepository follows,
                                SealRepository seals, SealBondRepository bonds, SchemeRepository schemes, SchemeItemRepository schemeItems,
                                WardrobeItemRepository pieces, SavedItemRepository saved, ReactionRepository reactions, SchemeGroupingRepository groupings,
                                StyleDnaRepository dnas, SchemeService schemeService, SealService sealService, AiEngine ai, Guard guard) {
        this.users = users;
        this.brands = brands;
        this.celebrities = celebrities;
        this.follows = follows;
        this.seals = seals;
        this.bonds = bonds;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.pieces = pieces;
        this.saved = saved;
        this.reactions = reactions;
        this.groupings = groupings;
        this.dnas = dnas;
        this.schemeService = schemeService;
        this.sealService = sealService;
        this.ai = ai;
        this.guard = guard;
    }

    // ================================================================== feeds (RF14.CA01/CA02, RF22, RF24.CA06)
    Map<String, Object> brandCard(BrandProfile b) {
        UUID owner = b.getOwner().getId();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("userId", owner);
        m.put("slug", b.getSlug());
        m.put("name", b.getBrandName());
        m.put("logoUrl", b.getLogoUrl());
        m.put("coverUrl", b.getCoverUrl());
        m.put("country", b.getCountry());
        m.put("category", b.getFashionCategory());
        m.put("bonds", bonds.countByTargetOwnerIdAndStatus(owner, SealBondStatus.APPROVED));
        m.put("followers", follows.countByFollowingIdAndStatus(owner, FollowStatus.ACEITO));
        m.put("material", "TEXTIL_DOURADO");
        return m;
    }

    Map<String, Object> celebrityCard(CelebrityProfile c) {
        UUID owner = c.getOwner().getId();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("userId", owner);
        m.put("slug", c.getSlug());
        m.put("name", c.getStageName());
        m.put("avatarUrl", c.getAvatarUrl());
        m.put("coverUrl", c.getCoverUrl());
        m.put("bonds", bonds.countByTargetOwnerIdAndStatus(owner, SealBondStatus.APPROVED));
        m.put("followers", follows.countByFollowingIdAndStatus(owner, FollowStatus.ACEITO));
        m.put("styleSignature", Json.map(c.getStyleSignatureJson()));
        m.put("material", "VITREO_HOLOGRAFICO");
        return m;
    }

    /** Afinidade local (RF24.CA06): estilos do DNA × estilos do catálogo/vínculos do perfil. */
    double affinity(Set<String> userStyles, UUID ownerId) {
        if (userStyles.isEmpty()) {
            return 0;
        }
        Set<String> styles = new HashSet<>();
        pieces.findByUserIdOrderByCreatedAtDesc(ownerId).stream().limit(80).forEach(w -> styles.addAll(Json.csv(w.getStyleTags())));
        return Similarity.jaccard(userStyles, styles);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> brandFeed(CurrentUser viewer, String term, String order) {
        List<BrandProfile> list = brands.findByApprovalStatusOrderByCreatedAtDesc(ApprovalStatus.APROVADO).stream()
                .filter(b -> term == null || term.isBlank() || b.getBrandName().toLowerCase(Locale.ROOT).contains(term.trim().toLowerCase(Locale.ROOT))).toList();
        Set<String> styles = viewer == null ? new HashSet<>() : dnas.findByUserId(viewer.id()).map(d -> new HashSet<>(Json.csv(d.getStyleKeywords()))).orElse(new HashSet<>());
        boolean affinityOrder = !"RECENTES".equalsIgnoreCase(order) && !styles.isEmpty();
        List<Map<String, Object>> cards = new ArrayList<>();
        for (BrandProfile b : list) {
            Map<String, Object> m = brandCard(b);
            if (affinityOrder) {
                m.put("affinity", Math.round(affinity(styles, b.getOwner().getId()) * 100));
            }
            cards.add(m);
        }
        if (affinityOrder) {
            ai.local(viewer.id(), AiCapability.AFFINITY, List.of("estilos do seu DNA", "estilos do catálogo das marcas"), () -> cards.size());
            cards.sort(Comparator.comparingLong((Map<String, Object> m) -> ((Number) m.get("affinity")).longValue()).reversed());
        }
        return Map.of("brands", cards, "order", affinityOrder ? "AFINIDADE" : "RECENTES", "orders", List.of("AFINIDADE", "RECENTES"),
                "empty", cards.isEmpty() ? (term == null ? "Nenhuma marca validada ainda." : "Nenhuma marca encontrada para \"" + term + "\".") : "");
    }

    @Transactional(readOnly = true)
    public Map<String, Object> celebrityFeed(CurrentUser viewer, String term, String order) {
        List<CelebrityProfile> list = celebrities.findByVerificationStatusOrderByCreatedAtDesc(ApprovalStatus.APROVADO).stream()
                .filter(c -> term == null || term.isBlank() || c.getStageName().toLowerCase(Locale.ROOT).contains(term.trim().toLowerCase(Locale.ROOT))).toList();
        Set<String> styles = viewer == null ? new HashSet<>() : dnas.findByUserId(viewer.id()).map(d -> new HashSet<>(Json.csv(d.getStyleKeywords()))).orElse(new HashSet<>());
        boolean affinityOrder = !"RECENTES".equalsIgnoreCase(order) && !styles.isEmpty();
        List<Map<String, Object>> cards = new ArrayList<>();
        for (CelebrityProfile c : list) {
            Map<String, Object> m = celebrityCard(c);
            if (affinityOrder) {
                m.put("affinity", Math.round(affinity(styles, c.getOwner().getId()) * 100));
            }
            cards.add(m);
        }
        if (affinityOrder) {
            cards.sort(Comparator.comparingLong((Map<String, Object> m) -> ((Number) m.get("affinity")).longValue()).reversed());
        }
        return Map.of("celebrities", cards, "order", affinityOrder ? "AFINIDADE" : "RECENTES", "orders", List.of("AFINIDADE", "RECENTES"));
    }

    // ================================================================== perfil institucional (artefato #11)
    User institutionalUser(String slugOrId) {
        User u;
        try {
            u = users.findById(UUID.fromString(slugOrId)).orElse(null);
        } catch (IllegalArgumentException ex) {
            u = brands.findBySlug(slugOrId).map(BrandProfile::getOwner).orElseGet(() -> celebrities.findBySlug(slugOrId).map(CelebrityProfile::getOwner).orElse(null));
        }
        if (u == null || u.getProfileType() == ProfileType.PESSOAL) {
            throw ApiException.notFound("Perfil institucional");
        }
        return u;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> profile(CurrentUser viewer, String slugOrId) {
        User u = institutionalUser(slugOrId);
        boolean admin = viewer != null && viewer.id().equals(u.getId());
        boolean brand = u.getProfileType() == ProfileType.MARCA;
        Map<String, Object> header = new LinkedHashMap<>();
        if (brand) {
            BrandProfile b = brands.findByOwnerId(u.getId()).orElseThrow(() -> ApiException.notFound("Marca"));
            if (b.getApprovalStatus() != ApprovalStatus.APROVADO && !admin && !viewer.admin()) {
                throw ApiException.notFound("Marca"); // RF1.CA06 — pendente_validação não tem tela pública
            }
            header.putAll(brandCard(b));
            header.put("bio", b.getBio());
            header.put("storeUrl", b.getStoreUrl());
            header.put("status", b.getApprovalStatus() == ApprovalStatus.APROVADO ? "Validada" : b.getApprovalStatus().name());
            header.put("coverLabel", groupings.findByOwnerIdAndType(u.getId(), GroupingType.COLLECTION).stream().findFirst().map(g -> g.getLabel()).orElse(null));
            header.put("autoApproval", !b.isRequiresSealReview());
        } else {
            CelebrityProfile c = celebrities.findByOwnerId(u.getId()).orElseThrow(() -> ApiException.notFound("Celebridade"));
            if (c.getVerificationStatus() != ApprovalStatus.APROVADO && !admin && !viewer.admin()) {
                throw ApiException.notFound("Celebridade");
            }
            header.putAll(celebrityCard(c));
            header.put("bio", c.getBio());
            header.put("status", c.getVerificationStatus() == ApprovalStatus.APROVADO ? "Verificada" : c.getVerificationStatus().name());
            header.put("coverLabel", groupings.findByOwnerIdAndType(u.getId(), GroupingType.ERA).stream().findFirst().map(g -> g.getLabel()).orElse(null));
            header.put("autoApproval", false);
            header.put("autoApprovalLocked", "Todo vínculo com celebridade exige aprovação explícita deste perfil — direito de imagem (RF21.CA19).");
        }
        header.put("username", u.getUsername());
        header.put("following", follows.countByFollowerIdAndStatus(u.getId(), FollowStatus.ACEITO));
        header.put("activeSeals", seals.findByOwnerIdAndStatusOrderByCreatedAtDesc(u.getId(), SealStatus.ACTIVE).size());
        header.put("viewerFollows", viewer != null && follows.findByFollowerIdAndFollowingId(viewer.id(), u.getId()).map(f -> f.getStatus() == FollowStatus.ACEITO).orElse(false));
        header.put("metrics", metrics(u.getId()));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("header", header);
        out.put("mode", admin ? "ADMINISTRADOR" : "VISITANTE");
        out.put("tabs", admin ? List.of("CADASTRAR_SELO", "MEUS_SELOS", "MEUS_ESQUEMAS", "MINHAS_PECAS", "ESQUEMAS_SALVOS", "PECAS_SALVAS")
                : List.of("PROMOCOES", "LOOKS_CONSAGRADOS", "CATALOGO"));
        if (admin) {
            int pending = bonds.findByTargetOwnerIdAndStatusOrderByCreatedAtAsc(u.getId(), SealBondStatus.PENDING_REVIEW).size();
            out.put("reviewBanner", pending == 0 ? null : pending + " vínculo(s) aguardando sua revisão. A fila fica em Meus selos.");
        }
        out.put("groupings", groupings.findByOwnerIdOrderByCreatedAtDesc(u.getId()).stream().map(g -> Map.of("id", g.getId(), "type", g.getType().name(),
                "label", g.getLabel())).toList());
        return out;
    }

    /** Faixa de métricas do RF19: curtidas, trend, elegante, criativo, comentários, salvamentos e compartilhamentos. */
    Map<String, Long> metrics(UUID ownerId) {
        long likes = 0, comments = 0, shares = 0, saves = 0, trend = 0, elegante = 0, criativo = 0;
        for (Scheme s : schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(ownerId, SchemeStatus.ARCHIVED)) {
            likes += s.getLikeCount();
            comments += s.getCommentCount();
            shares += s.getShareCount();
            saves += saved.countByTargetTypeAndTargetId(TargetType.SCHEME, s.getId());
            trend += reactions.countByTargetTypeAndTargetIdAndReactionType(TargetType.SCHEME, s.getId(), ReactionType.TREND);
            elegante += reactions.countByTargetTypeAndTargetIdAndReactionType(TargetType.SCHEME, s.getId(), ReactionType.ELEGANTE);
            criativo += reactions.countByTargetTypeAndTargetIdAndReactionType(TargetType.SCHEME, s.getId(), ReactionType.CRIATIVO);
        }
        Map<String, Long> m = new LinkedHashMap<>();
        m.put("likes", likes);
        m.put("trend", trend);
        m.put("elegante", elegante);
        m.put("criativo", criativo);
        m.put("comments", comments);
        m.put("saves", saves);
        m.put("shares", shares);
        return m;
    }

    /** Abas do perfil. Visitante: Promoções (campanhas habilitadas pelos selos que ele possui), Looks consagrados, Catálogo. */
    @Transactional(readOnly = true)
    public Object tab(CurrentUser viewer, String slugOrId, String tab, String filter, UUID groupingId) {
        User u = institutionalUser(slugOrId);
        boolean admin = viewer != null && viewer.id().equals(u.getId());
        String t = tab == null ? "" : tab.toUpperCase(Locale.ROOT);
        if (!admin && Set.of("CADASTRAR_SELO", "MEUS_SELOS", "ESQUEMAS_SALVOS", "PECAS_SALVAS", "MEUS_ESQUEMAS", "MINHAS_PECAS").contains(t)) {
            throw guard.deny(viewer, "institutional-tab:" + t, "Esta aba é do administrador do perfil (RNF1).");
        }
        return switch (t) {
            case "CADASTRAR_SELO" -> Map.of("tiers", List.of("PECA", "LOOK"), "premium", u.getProfileType() == ProfileType.CELEBRIDADE,
                    "autoApprovalLocked", u.getProfileType() == ProfileType.CELEBRIDADE, "campaignCapRequired", u.getProfileType() == ProfileType.CELEBRIDADE,
                    "centerEmpty", "O centro do selo recebe o logo cadastrado — nunca envie arte com logotipo embutido.");
            case "MEUS_SELOS" -> Map.of("seals", sealService.sealsOf(u.getId()), "reviewQueue", sealService.reviewQueue(viewer), "metrics", sealService.issuerMetrics(viewer));
            case "MEUS_ESQUEMAS", "LOOKS_CONSAGRADOS" -> consecrated(viewer, u, filter, groupingId, admin);
            case "MINHAS_PECAS", "CATALOGO" -> catalog(u, filter);
            case "ESQUEMAS_SALVOS" -> saved.findByUserIdAndTargetTypeOrderBySavedAtDesc(u.getId(), TargetType.SCHEME).stream()
                    .map(si -> schemes.findById(si.getTargetId()).filter(s -> schemeService.canView(viewer, s))
                            .map(s -> Map.<String, Object>of("scheme", schemeService.view(viewer, s, schemeItems.findBySchemeIdOrderBySortOrder(s.getId())),
                                    "author", Views.user(s.getUser()), "savedAt", si.getSavedAt())).orElse(null))
                    .filter(Objects::nonNull).toList();
            case "PECAS_SALVAS" -> saved.findByUserIdAndTargetTypeOrderBySavedAtDesc(u.getId(), TargetType.PIECE).stream()
                    .map(si -> pieces.findById(si.getTargetId()).map(w -> Map.<String, Object>of("piece", Views.piece(w, null, null), "author", Views.user(w.getUser()),
                            "snapshot", w.getAvailabilityStatus() == AvailabilityStatus.ARCHIVED, "savedAt", si.getSavedAt())).orElse(null))
                    .filter(Objects::nonNull).toList();
            case "PROMOCOES" -> sealService.promotionsOf(viewer, u.getId());
            default -> throw ApiException.badRequest("ABA_INVALIDA", "Aba desconhecida.");
        };
    }

    /** Looks consagrados: esquemas com vínculo aprovado; filtros de era/fase/temporada, disponível/indisponível e mais usadas. */
    List<Map<String, Object>> consecrated(CurrentUser viewer, User u, String filter, UUID groupingId, boolean admin) {
        List<Scheme> list;
        if (admin) {
            list = schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(u.getId(), SchemeStatus.ARCHIVED);
        } else {
            list = bonds.findByTargetOwnerIdAndStatusOrderByCreatedAtDesc(u.getId(), SealBondStatus.APPROVED).stream().map(SealBond::getScheme)
                    .filter(s -> s.getStatus() == SchemeStatus.PUBLISHED && schemeService.canView(viewer, s)).distinct().toList();
        }
        if (groupingId != null) {
            list = list.stream().filter(s -> groupingId.equals(s.getGroupingId())).toList();
        }
        String f = filter == null ? "" : filter.toUpperCase(Locale.ROOT);
        list = switch (f) {
            case "DISPONIVEL" -> list.stream().filter(Scheme::isDisponivel).toList();
            case "INDISPONIVEL" -> list.stream().filter(s -> !s.isDisponivel()).toList();
            case "MAIS_USADAS" -> list.stream().sorted(Comparator.comparingInt(Scheme::getLookDoDiaCount).reversed()).toList();
            case "DESTAQUES" -> list.stream().sorted(Comparator.comparing((Scheme s) -> s.getHypeScore() == null ? java.math.BigDecimal.ZERO : s.getHypeScore()).reversed()).limit(12).toList();
            default -> list;
        };
        return list.stream().limit(60).map(s -> Map.<String, Object>of("scheme", schemeService.view(viewer, s, schemeItems.findBySchemeIdOrderBySortOrder(s.getId())),
                "seals", bonds.findBySchemeId(s.getId()).stream().filter(b -> b.getStatus() == SealBondStatus.APPROVED)
                        .map(b -> Map.of("tier", b.getTier().name(), "owner", b.getTargetOwner().getUsername(), "premium",
                                b.getTargetOwner().getProfileType() == ProfileType.CELEBRIDADE)).toList())).toList();
    }

    /** Catálogo (Minhas peças): linha compacta ≤ 18 mm — logo, nome, tipo, tamanho, sexo — e contador de usos em looks. */
    List<Map<String, Object>> catalog(User u, String filter) {
        String f = filter == null ? "" : filter;
        return pieces.findByUserIdOrderByCreatedAtDesc(u.getId()).stream().filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED)
                .filter(w -> f.isBlank() || f.equals(w.getCategory()))
                .map(w -> Map.<String, Object>of("piece", Views.piece(w, null, null), "looks", schemeItems.countByWardrobeItemId(w.getId()),
                        "neverInLook", schemeItems.countByWardrobeItemId(w.getId()) == 0)).toList();
    }

    /** HU12 — acesso à loja: redireciona para o site externo ou informa indisponibilidade. */
    @Transactional(readOnly = true)
    public Map<String, Object> store(String slugOrId) {
        User u = institutionalUser(slugOrId);
        BrandProfile b = brands.findByOwnerId(u.getId()).orElseThrow(() -> ApiException.notFound("Marca"));
        if (b.getStoreUrl() == null || b.getStoreUrl().isBlank()) {
            throw new ApiException(404, "LOJA_INDISPONIVEL", "Esta marca ainda não cadastrou o link da loja.");
        }
        return Map.of("url", b.getStoreUrl(), "external", true, "note", "Sua sessão no Fashion AI continua ativa quando você voltar.");
    }

    /** RF1.CA08 — administrador da marca edita bio, site, logo, capa, categoria. */
    @Transactional
    public Map<String, Object> updateBrand(CurrentUser user, Map<String, String> fields) {
        BrandProfile b = brands.findByOwnerId(user.id()).orElseThrow(() -> guard.deny(user, "brand-profile", "Apenas o perfil da marca pode editar estes dados."));
        if (fields.containsKey("bio")) {
            b.setBio(InputSanitizer.clean(fields.get("bio"), 500));
        }
        if (fields.containsKey("storeUrl")) {
            String url = fields.get("storeUrl");
            if (url != null && !url.isBlank() && !url.matches("^https://.+")) {
                throw ApiException.badRequest("URL_INVALIDA", "O link da loja precisa começar com https://");
            }
            b.setStoreUrl(url);
        }
        if (fields.containsKey("logoUrl")) {
            b.setLogoUrl(fields.get("logoUrl"));
        }
        if (fields.containsKey("coverUrl")) {
            b.setCoverUrl(fields.get("coverUrl"));
        }
        if (fields.containsKey("fashionCategory")) {
            b.setFashionCategory(InputSanitizer.clean(fields.get("fashionCategory"), 60));
        }
        brands.save(b);
        return brandCard(b);
    }

    @Transactional
    public Map<String, Object> updateCelebrity(CurrentUser user, Map<String, Object> fields) {
        CelebrityProfile c = celebrities.findByOwnerId(user.id()).orElseThrow(() -> guard.deny(user, "celebrity-profile", "Apenas o perfil da celebridade pode editar estes dados."));
        if (fields.containsKey("bio")) {
            c.setBio(InputSanitizer.clean(String.valueOf(fields.get("bio")), 500));
        }
        if (fields.containsKey("coverUrl")) {
            c.setCoverUrl(String.valueOf(fields.get("coverUrl")));
        }
        if (fields.get("styleSignature") instanceof Map<?, ?> sig) {
            c.setStyleSignatureJson(Json.write(sig));
        }
        if (fields.containsKey("sealConsentGranted")) {
            c.setSealConsentGranted(Boolean.TRUE.equals(fields.get("sealConsentGranted")));
        }
        celebrities.save(c);
        return celebrityCard(c);
    }
}
