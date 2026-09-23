package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.local.LocalAdvisors;
import br.com.fashionai.application.ai.local.Similarity;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.ports.SearchIndexPort;
import br.com.fashionai.application.ports.TimelineProjectionPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.Share;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.FollowStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.model.enums.ShareChannel;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.FollowRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.SealBondRepository;
import br.com.fashionai.domain.repository.ShareRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
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
import java.util.stream.Collectors;

/**
 * RF8 — Buscar/Explorar: feed comunitário por relevância e recência (CA01), busca segmentada em Looks, Peças, Pessoas,
 * Marcas e Celebridades (CA02), filtros combináveis em chips (CA03), sugestões quando vazio (CA04), nunca conteúdo
 * privado ou bloqueado (CA05) e paginação por cursor sem duplicar (CA06). Inclui The Runway (feed de quem se segue,
 * compartilhamentos no feed interno, vínculos das marcas seguidas) e a vitrine de Peças Públicas.
 */
@Service
public class SearchService {
    public static final List<String> TABS = List.of("LOOKS", "PECAS", "PESSOAS", "MARCAS", "CELEBRIDADES");

    public record Filters(String style, String occasion, String color, String brand, String category) {
        boolean empty() {
            return blank(style) && blank(occasion) && blank(color) && blank(brand) && blank(category);
        }

        static boolean blank(String s) {
            return s == null || s.isBlank();
        }

        List<Map<String, String>> chips() {
            List<Map<String, String>> out = new ArrayList<>();
            if (!blank(style)) {
                out.add(Map.of("key", "style", "value", style));
            }
            if (!blank(occasion)) {
                out.add(Map.of("key", "occasion", "value", occasion));
            }
            if (!blank(color)) {
                out.add(Map.of("key", "color", "value", color));
            }
            if (!blank(brand)) {
                out.add(Map.of("key", "brand", "value", brand));
            }
            if (!blank(category)) {
                out.add(Map.of("key", "category", "value", category));
            }
            return out;
        }
    }

    /** Cursor opaco: instante de publicação + id do último item (ordem estável, sem duplicar — CA06). */
    record Cursor(Instant at, UUID id) {
        static Cursor parse(String raw) {
            if (raw == null || raw.isBlank()) {
                return null;
            }
            try {
                String[] p = new String(Base64.getUrlDecoder().decode(raw), StandardCharsets.UTF_8).split("\\|");
                return new Cursor(Instant.parse(p[0]), UUID.fromString(p[1]));
            } catch (RuntimeException ex) {
                throw ApiException.badRequest("CURSOR_INVALIDO", "Cursor de paginação inválido.");
            }
        }

        String encode() {
            return Base64.getUrlEncoder().withoutPadding().encodeToString((at + "|" + id).getBytes(StandardCharsets.UTF_8));
        }

        boolean before(Instant t, UUID other) {
            int c = t.compareTo(at);
            return c < 0 || (c == 0 && other.compareTo(id) < 0);
        }
    }

    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final WardrobeItemRepository pieces;
    private final UserRepository users;
    private final BrandProfileRepository brands;
    private final CelebrityProfileRepository celebrities;
    private final FollowRepository follows;
    private final ShareRepository shares;
    private final SealBondRepository bonds;
    private final StyleDnaRepository dnas;
    private final ObjectProvider<SearchIndexPort> searchIndex;
    private final ObjectProvider<TimelineProjectionPort> timeline;
    private final SchemeService schemeService;
    private final ChallengeService challenges;
    private final Guard guard;

    public SearchService(SchemeRepository schemes, SchemeItemRepository schemeItems, WardrobeItemRepository pieces, UserRepository users,
                         BrandProfileRepository brands, CelebrityProfileRepository celebrities, FollowRepository follows, ShareRepository shares,
                         SealBondRepository bonds, StyleDnaRepository dnas, ObjectProvider<SearchIndexPort> searchIndex,
                         ObjectProvider<TimelineProjectionPort> timeline, SchemeService schemeService, ChallengeService challenges, Guard guard) {
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.pieces = pieces;
        this.users = users;
        this.brands = brands;
        this.celebrities = celebrities;
        this.follows = follows;
        this.shares = shares;
        this.bonds = bonds;
        this.dnas = dnas;
        this.searchIndex = searchIndex;
        this.timeline = timeline;
        this.schemeService = schemeService;
        this.challenges = challenges;
        this.guard = guard;
    }

