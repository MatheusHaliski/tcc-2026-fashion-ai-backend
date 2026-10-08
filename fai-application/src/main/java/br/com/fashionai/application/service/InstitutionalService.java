package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.local.Similarity;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.CelebrityProfile;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.FollowStatus;
import br.com.fashionai.domain.model.enums.GroupingType;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.ReactionType;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.model.enums.SealStatus;
import br.com.fashionai.domain.model.enums.SealTier;
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

import java.time.Instant;
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
    private final HypeQueryService hype;

    public InstitutionalService(UserRepository users, BrandProfileRepository brands, CelebrityProfileRepository celebrities, FollowRepository follows,
                                SealRepository seals, SealBondRepository bonds, SchemeRepository schemes, SchemeItemRepository schemeItems,
                                WardrobeItemRepository pieces, SavedItemRepository saved, ReactionRepository reactions, SchemeGroupingRepository groupings,
                                StyleDnaRepository dnas, SchemeService schemeService, SealService sealService, AiEngine ai, Guard guard,
                                HypeQueryService hype) {
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
        this.hype = hype;
    }

    // ================================================================== feeds (RF14.CA01/CA02, RF22, RF24.CA06)
    Map<String, Object> brandCard(BrandProfile b) {
        UUID owner = b.getOwner().getId();
        Map<String, Object> m = publicProfile(b.getOwner(), "MARCA", b.getApprovalStatus());
        m.put("slug", b.getSlug());
        m.put("name", b.getBrandName());
        m.put("logoUrl", b.getLogoUrl());
        m.put("coverUrl", b.getCoverUrl());
        m.put("country", b.getCountry());
        m.put("category", b.getFashionCategory());
        m.put("officialHashtag", b.getOfficialHashtag());
        m.put("bio", b.getBio());
        m.put("storeUrl", b.getStoreUrl());
        m.put("status", b.getApprovalStatus() == ApprovalStatus.APROVADO ? "Validada" : b.getApprovalStatus().name());
        m.put("bonds", bonds.countByTargetOwnerIdAndStatus(owner, SealBondStatus.APPROVED));
        m.put("material", "TEXTIL_DOURADO");
        return m;
    }

    Map<String, Object> celebrityCard(CelebrityProfile c) {
        UUID owner = c.getOwner().getId();
        Map<String, Object> m = publicProfile(c.getOwner(), "CELEBRIDADE", c.getVerificationStatus());
        m.put("slug", c.getSlug());
        m.put("name", c.getStageName());
        m.put("avatarUrl", c.getAvatarUrl());
        m.put("coverUrl", c.getCoverUrl());
        m.put("country", c.getOwner().getCountry());
        m.put("areas", Json.strings(c.getAreasJson()));
        m.put("bio", c.getBio());
        // Não há loja no cadastro da celebridade; o link de verificação não é um link comercial público.
        m.put("storeUrl", null);
        m.put("status", c.getVerificationStatus() == ApprovalStatus.APROVADO ? "Verificada" : c.getVerificationStatus().name());
        m.put("bonds", bonds.countByTargetOwnerIdAndStatus(owner, SealBondStatus.APPROVED));
        m.put("styleSignature", Json.map(c.getStyleSignatureJson()));
        m.put("material", "VITREO_HOLOGRAFICO");
        return m;
    }

    /** Projeção pública compartilhada pelo feed e pelo header; dados da análise e métricas administrativas ficam fora. */
    private Map<String, Object> publicProfile(User owner, String kind, ApprovalStatus approval) {
        UUID id = owner.getId();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("userId", id);
        m.put("username", owner.getUsername());
        m.put("userAvatarUrl", owner.getAvatarUrl());
        m.put("kind", kind);
        m.put("verified", approval == ApprovalStatus.APROVADO || owner.isVerified());
        m.put("privateAccount", owner.isPrivateAccount());
        m.put("visibility", owner.getProfileVisibility() != null ? owner.getProfileVisibility().name()
                : owner.isPrivateAccount() ? "PRIVATE" : "PUBLIC");
        m.put("followers", follows.countByFollowingIdAndStatus(id, FollowStatus.ACEITO));
        m.put("following", follows.countByFollowerIdAndStatus(id, FollowStatus.ACEITO));
        m.put("pieces", pieces.countByUserIdAndAvailabilityStatusNot(id, AvailabilityStatus.ARCHIVED));
        m.put("schemes", schemes.countByUserIdAndStatusNot(id, SchemeStatus.ARCHIVED));
        m.put("activeSeals", seals.countByOwnerIdAndStatus(id, SealStatus.ACTIVE));
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

    /** Ordens dos feeds de /brands: afinidade com o DNA, mais recentes e "Em alta" (Hype agregado público, P2-05). */
    static final List<String> FEED_ORDERS = List.of("AFINIDADE", "RECENTES", "EM_ALTA");

    @Transactional(readOnly = true)
    public Map<String, Object> brandFeed(CurrentUser viewer, String term, String order) {
        List<BrandProfile> list = brands.findByApprovalStatusOrderByCreatedAtDesc(ApprovalStatus.APROVADO).stream()
                .filter(b -> term == null || term.isBlank() || b.getBrandName().toLowerCase(Locale.ROOT).contains(term.trim().toLowerCase(Locale.ROOT))).toList();
        Set<String> styles = viewer == null ? new HashSet<>() : dnas.findByUserId(viewer.id()).map(d -> new HashSet<>(Json.csv(d.getStyleKeywords()))).orElse(new HashSet<>());
        boolean hypeOrder = "EM_ALTA".equalsIgnoreCase(order);
        boolean affinityOrder = !hypeOrder && !"RECENTES".equalsIgnoreCase(order) && !styles.isEmpty();
        // RF53 · P2-05: o Hype agregado da marca (peças públicas com o nome da marca, ≥ 3 itens) em todo card, numa leitura só
        Map<String, Object> hypeByKey = feedHype(viewer, HypeQueryService.RankGroup.BRAND, list.stream().map(b -> HypeQueryService.brandKey(b.getBrandName())).toList());
        List<Map<String, Object>> cards = new ArrayList<>();
        for (BrandProfile b : list) {
            Map<String, Object> m = brandCard(b);
            if (affinityOrder) {
                m.put("affinity", Math.round(affinity(styles, b.getOwner().getId()) * 100));
            }
            m.put("hype", hypeByKey.get(HypeQueryService.brandKey(b.getBrandName())));
            cards.add(m);
        }
        if (affinityOrder) {
            ai.local(viewer.id(), AiCapability.AFFINITY, List.of(Msg.t("institutional.estilos_do_seu_dna"), Msg.t("institutional.estilos_do_catalogo_das_marcas")), () -> cards.size());
            cards.sort(Comparator.comparingLong((Map<String, Object> m) -> ((Number) m.get("affinity")).longValue()).reversed());
        } else if (hypeOrder) {
            cards.sort(BY_GROUP_HYPE);
        }
        return Map.of("brands", cards, "order", hypeOrder ? "EM_ALTA" : affinityOrder ? "AFINIDADE" : "RECENTES", "orders", FEED_ORDERS,
                "empty", cards.isEmpty() ? (term == null ? Msg.t("institutional.nenhuma_marca_validada_ainda") : Msg.t("institutional.nenhuma_marca_encontrada_para", term)) : "");
    }

    @Transactional(readOnly = true)
    public Map<String, Object> celebrityFeed(CurrentUser viewer, String term, String order) {
        List<CelebrityProfile> list = celebrities.findByVerificationStatusOrderByCreatedAtDesc(ApprovalStatus.APROVADO).stream()
                .filter(c -> term == null || term.isBlank() || c.getStageName().toLowerCase(Locale.ROOT).contains(term.trim().toLowerCase(Locale.ROOT))).toList();
        Set<String> styles = viewer == null ? new HashSet<>() : dnas.findByUserId(viewer.id()).map(d -> new HashSet<>(Json.csv(d.getStyleKeywords()))).orElse(new HashSet<>());
        boolean hypeOrder = "EM_ALTA".equalsIgnoreCase(order);
        boolean affinityOrder = !hypeOrder && !"RECENTES".equalsIgnoreCase(order) && !styles.isEmpty();
        // celebridade = criadora: o agregado CREATOR das peças e looks públicos dela (bloqueio entre quem vê e ela = sem Hype)
        Map<String, Object> hypeByKey = feedHype(viewer, HypeQueryService.RankGroup.CREATOR, list.stream().map(c -> c.getOwner().getId().toString()).toList());
        List<Map<String, Object>> cards = new ArrayList<>();
        for (CelebrityProfile c : list) {
            Map<String, Object> m = celebrityCard(c);
            if (affinityOrder) {
                m.put("affinity", Math.round(affinity(styles, c.getOwner().getId()) * 100));
            }
            m.put("hype", hypeByKey.get(c.getOwner().getId().toString()));
            cards.add(m);
        }
        if (affinityOrder) {
            cards.sort(Comparator.comparingLong((Map<String, Object> m) -> ((Number) m.get("affinity")).longValue()).reversed());
        } else if (hypeOrder) {
            cards.sort(BY_GROUP_HYPE);
        }
        return Map.of("celebrities", cards, "order", hypeOrder ? "EM_ALTA" : affinityOrder ? "AFINIDADE" : "RECENTES", "orders", FEED_ORDERS);
    }

    /** Agregados do Hype por chave ({@link HypeQueryService#groups}); falha ou sem serviço = sem Hype (o feed nunca quebra). */
    @SuppressWarnings("unchecked")
    Map<String, Object> feedHype(CurrentUser viewer, HypeQueryService.RankGroup group, List<String> keys) {
        if (hype == null || keys.isEmpty()) {
            return Map.of();
        }
        Map<String, Object> out = hype.groups(viewer, group, keys, 7);
        return out != null && out.get("items") instanceof Map<?, ?> items ? (Map<String, Object>) items : Map.of();
    }

    /**
     * "Em alta" (P2-05): grupos suficientes primeiro, do maior Hype agregado para o menor; quem não tem base (menos de 3
     * itens públicos, bloqueio, sem dado) fica depois, na ordem recente — nunca vira 0. Sort estável.
     */
    static final Comparator<Map<String, Object>> BY_GROUP_HYPE = Comparator.comparing(
            (Map<String, Object> m) -> m.get("hype") instanceof Map<?, ?> h && Boolean.TRUE.equals(h.get("sufficient")) && h.get("value") instanceof Number n
                    ? n.doubleValue() : null, Comparator.nullsLast(Comparator.reverseOrder()));

    // ================================================================== perfil institucional (artefato #11)
    User institutionalUser(String slugOrId) {
        User u;
        try {
            u = users.findById(UUID.fromString(slugOrId)).orElse(null);
        } catch (IllegalArgumentException ex) {
            u = brands.findBySlug(slugOrId).map(BrandProfile::getOwner).orElseGet(() -> celebrities.findBySlug(slugOrId).map(CelebrityProfile::getOwner)
                    .orElseGet(() -> users.findByUsernameIgnoreCase(slugOrId).orElse(null)));
        }
        if (u == null || u.getProfileType() == ProfileType.PESSOAL) {
            throw ApiException.notFound(Msg.t("institutional.perfil_institucional"));
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
            if (b.getApprovalStatus() != ApprovalStatus.APROVADO && !admin && (viewer == null || !viewer.admin())) {
                throw ApiException.notFound("Marca"); // RF1.CA06 — pendente_validação não tem tela pública
            }
            header.putAll(brandCard(b));
            header.put("coverLabel", groupings.findByOwnerIdAndType(u.getId(), GroupingType.COLLECTION).stream().findFirst().map(g -> g.getLabel()).orElse(null));
            header.put("autoApproval", !b.isRequiresSealReview());
        } else {
            CelebrityProfile c = celebrities.findByOwnerId(u.getId()).orElseThrow(() -> ApiException.notFound("Celebridade"));
            if (c.getVerificationStatus() != ApprovalStatus.APROVADO && !admin && (viewer == null || !viewer.admin())) {
                throw ApiException.notFound("Celebridade");
            }
            header.putAll(celebrityCard(c));
            header.put("coverLabel", groupings.findByOwnerIdAndType(u.getId(), GroupingType.ERA).stream().findFirst().map(g -> g.getLabel()).orElse(null));
            header.put("autoApproval", false);
            header.put("autoApprovalLocked", Msg.t("institutional.todo_vinculo_com_celebridade_exige"));
        }
        header.put("viewerFollows", viewer != null && follows.findByFollowerIdAndFollowingId(viewer.id(), u.getId()).map(f -> f.getStatus() == FollowStatus.ACEITO).orElse(false));
        header.put("metrics", metrics(u.getId()));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("header", header);
        out.put("mode", admin ? "ADMINISTRADOR" : "VISITANTE");
        out.put("tabs", admin ? List.of("CADASTRAR_SELO", "MEUS_SELOS", "MEUS_ESQUEMAS", "MINHAS_PECAS", "ESQUEMAS_SALVOS", "PECAS_SALVAS")
                : List.of("PROMOCOES", "LOOKS_CONSAGRADOS", "CATALOGO"));
        if (admin) {
            int pending = bonds.findByTargetOwnerIdAndStatusOrderByCreatedAtAsc(u.getId(), SealBondStatus.PENDING_REVIEW).size();
            out.put("reviewBanner", pending == 0 ? null : Msg.t("institutional.vinculo_s_aguardando_sua_revisao", (pending)));
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
            throw guard.deny(viewer, "institutional-tab:" + t, Msg.t("institutional.esta_aba_e_do_administrador"));
        }
        return switch (t) {
            case "CADASTRAR_SELO" -> Map.of("tiers", List.of("PECA", "LOOK"), "premium", u.getProfileType() == ProfileType.CELEBRIDADE,
                    "autoApprovalLocked", u.getProfileType() == ProfileType.CELEBRIDADE, "campaignCapRequired", u.getProfileType() == ProfileType.CELEBRIDADE,
                    "centerEmpty", Msg.t("institutional.o_centro_do_selo_recebe"));
            case "MEUS_SELOS" -> Map.of("seals", sealService.sealsOf(u.getId()), "reviewQueue", sealService.reviewQueue(viewer), "metrics", sealService.issuerMetrics(viewer));
            case "MEUS_ESQUEMAS", "LOOKS_CONSAGRADOS" -> consecrated(viewer, u, filter, groupingId, admin);
            case "MINHAS_PECAS", "CATALOGO" -> catalog(viewer, u, filter, admin);
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
            // Peças e esquemas em abas separadas (RF14/RF22): cada aba devolve só um tipo de conteúdo.
            case "ESQUEMAS_DESTAQUE" -> highlightedSchemes(viewer, u, filter, groupingId);
            case "PECAS_DESTAQUE" -> highlightedPieces(viewer, u, filter, groupingId);
            case "DESTAQUES", "ESQUEMAS_PECAS_DESTAQUE" -> highlighted(viewer, u, filter, groupingId);
            default -> throw ApiException.badRequest("ABA_INVALIDA", Msg.t("institutional.aba_desconhecida"));
        };
    }

    // ================================================================== política de exibição (RF14/RF22 × RF20/RF21/RF50)
    /*
     * O que o perfil de uma marca/celebridade mostra de conteúdo de OUTROS usuários é o que passou pela política do selo:
     * vínculo APPROVED (política atendida + aceite de quem criou o look + revisão do emissor quando exigida). Nunca entram
     * vínculos SUGGESTED, ACCEPTED/EDITED (ainda não roteados), PENDING_REVIEW, REFUSED, REJECTED ou REVOKED.
     *
     * - "Esquemas em destaque": vínculo APPROVED VIGENTE (sem expiresAt ou expiresAt no futuro), look publicado, sem
     *   revalidação pendente (RF9.CA05: a lista de peças mudou depois da aprovação e o emissor ainda não revalidou),
     *   visível para quem vê (visibilidade do look × privacidade do perfil × bloqueio) e autor com conta ativa. Ordem:
     *   HypeScore v2 atual do look (sem score = no fim) e, no empate, a emissão mais recente.
     * - "Looks consagrados": o histórico de conquistas — mesmos filtros de visibilidade, mas inclui vínculos expirados
     *   (marcados {@code expired}) e looks em revalidação (marcados {@code revalidationPending}). Ordem: emissão mais recente.
     * - "Peças em destaque": peças dos looks em destaque. Selo de PEÇA destaca só as peças vinculadas (linkedPieceIds);
     *   selo de LOOK destaca todas. Cada peça leva só os selos que a cobrem. Peça arquivada, fora da moderação APPROVED,
     *   invisível para quem vê ou de autor suspenso fica de fora (o look pode ser público com uma peça privada).
     * - "Catálogo": o próprio acervo do perfil; o visitante vê só peças aprovadas na moderação e visíveis para ele, o
     *   administrador do perfil vê tudo (menos arquivadas).
     * Selo desativado (SealStatus.INACTIVE) só impede novas emissões: o que já foi emitido vale até expirar.
     */
    static final Set<AccountStatus> HIDDEN_AUTHORS = Set.of(AccountStatus.SUSPENDED, AccountStatus.DELETION_SCHEDULED, AccountStatus.DELETED);
    static final int DESTAQUES_LIMIT = 12;
    static final int TAB_LIMIT = 60;

    /** Look promovido no perfil por um ou mais vínculos aprovados do emissor. */
    record Promoted(Scheme scheme, List<SealBond> bonds, Instant issuedAt, Instant expiresAt, boolean expired, boolean revalidationPending) {
    }

    static boolean expired(SealBond b, Instant now) {
        return b.getExpiresAt() != null && !b.getExpiresAt().isAfter(now);
    }

    /** Look de outra pessoa pode aparecer no perfil (publicado, autor ativo, visível para quem vê)? */
    boolean displayable(CurrentUser viewer, Scheme s) {
        return s.getStatus() == SchemeStatus.PUBLISHED && s.getUser() != null && !HIDDEN_AUTHORS.contains(s.getUser().getStatus())
                && schemeService.canView(viewer, s);
    }

    /** Peça de um look promovido pode aparecer (não arquivada, aprovada na moderação, visível, autor ativo)? */
    boolean displayable(CurrentUser viewer, WardrobeItem w) {
        return w != null && w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED && w.getModerationStatus() == ModerationStatus.APPROVED
                && w.getUser() != null && !HIDDEN_AUTHORS.contains(w.getUser().getStatus())
                && guard.canView(viewer, w.getUser().getId(), WardrobeService.effectiveVisibility(w));
    }

    /**
     * Looks promovidos pelo perfil {@code u}, um por look (vários selos do mesmo emissor no mesmo look viram uma entrada).
     * {@code history = false}: só vigentes e sem revalidação pendente ("Esquemas em destaque"); {@code true}: inclui
     * expirados e em revalidação ("Looks consagrados").
     */
    List<Promoted> promoted(CurrentUser viewer, User u, boolean history, Instant now) {
        Map<UUID, List<SealBond>> byScheme = new LinkedHashMap<>();
        for (SealBond b : bonds.findByTargetOwnerIdAndStatusOrderByCreatedAtDesc(u.getId(), SealBondStatus.APPROVED)) {
            if (b.getScheme() != null && b.getStatus() == SealBondStatus.APPROVED) {
                byScheme.computeIfAbsent(b.getScheme().getId(), k -> new ArrayList<>()).add(b);
            }
        }
        List<Promoted> out = new ArrayList<>();
        for (List<SealBond> list : byScheme.values()) {
            Scheme s = list.get(0).getScheme();
            if (!displayable(viewer, s)) {
                continue;
            }
            List<SealBond> valid = list.stream().filter(b -> !expired(b, now)).toList();
            boolean isExpired = valid.isEmpty();
            if (!history && (isExpired || s.isRevalidationPending())) {
                continue;
            }
            List<SealBond> shown = isExpired ? list : valid;
            Instant issued = shown.stream().map(b -> b.getIssuedAt() != null ? b.getIssuedAt() : b.getCreatedAt()).filter(Objects::nonNull)
                    .max(Comparator.naturalOrder()).orElse(null);
            Instant expires = shown.stream().map(SealBond::getExpiresAt).filter(Objects::nonNull).max(Comparator.naturalOrder()).orElse(null);
            out.add(new Promoted(s, shown, issued, expires, isExpired, s.isRevalidationPending()));
        }
        List<Scheme> profileEligible = sealService.profileSchemes(u.getId(), s -> displayable(viewer, s), TAB_LIMIT);
        if (!history && sealService.hasProfilePolicies(u.getId())) {
            Set<UUID> eligibleIds = profileEligible.stream().map(Scheme::getId).collect(Collectors.toSet());
            out.removeIf(p -> !eligibleIds.contains(p.scheme().getId()));
        }
        Set<UUID> present = out.stream().map(p -> p.scheme().getId()).collect(Collectors.toSet());
        for (Scheme scheme : profileEligible) {
            if (present.add(scheme.getId())) out.add(new Promoted(scheme, List.of(), null, null, false, false));
        }
        Comparator<Promoted> byIssued = Comparator.comparing(Promoted::issuedAt, Comparator.nullsLast(Comparator.reverseOrder()));
        if (history) {
            out.sort(byIssued);
        } else {
            Map<UUID, HypeScoreCurrent> hype = hypeOf(out.stream().map(p -> p.scheme().getId()).toList());
            out.sort(Comparator.comparing((Promoted p) -> lookHype(hype, p.scheme().getId()), Comparator.nullsLast(Comparator.reverseOrder())).thenComparing(byIssued));
        }
        return out;
    }

    /** HypeScore v2 atual dos looks (só AVAILABLE conta para a ordem; o resto vai para o fim). */
    Map<UUID, HypeScoreCurrent> hypeOf(List<UUID> schemeIds) {
        return schemeIds.isEmpty() ? Map.of() : hype.currentOf(HypeEntityType.SCHEME, schemeIds);
    }

    static Double lookHype(Map<UUID, HypeScoreCurrent> hype, UUID schemeId) {
        return lookHype(hype, schemeId, false);
    }

    /**
     * Score que pode ordenar: AVAILABLE com score. Em contexto de terceiros (destaques de looks de outras pessoas), só o
     * Hype público elegível — o de look privado ou só para seguidores é pessoal, do dono (auditoria §3.1); sem ele, o look
     * vai para o fim, nunca vira 0. {@code personal} = o próprio dono ordenando os próprios looks.
     */
    static Double lookHype(Map<UUID, HypeScoreCurrent> hype, UUID schemeId, boolean personal) {
        HypeScoreCurrent c = hype.get(schemeId);
        return c == null || c.getStatus() != HypeStatus.AVAILABLE || c.getScore() == null || (!personal && !c.isPublicEligible())
                ? null : c.getScore().doubleValue();
    }

    /** Crescimento (P3-17): a dimensão TREND do Hype v2 (janela atual × anterior) — crescimento, não volume nem curtidas. */
    static Double lookGrowth(Map<UUID, HypeScoreCurrent> hype, UUID schemeId, boolean personal) {
        if (lookHype(hype, schemeId, personal) == null) {
            return null;
        }
        HypeScoreCurrent c = hype.get(schemeId);
        return c.getDimensions() == null || c.getDimensions().getTrend() == null ? null : c.getDimensions().getTrend().doubleValue();
    }

    static Double lookDelta(Map<UUID, HypeScoreCurrent> hype, UUID schemeId) {
        HypeScoreCurrent c = hype.get(schemeId);
        return c == null || c.getDeltaPoints() == null ? null : c.getDeltaPoints().doubleValue();
    }

    /** Looks consagrados: o histórico (ou, para o administrador, os próprios looks); filtros de era, disponibilidade, uso e Hype. */
    List<Map<String, Object>> consecrated(CurrentUser viewer, User u, String filter, UUID groupingId, boolean admin) {
        if (admin) {
            List<Scheme> own = schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(u.getId(), SchemeStatus.ARCHIVED);
            return filterLooks(own.stream().map(s -> new Promoted(s, bonds.findBySchemeId(s.getId()).stream()
                    .filter(b -> b.getStatus() == SealBondStatus.APPROVED).toList(), null, null, false, s.isRevalidationPending())).toList(), filter, groupingId, true)
                    .stream().map(p -> entry(viewer, p)).toList();
        }
        return filterLooks(promoted(viewer, u, true, Instant.now()), filter, groupingId).stream().map(p -> entry(viewer, p)).toList();
    }

    /**
     * Abas "Esquemas em destaque" e "Peças em destaque": looks de qualquer usuário que conquistaram um selo deste perfil
     * por política aceita (vínculo APPROVED vigente) e as peças que esses selos destacam. Vale igual para o dono do perfil
     * e para visitantes: destaque é o que passou pela política do selo.
     */
    List<Map<String, Object>> highlightedSchemes(CurrentUser viewer, User u, String filter, UUID groupingId) {
        return filterLooks(promoted(viewer, u, false, Instant.now()), filter, groupingId).stream().map(p -> entry(viewer, p)).toList();
    }

    /** Peças que os selos vigentes destacam (cada peça aponta para o look e traz só os selos que a cobrem). */
    List<Map<String, Object>> highlightedPieces(CurrentUser viewer, User u, String filter, UUID groupingId) {
        return withProfilePieces(viewer, u, pieceEntries(viewer, filterLooks(promoted(viewer, u, false, Instant.now()), filter, groupingId)), filter, groupingId);
    }

    private List<Map<String, Object>> withProfilePieces(CurrentUser viewer, User owner, List<Map<String, Object>> existing,
                                                      String filter, UUID groupingId) {
        List<WardrobeItem> eligible = sealService.profilePieces(owner.getId(), piece -> displayable(viewer, piece), TAB_LIMIT);
        Set<UUID> eligibleIds = eligible.stream().map(WardrobeItem::getId).collect(Collectors.toSet());
        List<Map<String, Object>> out = new ArrayList<>(existing);
        if (sealService.hasProfilePolicies(owner.getId())) out.removeIf(e -> !eligibleIds.contains(((Views.PieceView) e.get("piece")).id()));
        // Agrupamentos e filtros de look não se aplicam a peças avulsas.
        if (groupingId != null || filter != null && !filter.isBlank() && !Set.of("ALL", "RECENT", "RECENTES", "DESTAQUES", "HYPE", "GROWTH", "CRESCIMENTO").contains(filter.toUpperCase(Locale.ROOT))) return out;
        Set<Object> ids = out.stream().map(e -> ((Views.PieceView) e.get("piece")).id()).collect(Collectors.toSet());
        for (WardrobeItem w : eligible) {
            if (!ids.add(w.getId()) || out.size() >= TAB_LIMIT) continue;
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("piece", Views.piece(w, null, null)); entry.put("seals", List.of());
            entry.put("author", Views.user(w.getUser())); entry.put("schemeId", null);
            entry.put("profilePolicy", true); out.add(entry);
        }
        return out;
    }

    /** Legado: as duas listas juntas (mantido para compatibilidade da API; a interface usa as abas separadas). */
    Map<String, Object> highlighted(CurrentUser viewer, User u, String filter, UUID groupingId) {
        List<Promoted> looks = filterLooks(promoted(viewer, u, false, Instant.now()), filter, groupingId);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("schemes", looks.stream().map(p -> entry(viewer, p)).toList());
        out.put("pieces", withProfilePieces(viewer, u, pieceEntries(viewer, looks), filter, groupingId));
        out.put("empty", looks.isEmpty() ? Msg.t("institutional.nenhum_look_conquistou_um_selo") : null);
        return out;
    }

    /** Filtros das abas de looks de outras pessoas (destaques e consagrados): o Hype que ordena é só o público elegível. */
    List<Promoted> filterLooks(List<Promoted> list, String filter, UUID groupingId) {
        return filterLooks(list, filter, groupingId, false);
    }

    /**
     * Filtros e ordenações das abas de looks: era/fase/temporada ({@code groupingId}), disponível/indisponível, mais usadas,
     * destaques (Hype v2) e — P3-17, o SegmentPicker "Recentes · Hype · Em crescimento" da interface (ordenação, não aba):
     * RECENTES (emissão mais recente), HYPE (HypeScore v2, sem score no fim) e GROWTH (dimensão TREND do v2 —
     * crescimento, não volume —, empate pelo Δ; sem Hype no fim). Nada sai da lista nessas três: só muda a ordem, e a
     * política de exibição (quem entra) continua a de {@link #promoted}. Sort estável: o empate mantém a ordem anterior.
     */
    List<Promoted> filterLooks(List<Promoted> list, String filter, UUID groupingId, boolean personal) {
        if (groupingId != null) {
            list = list.stream().filter(p -> groupingId.equals(p.scheme().getGroupingId())).toList();
        }
        String f = filter == null ? "" : filter.toUpperCase(Locale.ROOT);
        return switch (f) {
            case "DISPONIVEL" -> list.stream().filter(p -> p.scheme().isDisponivel()).toList();
            case "INDISPONIVEL" -> list.stream().filter(p -> !p.scheme().isDisponivel()).toList();
            case "MAIS_USADAS" -> list.stream().sorted(Comparator.comparingInt((Promoted p) -> p.scheme().getLookDoDiaCount()).reversed()).toList();
            case "DESTAQUES" -> {
                Map<UUID, HypeScoreCurrent> h = hypeOf(list.stream().map(p -> p.scheme().getId()).toList());
                yield list.stream().filter(p -> lookHype(h, p.scheme().getId(), personal) != null)
                        .sorted(Comparator.comparing((Promoted p) -> lookHype(h, p.scheme().getId(), personal), Comparator.reverseOrder()))
                        .limit(DESTAQUES_LIMIT).toList();
            }
            case "RECENTES", "RECENT" -> list.stream().sorted(Comparator.comparing((Promoted p) -> p.issuedAt() != null ? p.issuedAt() : p.scheme().getCreatedAt(),
                    Comparator.nullsLast(Comparator.reverseOrder()))).toList();
            case "HYPE" -> {
                Map<UUID, HypeScoreCurrent> h = hypeOf(list.stream().map(p -> p.scheme().getId()).toList());
                yield list.stream().sorted(Comparator.comparing((Promoted p) -> lookHype(h, p.scheme().getId(), personal),
                        Comparator.nullsLast(Comparator.reverseOrder()))).toList();
            }
            case "GROWTH", "CRESCIMENTO" -> {
                Map<UUID, HypeScoreCurrent> h = hypeOf(list.stream().map(p -> p.scheme().getId()).toList());
                yield list.stream().sorted(Comparator.comparing((Promoted p) -> lookGrowth(h, p.scheme().getId(), personal), Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(p -> lookGrowth(h, p.scheme().getId(), personal) == null ? null : lookDelta(h, p.scheme().getId()),
                                Comparator.nullsLast(Comparator.reverseOrder()))).toList();
            }
            default -> list;
        };
    }

    Map<String, Object> entry(CurrentUser viewer, Promoted p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("scheme", schemeService.view(viewer, p.scheme(), schemeItems.findBySchemeIdOrderBySortOrder(p.scheme().getId())));
        m.put("seals", p.bonds().stream().map(SealService::badge).toList());
        Map<String, Object> promotion = new LinkedHashMap<>();
        promotion.put("profilePolicy", p.bonds().isEmpty());
        promotion.put("issuedAt", p.issuedAt());
        promotion.put("expiresAt", p.expiresAt());
        promotion.put("expired", p.expired());
        promotion.put("revalidationPending", p.revalidationPending());
        m.put("promotion", promotion);
        return m;
    }

    /** Peças em destaque: selo de PEÇA cobre só as peças vinculadas; selo de LOOK cobre todas as peças do look. */
    List<Map<String, Object>> pieceEntries(CurrentUser viewer, List<Promoted> looks) {
        Map<UUID, Map<String, Object>> out = new LinkedHashMap<>();
        for (Promoted p : looks) {
            for (SchemeItem si : schemeItems.findBySchemeIdOrderBySortOrder(p.scheme().getId())) {
                WardrobeItem w = si.getWardrobeItem();
                if (!displayable(viewer, w)) {
                    continue;
                }
                List<SealBond> covering = p.bonds().stream().filter(b -> covers(b, w.getId())).toList();
                if (covering.isEmpty()) {
                    continue;
                }
                List<Map<String, Object>> badges = covering.stream().map(SealService::badge).toList();
                Map<String, Object> existing = out.get(w.getId());
                if (existing != null) {
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> seals = new ArrayList<>((List<Map<String, Object>>) existing.get("seals"));
                    badges.stream().filter(b -> !seals.contains(b)).forEach(seals::add);
                    existing.put("seals", seals);
                    continue;
                }
                if (out.size() >= TAB_LIMIT) {
                    continue;
                }
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("piece", Views.piece(w, null, null));
                m.put("author", Views.user(w.getUser()));
                m.put("schemeId", p.scheme().getId());
                m.put("schemeTitle", p.scheme().getTitle());
                m.put("seals", badges);
                out.put(w.getId(), m);
            }
        }
        return new ArrayList<>(out.values());
    }

    /** O vínculo destaca esta peça? LOOK: todas as peças do look; PECA: só as vinculadas (sem lista = todas, legado). */
    static boolean covers(SealBond b, UUID pieceId) {
        if (b.getTier() != SealTier.PECA) {
            return true;
        }
        List<String> linked = Json.strings(b.getLinkedPieceIdsJson());
        return linked.isEmpty() || linked.contains(pieceId.toString());
    }

    /** Catálogo (Minhas peças): linha compacta ≤ 18 mm — logo, nome, tipo, tamanho, sexo — e contador de usos em looks. */
    List<Map<String, Object>> catalog(CurrentUser viewer, User u, String filter, boolean admin) {
        String f = filter == null ? "" : filter;
        return pieces.findByUserIdOrderByCreatedAtDesc(u.getId()).stream().filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED)
                .filter(w -> admin || (w.getModerationStatus() == ModerationStatus.APPROVED
                        && guard.canView(viewer, u.getId(), WardrobeService.effectiveVisibility(w))))
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
            throw new ApiException(404, "LOJA_INDISPONIVEL", Msg.t("institutional.esta_marca_ainda_nao_cadastrou"));
        }
        return Map.of("url", b.getStoreUrl(), "external", true, "note", Msg.t("institutional.sua_sessao_no_fashion_ai"));
    }

    /** RF1.CA08 — administrador da marca edita bio, site, logo, capa, categoria. */
    @Transactional
    public Map<String, Object> updateBrand(CurrentUser user, Map<String, String> fields) {
        BrandProfile b = brands.findByOwnerId(user.id()).orElseThrow(() -> guard.deny(user, "brand-profile", Msg.t("institutional.apenas_o_perfil_da_marca")));
        if (fields.containsKey("bio")) {
            b.setBio(InputSanitizer.clean(fields.get("bio"), 500));
        }
        if (fields.containsKey("storeUrl")) {
            String url = fields.get("storeUrl");
            if (url != null && !url.isBlank() && !url.matches("^https://.+")) {
                throw ApiException.badRequest("URL_INVALIDA", Msg.t("institutional.o_link_da_loja_precisa"));
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
        CelebrityProfile c = celebrities.findByOwnerId(user.id()).orElseThrow(() -> guard.deny(user, "celebrity-profile", Msg.t("institutional.apenas_o_perfil_da_celebridade")));
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