    // ================================================================== visibilidade (CA05)
    Set<UUID> blockedFor(UUID viewerId) {
        Set<UUID> out = new HashSet<>();
        if (viewerId == null) {
            return out;
        }
        follows.findByFollowingIdAndStatus(viewerId, FollowStatus.BLOQUEADO).forEach(f -> out.add(f.getFollower().getId()));
        follows.findByFollowerIdAndStatus(viewerId, FollowStatus.BLOQUEADO).forEach(f -> out.add(f.getFollowing().getId()));
        return out;
    }

    boolean visible(CurrentUser viewer, Scheme s, Set<UUID> blocked) {
        return !blocked.contains(s.getUser().getId()) && s.getUser().getStatus() == AccountStatus.ACTIVE && schemeService.canView(viewer, s);
    }

    boolean visible(CurrentUser viewer, WardrobeItem w, Set<UUID> blocked) {
        return !blocked.contains(w.getUser().getId()) && w.getUser().getStatus() == AccountStatus.ACTIVE
                && w.getModerationStatus() == ModerationStatus.APPROVED
                && guard.canView(viewer, w.getUser().getId(), SchemeService.moreRestrictive(w.getVisibility(), w.getUser().getProfileVisibility()));
    }

    static boolean matches(Filters f, Scheme s, List<SchemeItem> items) {
        if (f == null || f.empty()) {
            return true;
        }
        if (!Filters.blank(f.style()) && !Json.csv(s.getStyle()).contains(f.style())) {
            return false;
        }
        if (!Filters.blank(f.occasion()) && !Json.csv(s.getOccasion()).contains(f.occasion())) {
            return false;
        }
        if (!Filters.blank(f.color()) && items.stream().noneMatch(si -> f.color().equals(si.getWardrobeItem().getColor()))) {
            return false;
        }
        if (!Filters.blank(f.brand()) && items.stream().noneMatch(si -> f.brand().equalsIgnoreCase(String.valueOf(si.getWardrobeItem().getBrandName())))) {
            return false;
        }
        return Filters.blank(f.category()) || items.stream().anyMatch(si -> f.category().equals(si.getWardrobeItem().getCategory()));
    }

    static boolean matches(Filters f, WardrobeItem w) {
        if (f == null || f.empty()) {
            return true;
        }
        return (Filters.blank(f.style()) || Json.csv(w.getStyleTags()).contains(f.style()))
                && (Filters.blank(f.occasion()) || Json.csv(w.getOccasionTags()).contains(f.occasion()))
                && (Filters.blank(f.color()) || f.color().equals(w.getColor()))
                && (Filters.blank(f.brand()) || f.brand().equalsIgnoreCase(String.valueOf(w.getBrandName())))
                && (Filters.blank(f.category()) || f.category().equals(w.getCategory()));
    }

    /** Relevância: recência (meia-vida de 3 dias) + Hype + afinidade com o DNA do usuário. */
    static double relevance(Scheme s, List<SchemeItem> items, Set<String> dnaStyles) {
        Instant at = s.getPublishedAt() == null ? s.getCreatedAt() : s.getPublishedAt();
        double hours = Math.max(0, Duration.between(at, Instant.now()).toHours());
        double recency = Math.pow(0.5, hours / 72.0);
        double hype = s.getHypeScore() == null ? 0 : s.getHypeScore().doubleValue() / 100.0;
        double affinity = dnaStyles.isEmpty() ? 0 : Similarity.jaccard(dnaStyles, new HashSet<>(Json.csv(s.getStyle())));
        return 0.5 * recency + 0.3 * hype + 0.2 * affinity;
    }

    Set<String> dnaStyles(UUID userId) {
        if (userId == null) {
            return Set.of();
        }
        return dnas.findByUserId(userId).map(StyleDna::getStyleKeywords).map(k -> (Set<String>) new HashSet<>(Json.csv(k))).orElse(Set.of());
    }

    // ================================================================== feed comunitário (CA01/CA06)
    @Transactional(readOnly = true)
    public Map<String, Object> communityFeed(CurrentUser viewer, String rawCursor, int size, Filters filters) {
        int limit = Math.max(1, Math.min(size <= 0 ? 20 : size, 50));
        Cursor cursor = Cursor.parse(rawCursor);
        Set<UUID> blocked = blockedFor(viewer == null ? null : viewer.id());
        Set<String> dna = dnaStyles(viewer == null ? null : viewer.id());
        List<Scheme> candidates = schemes.findPublicFeed(PageRequest.of(0, 400)).stream()
                .filter(s -> cursor == null || cursor.before(s.getPublishedAt(), s.getId()))
                .sorted(Comparator.comparing(Scheme::getPublishedAt).thenComparing(Scheme::getId).reversed())
                .filter(s -> visible(viewer, s, blocked)).toList();
        List<Scheme> page = new ArrayList<>();
        Map<UUID, List<SchemeItem>> itemsBy = new LinkedHashMap<>();
        for (Scheme s : candidates) {
            List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(s.getId());
            if (matches(filters, s, items)) {
                page.add(s);
                itemsBy.put(s.getId(), items);
            }
            if (page.size() == limit) {
                break;
            }
        }
        String next = page.size() == limit ? new Cursor(page.get(page.size() - 1).getPublishedAt(), page.get(page.size() - 1).getId()).encode() : null;
        List<Scheme> ordered = page.stream().sorted(Comparator.comparingDouble((Scheme s) -> relevance(s, itemsBy.get(s.getId()), dna)).reversed()).toList();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("items", ordered.stream().map(s -> schemeService.view(viewer, s, itemsBy.get(s.getId()))).toList());
        out.put("nextCursor", next);
        out.put("chips", filters == null ? List.of() : filters.chips());
        out.put("order", "relevância (recência, hype, afinidade) dentro da janela do cursor");
        return out;
    }

    // ================================================================== The Runway (RF7/RF19)
    @Transactional(readOnly = true)
    public Map<String, Object> runway(CurrentUser viewer, String rawCursor, int size) {
        int limit = Math.max(1, Math.min(size <= 0 ? 20 : size, 50));
        Cursor cursor = Cursor.parse(rawCursor);
        Set<UUID> blocked = blockedFor(viewer.id());
        List<UUID> following = follows.findByFollowerIdAndStatus(viewer.id(), FollowStatus.ACEITO).stream().map(f -> f.getFollowing().getId()).toList();
        Map<UUID, Map<String, Object>> entries = new LinkedHashMap<>();
        if (!following.isEmpty()) {
            List<UUID> ids = new ArrayList<>();
            TimelineProjectionPort tl = timeline.getIfAvailable();
            if (tl != null && tl.enabled()) {
                ids.addAll(tl.readTimeline(viewer.id(), 300));
            }
            List<Scheme> fromFollowing = ids.isEmpty() ? schemes.findFeedForFollowing(following, PageRequest.of(0, 300)) : schemes.findByIdIn(ids);
            fromFollowing.forEach(s -> entries.putIfAbsent(s.getId(), Map.of("reason", "SEGUINDO", "scheme", s, "at", s.getPublishedAt() == null ? s.getCreatedAt() : s.getPublishedAt())));
            for (Share sh : shares.findFeedShares(following, ShareChannel.FEED, PageRequest.of(0, 200))) {
                if (sh.getTargetType() == br.com.fashionai.domain.model.enums.TargetType.SCHEME) {
                    schemes.findById(sh.getTargetId()).ifPresent(s -> entries.putIfAbsent(s.getId(), Map.of("reason", "COMPARTILHADO",
                            "by", Views.user(sh.getUser()), "caption", String.valueOf(sh.getCaption()), "scheme", s, "at", sh.getCreatedAt())));
                }
            }
            // RF14.CA05 — seguir uma marca traz ao feed os esquemas vinculados a ela
            for (UUID f : following) {
                users.findById(f).filter(u -> u.getProfileType() != ProfileType.PESSOAL).ifPresent(inst ->
                        bonds.findByTargetOwnerIdAndStatusOrderByCreatedAtDesc(inst.getId(), SealBondStatus.APPROVED).stream().limit(30)
                                .forEach(b -> entries.putIfAbsent(b.getScheme().getId(), Map.of("reason", "VINCULO_" + inst.getProfileType().name(),
                                        "brand", Views.user(inst), "scheme", b.getScheme(), "at", b.getUpdatedAt()))));
            }
        }
        boolean fallback = entries.isEmpty();
        if (fallback) {
            schemes.findPublicFeed(PageRequest.of(0, 200)).forEach(s -> entries.putIfAbsent(s.getId(), Map.of("reason", "COMUNIDADE", "scheme", s, "at", s.getPublishedAt())));
        }
        List<Map<String, Object>> sorted = entries.values().stream()
                .filter(e -> visible(viewer, (Scheme) e.get("scheme"), blocked))
                .filter(e -> cursor == null || cursor.before((Instant) e.get("at"), ((Scheme) e.get("scheme")).getId()))
                .sorted(Comparator.comparing((Map<String, Object> e) -> (Instant) e.get("at")).thenComparing(e -> ((Scheme) e.get("scheme")).getId()).reversed())
                .limit(limit).toList();
        List<Map<String, Object>> items = sorted.stream().map(e -> {
            Scheme s = (Scheme) e.get("scheme");
            Map<String, Object> m = new LinkedHashMap<>(e);
            m.put("scheme", schemeService.view(viewer, s, schemeItems.findBySchemeIdOrderBySortOrder(s.getId())));
            return m;
        }).toList();
        String next = sorted.size() == limit ? new Cursor((Instant) sorted.get(limit - 1).get("at"), ((Scheme) sorted.get(limit - 1).get("scheme")).getId()).encode() : null;
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("items", items);
        out.put("nextCursor", next);
        out.put("fallbackToCommunity", fallback);
        out.put("waywt", Map.of("title", "WAYWT — O que você está vestindo?", "hint", "Compartilhe o seu Look do Dia no feed com #WAYWT (DET-C03)."));
        out.put("battles", challenges.voteFeed(viewer));
        return out;
    }

    // ================================================================== busca segmentada (CA02–CA05)
    @Transactional(readOnly = true)
    public Map<String, Object> search(CurrentUser viewer, String rawTerm, String tab, Filters filters, int size) {
        String term = InputSanitizer.clean(rawTerm == null ? "" : rawTerm, 80).trim();
        String t = tab == null ? "LOOKS" : tab.toUpperCase(Locale.ROOT);
        if (!TABS.contains(t)) {
            throw ApiException.badRequest("ABA_INVALIDA", "Abas: " + TABS);
        }
        int limit = Math.max(1, Math.min(size <= 0 ? 30 : size, 60));
        Set<UUID> blocked = blockedFor(viewer == null ? null : viewer.id());
        Pageable page = PageRequest.of(0, 200);
        List<?> results = switch (t) {
            case "LOOKS" -> looks(viewer, term, filters, blocked, page, limit);
            case "PECAS" -> pieces(viewer, term, filters, blocked, page, limit);
            case "PESSOAS" -> users.searchByUsername(term, PageRequest.of(0, limit)).stream()
                    .filter(u -> u.getProfileType() == ProfileType.PESSOAL && u.getStatus() == AccountStatus.ACTIVE && !blocked.contains(u.getId()))
                    .map(Views::user).toList();
            case "MARCAS" -> brands.findByApprovalStatusOrderByCreatedAtDesc(ApprovalStatus.APROVADO).stream()
                    .filter(b -> term.isEmpty() || b.getBrandName().toLowerCase(Locale.ROOT).contains(term.toLowerCase(Locale.ROOT)))
                    .limit(limit).map(b -> Map.of("userId", b.getOwner().getId(), "name", b.getBrandName(), "slug", b.getSlug(), "logoUrl", String.valueOf(b.getLogoUrl()))).toList();
            default -> celebrities.findByVerificationStatusOrderByCreatedAtDesc(ApprovalStatus.APROVADO).stream()
                    .filter(c -> term.isEmpty() || c.getStageName().toLowerCase(Locale.ROOT).contains(term.toLowerCase(Locale.ROOT)))
                    .limit(limit).map(c -> Map.of("userId", c.getOwner().getId(), "name", c.getStageName(), "slug", c.getSlug(), "avatarUrl", String.valueOf(c.getAvatarUrl()))).toList();
        };
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("term", term);
        out.put("tab", t);
        out.put("tabs", TABS);
        out.put("results", results);
        out.put("chips", filters == null ? List.of() : filters.chips());
        out.put("engine", searchIndex.getIfAvailable() != null && searchIndex.getIfAvailable().enabled() ? "opensearch" : "mysql");
        if (results.isEmpty()) {
            out.put("empty", Map.of("message", "Nada encontrado para \"" + term + "\".", "alternatives", alternatives(term),
                    "trending", trending(viewer, blocked)));
        }
        return out;
    }

    List<Views.SchemeView> looks(CurrentUser viewer, String term, Filters f, Set<UUID> blocked, Pageable page, int limit) {
        List<Scheme> base;
        SearchIndexPort idx = searchIndex.getIfAvailable();
        if (idx != null && idx.enabled() && !term.isEmpty()) {
            base = schemes.findByIdIn(idx.search("schemes", term, Map.of(), 200));
        } else {
            base = term.isEmpty() ? schemes.findAllPublic(page) : schemes.searchPublic(term, page);
        }
        List<Views.SchemeView> out = new ArrayList<>();
        for (Scheme s : base) {
            if (!visible(viewer, s, blocked)) {
                continue;
            }
            List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(s.getId());
            if (matches(f, s, items)) {
                out.add(schemeService.view(viewer, s, items));
            }
            if (out.size() == limit) {
                break;
            }
        }
        return out;
    }

    List<Views.PieceView> pieces(CurrentUser viewer, String term, Filters f, Set<UUID> blocked, Pageable page, int limit) {
        List<WardrobeItem> base;
        SearchIndexPort idx = searchIndex.getIfAvailable();
        if (idx != null && idx.enabled() && !term.isEmpty()) {
            base = pieces.findByIdIn(idx.search("pieces", term, Map.of(), 200));
        } else {
            base = term.isEmpty() ? pieces.findAllPublic(page) : pieces.searchPublic(term, page);
        }
        return base.stream().filter(w -> visible(viewer, w, blocked)).filter(w -> matches(f, w)).limit(limit).map(w -> Views.piece(w, null, null)).toList();
    }

    /** CA04 — termos alternativos pelo vocabulário da taxonomia e das marcas (Jaro-Winkler). */
    List<String> alternatives(String term) {
        if (term.isBlank()) {
            return List.of();
        }
        Set<String> vocab = new LinkedHashSet<>();
        vocab.addAll(Taxonomy.STYLES);
        vocab.addAll(Taxonomy.OCCASIONS);
        vocab.addAll(Taxonomy.COLORS.keySet());
        Taxonomy.SUBCATEGORIES.values().forEach(vocab::addAll);
        brands.findByApprovalStatusOrderByCreatedAtDesc(ApprovalStatus.APROVADO).forEach(b -> vocab.add(b.getBrandName().toLowerCase(Locale.ROOT)));
        String n = LocalAdvisors.normalize(term);
        return vocab.stream().map(v -> Map.entry(v, LocalAdvisors.jaroWinkler(n, LocalAdvisors.normalize(v.replace('_', ' ')))))
                .filter(e -> e.getValue() >= 0.75).sorted(Map.Entry.<String, Double>comparingByValue().reversed()).limit(5).map(Map.Entry::getKey).toList();
    }

    List<Views.SchemeView> trending(CurrentUser viewer, Set<UUID> blocked) {
        return schemes.findPublicFeed(PageRequest.of(0, 100)).stream().filter(s -> visible(viewer, s, blocked))
                .sorted(Comparator.comparing((Scheme s) -> s.getHypeScore() == null ? java.math.BigDecimal.ZERO : s.getHypeScore()).reversed()).limit(6)
                .map(s -> schemeService.view(viewer, s, schemeItems.findBySchemeIdOrderBySortOrder(s.getId()))).toList();
    }

    // ================================================================== Peças Públicas (vitrine)
    @Transactional(readOnly = true)
    public Map<String, Object> publicPieces(CurrentUser viewer, Filters f, String rawCursor, int size) {
        int limit = Math.max(1, Math.min(size <= 0 ? 30 : size, 60));
        Cursor cursor = Cursor.parse(rawCursor);
        Set<UUID> blocked = blockedFor(viewer == null ? null : viewer.id());
        List<WardrobeItem> list = pieces.findAllPublic(PageRequest.of(0, 500)).stream()
                .filter(w -> cursor == null || cursor.before(w.getCreatedAt(), w.getId()))
                .sorted(Comparator.comparing(WardrobeItem::getCreatedAt).thenComparing(WardrobeItem::getId).reversed())
                .filter(w -> visible(viewer, w, blocked)).filter(w -> matches(f, w)).limit(limit).toList();
        String next = list.size() == limit ? new Cursor(list.get(limit - 1).getCreatedAt(), list.get(limit - 1).getId()).encode() : null;
        return Map.of("items", list.stream().map(w -> Views.piece(w, null, null)).toList(), "nextCursor", String.valueOf(next),
                "chips", f == null ? List.of() : f.chips());
    }
}
