package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ai.local.LocalAdvisors;
import br.com.fashionai.application.ai.local.Similarity;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.ports.SearchIndexPort;
import br.com.fashionai.application.ports.TimelineProjectionPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.Share;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.FollowStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeMomentum;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.model.enums.ShareChannel;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.BrandRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.FollowRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
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
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * RF8 — Buscar/Explorar: feed comunitário por relevância e recência (CA01), busca segmentada em Looks, Peças, Pessoas,
 * Marcas e Celebridades (CA02), filtros combináveis em chips (CA03), sugestões quando vazio (CA04), nunca conteúdo
 * privado ou bloqueado (CA05) e paginação por cursor sem duplicar (CA06). Inclui The Runway (feed de quem se segue,
 * compartilhamentos no feed interno, vínculos das marcas seguidas) e a vitrine de Peças Públicas.
 * <p>
 * HypeScore v2 (RF53 · Lote 1 da auditoria de abas): a relevância do feed e o "Em alta na comunidade" da busca vazia leem
 * o estado gravado pelo job ({@code hype_scores}); o filtro {@code hypeLevel} ("Em alta" = faixa mínima) vale para feed,
 * busca (Looks e Peças) e Peças Públicas. Em contexto de terceiros só conta o Hype {@code publicEligible} e disponível;
 * sem Hype público o item fica neutro na ordem e fora do filtro (nunca vira 0). GET nunca recalcula nem emite sinal.
 */
@Service
public class SearchService {
    public static final List<String> TABS = List.of("LOOKS", "PECAS", "PESSOAS", "MARCAS", "CELEBRIDADES");

    /**
     * Filtros combináveis (CA03). {@code hypeLevel} é FILTRO de faixa mínima do HypeScore v2 público (ex.: HOT = "Em alta"),
     * nunca aba nem ordenação; {@link #empty()} continua olhando só os atributos do look/peça.
     */
    public record Filters(String style, String occasion, String color, String brand, String category, String hypeLevel) {
        public Filters(String style, String occasion, String color, String brand, String category) {
            this(style, occasion, color, brand, category, null);
        }

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
            if (!blank(hypeLevel)) {
                out.add(Map.of("key", "hypeLevel", "value", hypeLevel.trim().toUpperCase(Locale.ROOT)));
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
                throw ApiException.badRequest("CURSOR_INVALIDO", Msg.t("search.cursor_de_paginacao_invalido"));
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
    private final BrandRepository catalog;
    /** HypeScore v2: estado atual lido direto do repositório (sem HypeQueryService, como o WardrobeService). */
    private final HypeScoreCurrentRepository hypeScores;
    private final HypeScoreConfig hypeConfig;

    public SearchService(SchemeRepository schemes, SchemeItemRepository schemeItems, WardrobeItemRepository pieces, UserRepository users,
                         BrandProfileRepository brands, CelebrityProfileRepository celebrities, FollowRepository follows, ShareRepository shares,
                         SealBondRepository bonds, StyleDnaRepository dnas, ObjectProvider<SearchIndexPort> searchIndex,
                         ObjectProvider<TimelineProjectionPort> timeline, SchemeService schemeService, ChallengeService challenges, Guard guard,
                         BrandRepository catalog, HypeScoreCurrentRepository hypeScores, HypeScoreConfig hypeConfig) {
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
        this.catalog = catalog;
        this.hypeScores = hypeScores;
        this.hypeConfig = hypeConfig;
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

    /** Conteúdo de conta de teste só aparece para outra conta de teste (a vitrine pública fica limpa). */
    static boolean showcaseAllows(CurrentUser viewer, User owner) {
        return !owner.isTestAccount() || (viewer != null && User.isTestUsername(viewer.username()));
    }

    boolean visible(CurrentUser viewer, Scheme s, Set<UUID> blocked) {
        return !blocked.contains(s.getUser().getId()) && s.getUser().getStatus() == AccountStatus.ACTIVE && showcaseAllows(viewer, s.getUser())
                && schemeService.canView(viewer, s);
    }

    boolean visible(CurrentUser viewer, WardrobeItem w, Set<UUID> blocked) {
        return !blocked.contains(w.getUser().getId()) && w.getUser().getStatus() == AccountStatus.ACTIVE && showcaseAllows(viewer, w.getUser())
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

    /**
     * Relevância: recência (meia-vida de 3 dias) + HypeScore v2 PÚBLICO do look + afinidade com o DNA de quem vê.
     * {@code publicHype} nulo (sem Hype público: dados insuficientes, ainda não calculado ou Hype só pessoal) = 0,5 neutro,
     * para não punir conteúdo novo; o v1 ({@code Scheme.hypeScore}) não entra mais.
     */
    static double relevance(Scheme s, List<SchemeItem> items, Set<String> dnaStyles, Double publicHype) {
        return relevance(publishedAt(s), Json.csv(s.getStyle()), dnaStyles, publicHype);
    }

    /** A mesma conta para qualquer post do feed: recência pela hora do post (publicação ou compartilhamento). */
    static double relevance(Instant at, Collection<String> styles, Set<String> dnaStyles, Double publicHype) {
        double hours = Math.max(0, Duration.between(at, Instant.now()).toHours());
        double recency = Math.pow(0.5, hours / 72.0);
        double hype = publicHype == null ? NEUTRAL_HYPE : Math.max(0, Math.min(100, publicHype)) / 100.0;
        double affinity = dnaStyles.isEmpty() ? 0 : Similarity.jaccard(dnaStyles, new HashSet<>(styles));
        return 0.5 * recency + 0.3 * hype + 0.2 * affinity;
    }

    // ================================================================== HypeScore v2 em contexto de terceiros (RF53)
    /** Hype de um look sem base pública na relevância do feed: meio da escala (neutro). */
    static final double NEUTRAL_HYPE = 0.5;
    /** Quantos looks do topo público a busca vazia examina para mostrar 6 visíveis (bloqueios e visibilidade cortam alguns). */
    static final int TRENDING_POOL = 30;

    /**
     * Linha de Hype que pode ORDENAR, FILTRAR ou AGREGAR em contexto de terceiros: só {@code publicEligible} e AVAILABLE
     * com score. Item privado ou só para seguidores tem Hype pessoal (do dono), que nunca entra em vitrine pública.
     */
    static HypeScoreCurrent publicRow(HypeScoreCurrent c) {
        return c != null && c.isPublicEligible() && c.getStatus() == HypeStatus.AVAILABLE && c.getScore() != null ? c : null;
    }

    /** Score v2 público (nulo = sem Hype público: fica neutro ou por último, nunca 0). */
    static Double publicScore(HypeScoreCurrent c) {
        HypeScoreCurrent p = publicRow(c);
        return p == null ? null : p.getScore().doubleValue();
    }

    /** Como {@link #publicScore}, mas o próprio dono usa o Hype pessoal (vitrine do próprio perfil). */
    static Double scoreFor(HypeScoreCurrent c, boolean self) {
        if (self && c != null && c.getStatus() == HypeStatus.AVAILABLE && c.getScore() != null) {
            return c.getScore().doubleValue();
        }
        return publicScore(c);
    }

    /** Dimensão TREND (crescimento recente) com a mesma regra de visibilidade: tendência ≠ popularidade. */
    static Double trendFor(HypeScoreCurrent c, boolean self) {
        if (scoreFor(c, self) == null || c.getDimensions() == null || c.getDimensions().getTrend() == null) {
            return null;
        }
        return c.getDimensions().getTrend().doubleValue();
    }

    /** Variação em pontos contra a semana anterior (ordem "Em crescimento"), com a mesma regra de visibilidade. */
    static Double growthFor(HypeScoreCurrent c, boolean self) {
        return scoreFor(c, self) == null || c.getDeltaPoints() == null ? null : c.getDeltaPoints().doubleValue();
    }

    /** Momento de alta (RISING ou EMERGING) no Hype público. */
    static boolean risingFor(HypeScoreCurrent c, boolean self) {
        return scoreFor(c, self) != null && (c.getMomentum() == HypeMomentum.RISING || c.getMomentum() == HypeMomentum.EMERGING);
    }

    /** Estado v2 de vários itens numa consulta (uma por página/lista). Sem repositório (testes antigos) = vazio. */
    static Map<UUID, HypeScoreCurrent> hypeRows(HypeScoreCurrentRepository repo, HypeScoreConfig cfg, HypeEntityType type, Collection<UUID> ids) {
        if (repo == null || cfg == null || ids == null || ids.isEmpty()) {
            return new HashMap<>();
        }
        List<UUID> distinct = ids.stream().filter(Objects::nonNull).distinct().toList();
        if (distinct.isEmpty()) {
            return new HashMap<>();
        }
        return repo.findByEntityTypeAndEntityIdInAndAlgorithmVersion(type, distinct, cfg.algorithmVersion()).stream()
                .collect(Collectors.toMap(HypeScoreCurrent::getEntityId, Function.identity(), (a, b) -> a, HashMap::new));
    }

    Map<UUID, HypeScoreCurrent> hypeRows(HypeEntityType type, Collection<UUID> ids) {
        return hypeRows(hypeScores, hypeConfig, type, ids);
    }

    /** Faixa mínima pedida no filtro (nulo = sem filtro). Valor desconhecido = 400, com as faixas válidas. */
    static HypeLevel parseLevel(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return HypeLevel.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw ApiException.badRequest("NIVEL_INVALIDO", "hypeLevel: " + Arrays.toString(HypeLevel.values()));
        }
    }

    /** Score mínimo da faixa (limiares do HypeScoreConfig; LOW_SIGNAL = qualquer score público). */
    static double levelMinimum(HypeScoreConfig cfg, HypeLevel level) {
        int[] t = cfg == null ? HypeScoreConfig.defaults().levelThresholds() : cfg.levelThresholds();
        return level == null || level.ordinal() == 0 ? 0 : t[Math.min(t.length, level.ordinal()) - 1];
    }

    /**
     * O item passa no filtro de faixa mínima? Só com Hype PÚBLICO disponível e com o mesmo arredondamento da faixa
     * exibida (59,5 aparece como 60 = Em alta). Sem Hype público nunca passa (não é "0", é "sem dado").
     */
    static boolean meetsLevel(HypeScoreCurrent c, HypeLevel min, HypeScoreConfig cfg) {
        if (min == null) {
            return true;
        }
        Double score = publicScore(c);
        return score != null && score >= levelMinimum(cfg, min) - 0.5;
    }

    /**
     * Resumo no formato do HypeSummary dos cards ({@code /api/hype/summaries}) para quem vê: público elegível para todos;
     * Hype pessoal só para o dono ({@code self}); para os demais, item sem Hype público vira NOT_CALCULATED ("—" na tela).
     * Sem dimensões (o verso e a análise completa buscam o detalhe); "sem dados" nunca vira 0.
     */
    static Map<String, Object> hypeSummary(HypeScoreCurrent c, boolean self, HypeScoreConfig cfg) {
        Map<String, Object> m = new LinkedHashMap<>();
        if (c == null || !(c.isPublicEligible() || self)) {
            m.put("status", "NOT_CALCULATED");
            return m;
        }
        boolean available = c.getStatus() == HypeStatus.AVAILABLE && c.getScore() != null;
        m.put("status", available ? HypeStatus.AVAILABLE.name() : HypeStatus.INSUFFICIENT_DATA.name());
        int staleHours = cfg == null ? 24 : cfg.staleAfterHours();
        m.put("stale", c.getCalculatedAt() != null && c.getCalculatedAt().isBefore(Instant.now().minus(staleHours, ChronoUnit.HOURS)));
        m.put("score", available ? round1(c.getScore().doubleValue()) : null);
        m.put("level", available && c.getLevel() != null ? c.getLevel().name() : null);
        m.put("direction", available ? c.getDirection() : null);
        m.put("deltaPoints", available && c.getDeltaPoints() != null ? round1(c.getDeltaPoints().doubleValue()) : null);
        m.put("deltaPercent", available && c.getDeltaPercent() != null ? round1(c.getDeltaPercent().doubleValue()) : null);
        m.put("momentum", available && c.getMomentum() != null ? c.getMomentum().name() : null);
        m.put("calculatedAt", c.getCalculatedAt() == null ? null : c.getCalculatedAt().toString());
        m.put("algorithmVersion", c.getAlgorithmVersion());
        m.put("publicEligible", c.isPublicEligible());
        return m;
    }

    static double round1(double v) {
        return Math.round(v * 10) / 10.0;
    }

    Set<String> dnaStyles(UUID userId) {
        if (userId == null) {
            return Set.of();
        }
        return dnas.findByUserId(userId).map(StyleDna::getStyleKeywords).map(k -> (Set<String>) new HashSet<>(Json.csv(k))).orElse(Set.of());
    }

    // ================================================================== feed comunitário (CA01/CA06)
    /**
     * Um post do feed: o look publicado ou um compartilhamento no feed (RF19.CA08) de um look ou de uma peça. {@code at} é a
     * hora do post (publicação ou compartilhamento) e {@code id} é o do conteúdo — o mesmo conteúdo aparece uma vez só,
     * pelo post mais recente.
     */
    record Post(Instant at, UUID id, Scheme scheme, WardrobeItem piece, Share share) {
        Collection<String> styles() {
            return scheme != null ? Json.csv(scheme.getStyle()) : Json.csv(piece.getStyleTags());
        }
    }

    /** Hora de publicação do look (o rascunho antigo sem data usa a criação). */
    static Instant publishedAt(Scheme s) {
        return s.getPublishedAt() == null ? s.getCreatedAt() : s.getPublishedAt();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> communityFeed(CurrentUser viewer, String rawCursor, int size, Filters filters) {
        int limit = Math.max(1, Math.min(size <= 0 ? 20 : size, 50));
        Cursor cursor = Cursor.parse(rawCursor);
        Set<UUID> blocked = blockedFor(viewer == null ? null : viewer.id());
        Set<String> dna = dnaStyles(viewer == null ? null : viewer.id());
        HypeLevel minLevel = parseLevel(filters == null ? null : filters.hypeLevel());
        Map<UUID, Post> byTarget = new LinkedHashMap<>();
        for (Scheme s : schemes.findPublicFeed(PageRequest.of(0, 400))) {
            byTarget.put(s.getId(), new Post(publishedAt(s), s.getId(), s, null, null));
        }
        // RF19.CA08 — "Publicar no feed": o compartilhamento é um post (de qualquer pessoa, do mais novo para o mais antigo);
        // o post só entra se quem vê pode abrir o conteúdo E o perfil de quem compartilhou (bloqueio, conta ativa)
        for (Share sh : shares.findByChannelOrderByCreatedAtDesc(ShareChannel.FEED, PageRequest.of(0, 200))) {
            Post prev = byTarget.get(sh.getTargetId());
            if ((prev != null && !prev.at().isBefore(sh.getCreatedAt())) || !sharerVisible(viewer, sh.getUser(), blocked)) {
                continue;
            }
            Post post = switch (sh.getTargetType()) {
                case SCHEME -> (prev != null && prev.scheme() != null ? Optional.of(prev.scheme()) : schemes.findById(sh.getTargetId()))
                        .map(s -> new Post(sh.getCreatedAt(), s.getId(), s, null, sh)).orElse(null);
                case PIECE -> pieces.findById(sh.getTargetId()).map(w -> new Post(sh.getCreatedAt(), w.getId(), null, w, sh)).orElse(null);
                default -> null;
            };
            if (post != null) {
                byTarget.put(post.id(), post);
            }
        }
        List<Post> candidates = byTarget.values().stream()
                .filter(p -> cursor == null || cursor.before(p.at(), p.id()))
                .sorted(Comparator.comparing(Post::at).thenComparing(Post::id).reversed())
                .filter(p -> p.scheme() != null ? visible(viewer, p.scheme(), blocked) : visible(viewer, p.piece(), blocked)).toList();
        // com o filtro "Em alta" o Hype da janela inteira vem numa consulta por tipo (antes de montar a página)
        Map<UUID, HypeScoreCurrent> hype = minLevel == null ? new HashMap<>() : hypeOfPosts(candidates);
        List<Post> page = new ArrayList<>();
        Map<UUID, List<SchemeItem>> itemsBy = new LinkedHashMap<>();
        for (Post p : candidates) {
            if (!meetsLevel(hype.get(p.id()), minLevel, hypeConfig)) {
                continue;
            }
            if (p.scheme() != null) {
                List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(p.id());
                if (matches(filters, p.scheme(), items)) {
                    page.add(p);
                    itemsBy.put(p.id(), items);
                }
            } else if (matches(filters, p.piece())) {
                page.add(p);
            }
            if (page.size() == limit) {
                break;
            }
        }
        String next = page.size() == limit ? new Cursor(page.get(page.size() - 1).at(), page.get(page.size() - 1).id()).encode() : null;
        // P1-01: sem filtro, o Hype v2 da página vem numa consulta por tipo antes de ordenar (só o público entra na relevância)
        Map<UUID, HypeScoreCurrent> pageHype = minLevel == null ? hypeOfPosts(page) : hype;
        List<Post> ordered = page.stream()
                .sorted(Comparator.comparingDouble((Post p) -> relevance(p.at(), p.styles(), dna, publicScore(pageHype.get(p.id())))).reversed())
                .toList();
        List<Views.SchemeView> looks = new ArrayList<>();
        List<Map<String, Object>> entries = new ArrayList<>();
        for (Post p : ordered) {
            Map<String, Object> e = new LinkedHashMap<>();
            e.put("kind", p.scheme() != null ? "SCHEME" : "PIECE");
            e.put("id", p.id());
            e.put("at", p.at());
            if (p.scheme() != null) {
                Views.SchemeView v = schemeService.view(viewer, p.scheme(), itemsBy.get(p.id()));
                looks.add(v);
                e.put("scheme", v);
            } else {
                e.put("piece", Views.piece(p.piece(), null, null));
            }
            if (p.share() != null) {
                e.put("sharedBy", Views.user(p.share().getUser()));
                e.put("caption", p.share().getCaption());
            }
            entries.add(e);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("items", looks);
        out.put("entries", entries);
        out.put("nextCursor", next);
        out.put("chips", filters == null ? List.of() : filters.chips());
        out.put("order", Msg.t("search.relevancia_recencia_hype_afinidade"));
        return out;
    }

    /** Quem compartilhou também precisa estar visível para quem lê o feed (sem bloqueio, conta ativa, vitrine). */
    boolean sharerVisible(CurrentUser viewer, User sharer, Set<UUID> blocked) {
        return sharer != null && !blocked.contains(sharer.getId()) && sharer.getStatus() == AccountStatus.ACTIVE && showcaseAllows(viewer, sharer);
    }

    /** Hype v2 dos posts: uma consulta para os looks e, se houver peça compartilhada, uma para as peças. */
    private Map<UUID, HypeScoreCurrent> hypeOfPosts(List<Post> posts) {
        Map<UUID, HypeScoreCurrent> out = new HashMap<>(hypeRows(HypeEntityType.SCHEME, posts.stream().filter(p -> p.scheme() != null).map(Post::id).toList()));
        List<UUID> pieceIds = posts.stream().filter(p -> p.piece() != null).map(Post::id).toList();
        if (!pieceIds.isEmpty()) {
            out.putAll(hypeRows(HypeEntityType.PIECE, pieceIds));
        }
        return out;
    }

    // ================================================================== The Runway (RF7/RF19)
    /** Conteúdo de uma entrada do "Seguindo": o look ou a peça compartilhada. */
    private static Object entryContent(Map<String, Object> e) {
        return e.containsKey("scheme") ? e.get("scheme") : e.get("piece");
    }

    private static UUID entryId(Map<String, Object> e) {
        return entryContent(e) instanceof Scheme s ? s.getId() : ((WardrobeItem) e.get("piece")).getId();
    }

    /** Entrada de compartilhamento no feed (RF19.CA08): look ou peça, com quem compartilhou e a legenda. */
    private Map<String, Object> sharedEntry(Share sh) {
        Object content = switch (sh.getTargetType()) {
            case SCHEME -> schemes.findById(sh.getTargetId()).orElse(null);
            case PIECE -> pieces.findById(sh.getTargetId()).orElse(null);
            default -> null;
        };
        if (content == null) {
            return null;
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("reason", "COMPARTILHADO");
        m.put("by", Views.user(sh.getUser()));
        m.put("caption", String.valueOf(sh.getCaption()));
        m.put(content instanceof Scheme ? "scheme" : "piece", content);
        m.put("at", sh.getCreatedAt());
        return m;
    }

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
            // compartilhamentos no feed de quem eu sigo: looks e peças (RF19.CA08)
            for (Share sh : shares.findFeedShares(following, ShareChannel.FEED, PageRequest.of(0, 200))) {
                if (!entries.containsKey(sh.getTargetId()) && !blocked.contains(sh.getUser().getId())) {
                    Map<String, Object> e = sharedEntry(sh);
                    if (e != null) {
                        entries.put(sh.getTargetId(), e);
                    }
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
        // o que EU publiquei no feed aparece no meu "Seguindo" (como numa rede social), por cima da entrada mais antiga
        for (Share sh : shares.findFeedShares(List.of(viewer.id()), ShareChannel.FEED, PageRequest.of(0, 50))) {
            Map<String, Object> prev = entries.get(sh.getTargetId());
            if (prev == null || ((Instant) prev.get("at")).isBefore(sh.getCreatedAt())) {
                Map<String, Object> e = sharedEntry(sh);
                if (e != null) {
                    entries.put(sh.getTargetId(), e);
                }
            }
        }
        List<Map<String, Object>> sorted = entries.values().stream()
                .filter(e -> entryContent(e) instanceof Scheme s ? visible(viewer, s, blocked) : visible(viewer, (WardrobeItem) e.get("piece"), blocked))
                .filter(e -> cursor == null || cursor.before((Instant) e.get("at"), entryId(e)))
                .sorted(Comparator.comparing((Map<String, Object> e) -> (Instant) e.get("at")).thenComparing(SearchService::entryId).reversed())
                .limit(limit).toList();
        List<Map<String, Object>> items = sorted.stream().map(e -> {
            Map<String, Object> m = new LinkedHashMap<>(e);
            if (entryContent(e) instanceof Scheme s) {
                m.put("scheme", schemeService.view(viewer, s, schemeItems.findBySchemeIdOrderBySortOrder(s.getId())));
            } else {
                m.put("piece", Views.piece((WardrobeItem) e.get("piece"), null, null));
            }
            return m;
        }).toList();
        String next = sorted.size() == limit ? new Cursor((Instant) sorted.get(limit - 1).get("at"), entryId(sorted.get(limit - 1))).encode() : null;
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("items", items);
        out.put("nextCursor", next);
        out.put("fallbackToCommunity", fallback);
        out.put("waywt", Map.of("title", Msg.t("search.waywt_o_que_voce_esta"), "hint", Msg.t("search.compartilhe_o_seu_look_do")));
        out.put("battles", challenges.voteFeed(viewer));
        return out;
    }

    // ================================================================== busca segmentada (CA02–CA05)
    @Transactional(readOnly = true)
    public Map<String, Object> search(CurrentUser viewer, String rawTerm, String tab, Filters filters, int size) {
        return search(viewer, rawTerm, tab, filters, size, null);
    }

    /**
     * RF8.CA02–CA06 — busca segmentada por abas com cursor opaco (deslocamento na lista filtrada e estável), para que a
     * rolagem carregue a próxima página sem repetir itens.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> search(CurrentUser viewer, String rawTerm, String tab, Filters filters, int size, String rawCursor) {
        String term = InputSanitizer.clean(rawTerm == null ? "" : rawTerm, 80).trim();
        String t = tab == null ? "LOOKS" : tab.toUpperCase(Locale.ROOT);
        if (!TABS.contains(t)) {
            throw ApiException.badRequest("ABA_INVALIDA", "Abas: " + TABS);
        }
        int limit = Math.max(1, Math.min(size <= 0 ? 30 : size, 60));
        int offset = offsetOf(rawCursor);
        parseLevel(filters == null ? null : filters.hypeLevel());   // faixa inválida = 400 antes de buscar
        Set<UUID> blocked = blockedFor(viewer == null ? null : viewer.id());
        Pageable page = PageRequest.of(0, 400);
        int want = offset + limit + 1; // um a mais para saber se existe próxima página
        String needle = term.toLowerCase(Locale.ROOT);
        List<?> all = switch (t) {
            case "LOOKS" -> looks(viewer, term, filters, blocked, page, want);
            case "PECAS" -> pieces(viewer, term, filters, blocked, page, want);
            case "PESSOAS" -> users.searchByUsername(term, PageRequest.of(0, want)).stream()
                    .filter(u -> u.getProfileType() == ProfileType.PESSOAL && u.getStatus() == AccountStatus.ACTIVE && !blocked.contains(u.getId()))
                    .map(Views::user).toList();
            case "MARCAS" -> brandResults(needle, want);
            default -> celebrities.findByVerificationStatusOrderByCreatedAtDesc(ApprovalStatus.APROVADO).stream()
                    .filter(c -> term.isEmpty() || c.getStageName().toLowerCase(Locale.ROOT).contains(needle))
                    .limit(want).map(c -> Map.of("userId", c.getOwner().getId(), "name", c.getStageName(), "slug", c.getSlug(), "avatarUrl", String.valueOf(c.getAvatarUrl()))).toList();
        };
        List<?> results = all.size() <= offset ? List.of() : all.subList(offset, Math.min(all.size(), offset + limit));
        String nextCursor = all.size() > offset + limit ? encodeOffset(offset + limit) : null;
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("term", term);
        out.put("tab", t);
        out.put("tabs", TABS);
        out.put("results", results);
        out.put("nextCursor", nextCursor);
        out.put("chips", filters == null ? List.of() : filters.chips());
        out.put("engine", searchIndex.getIfAvailable() != null && searchIndex.getIfAvailable().enabled() ? "opensearch" : "mysql");
        if (results.isEmpty() && offset == 0) {
            List<Views.SchemeView> hot = trending(viewer, blocked);
            List<String> alts = alternatives(term);
            if (alts.isEmpty()) {
                // nenhum termo parecido: sugere os estilos e ocasiões que mais aparecem nos looks em alta
                Map<String, Long> freq = new LinkedHashMap<>();
                hot.forEach(v -> { v.style().forEach(x -> freq.merge(x, 1L, Long::sum)); v.occasion().forEach(x -> freq.merge(x, 1L, Long::sum)); });
                alts = freq.entrySet().stream().sorted(Map.Entry.<String, Long>comparingByValue().reversed()).limit(5).map(Map.Entry::getKey).toList();
            }
            out.put("empty", Map.of("message", Msg.t("search.nada_encontrado_para", term), "alternatives", alts, "trending", hot));
        }
        return out;
    }

    static int offsetOf(String raw) {
        if (raw == null || raw.isBlank()) {
            return 0;
        }
        try {
            String v = new String(Base64.getUrlDecoder().decode(raw), StandardCharsets.UTF_8);
            return v.startsWith("o:") ? Math.max(0, Math.min(Integer.parseInt(v.substring(2)), 10_000)) : 0;
        } catch (RuntimeException ex) {
            throw ApiException.badRequest("CURSOR_INVALIDO", Msg.t("search.cursor_de_paginacao_invalido"));
        }
    }

    static String encodeOffset(int offset) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(("o:" + offset).getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Aba Marcas: perfis de marca aprovados no Fashion AI e, depois deles, as marcas do catálogo (sem perfil) que casam com o
     * termo — com o número de peças públicas de cada uma, para a busca nunca ignorar uma marca conhecida.
     */
    List<Map<String, Object>> brandResults(String needle, int want) {
        List<Map<String, Object>> out = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (var b : brands.findByApprovalStatusOrderByCreatedAtDesc(ApprovalStatus.APROVADO)) {
            if (!needle.isEmpty() && !b.getBrandName().toLowerCase(Locale.ROOT).contains(needle)) {
                continue;
            }
            seen.add(b.getBrandName().toLowerCase(Locale.ROOT));
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("userId", b.getOwner().getId());
            m.put("name", b.getBrandName());
            m.put("slug", b.getSlug());
            m.put("logoUrl", b.getLogoUrl());
            m.put("registered", true);
            out.add(m);
        }
        for (var c : catalog.findAllByOrderByName()) {
            if (out.size() >= want) {
                break;
            }
            String key = c.getName().toLowerCase(Locale.ROOT);
            if ((!needle.isEmpty() && !key.contains(needle)) || !seen.add(key)) {
                continue;
            }
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("name", c.getName());
            m.put("slug", c.getSlug());
            m.put("logoUrl", c.getLogoUrl());
            m.put("registered", false);
            m.put("publicPieces", pieces.countPublicByBrandName(c.getName()));
            out.add(m);
        }
        return out.size() > want ? out.subList(0, want) : out;
    }

    List<Views.SchemeView> looks(CurrentUser viewer, String term, Filters f, Set<UUID> blocked, Pageable page, int limit) {
        List<Scheme> base;
        SearchIndexPort idx = searchIndex.getIfAvailable();
        if (idx != null && idx.enabled() && !term.isEmpty()) {
            base = schemes.findByIdIn(idx.search("schemes", term, Map.of(), 200));
        } else {
            base = term.isEmpty() ? schemes.findAllPublic(page) : schemes.searchPublic(term, page);
        }
        HypeLevel min = parseLevel(f == null ? null : f.hypeLevel());
        Map<UUID, HypeScoreCurrent> hype = min == null ? Map.of() : hypeRows(HypeEntityType.SCHEME, base.stream().map(Scheme::getId).toList());
        List<Views.SchemeView> out = new ArrayList<>();
        for (Scheme s : base) {
            if (!visible(viewer, s, blocked) || !meetsLevel(hype.get(s.getId()), min, hypeConfig)) {
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
        HypeLevel min = parseLevel(f == null ? null : f.hypeLevel());
        Map<UUID, HypeScoreCurrent> hype = min == null ? Map.of() : hypeRows(HypeEntityType.PIECE, base.stream().map(WardrobeItem::getId).toList());
        return base.stream().filter(w -> visible(viewer, w, blocked)).filter(w -> matches(f, w))
                .filter(w -> meetsLevel(hype.get(w.getId()), min, hypeConfig))
                .limit(limit).map(w -> Views.piece(w, null, null)).toList();
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

    /**
     * P1-02 — "Em alta na comunidade" da busca vazia: o mesmo critério de {@code /api/hype/trending?type=LOOK&window=7}
     * (HypeScore v2 atual, só população pública com score disponível), e não mais o v1. Sem Hype público, a seção some
     * (nenhum look é apresentado como "em alta" sem base).
     */
    List<Views.SchemeView> trending(CurrentUser viewer, Set<UUID> blocked) {
        if (hypeScores == null || hypeConfig == null) {
            return List.of();
        }
        List<UUID> top = hypeScores.findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(HypeEntityType.SCHEME, hypeConfig.algorithmVersion(),
                        HypeStatus.AVAILABLE).stream()
                .filter(c -> c.getScore() != null)
                .sorted(Comparator.comparing(HypeScoreCurrent::getScore).reversed().thenComparing(HypeScoreCurrent::getEntityId))
                .limit(TRENDING_POOL).map(HypeScoreCurrent::getEntityId).toList();
        if (top.isEmpty()) {
            return List.of();
        }
        Map<UUID, Scheme> byId = schemes.findByIdIn(top).stream().collect(Collectors.toMap(Scheme::getId, Function.identity(), (a, b) -> a));
        return top.stream().map(byId::get).filter(Objects::nonNull).filter(s -> visible(viewer, s, blocked)).limit(6)
                .map(s -> schemeService.view(viewer, s, schemeItems.findBySchemeIdOrderBySortOrder(s.getId()))).toList();
    }

    // ================================================================== Peças Públicas (vitrine)
    @Transactional(readOnly = true)
    public Map<String, Object> publicPieces(CurrentUser viewer, Filters f, String rawCursor, int size) {
        int limit = Math.max(1, Math.min(size <= 0 ? 30 : size, 60));
        Cursor cursor = Cursor.parse(rawCursor);
        Set<UUID> blocked = blockedFor(viewer == null ? null : viewer.id());
        HypeLevel min = parseLevel(f == null ? null : f.hypeLevel());
        List<WardrobeItem> window = pieces.findAllPublic(PageRequest.of(0, 500));
        Map<UUID, HypeScoreCurrent> hype = min == null ? Map.of() : hypeRows(HypeEntityType.PIECE, window.stream().map(WardrobeItem::getId).toList());
        List<WardrobeItem> list = window.stream()
                .filter(w -> cursor == null || cursor.before(w.getCreatedAt(), w.getId()))
                .sorted(Comparator.comparing(WardrobeItem::getCreatedAt).thenComparing(WardrobeItem::getId).reversed())
                .filter(w -> visible(viewer, w, blocked)).filter(w -> matches(f, w))
                .filter(w -> meetsLevel(hype.get(w.getId()), min, hypeConfig)).limit(limit).toList();
        String next = list.size() == limit ? new Cursor(list.get(limit - 1).getCreatedAt(), list.get(limit - 1).getId()).encode() : null;
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("items", list.stream().map(w -> Views.piece(w, null, null)).toList());
        out.put("nextCursor", next); // null na última página (RF8.CA06): o cliente para de pedir
        out.put("chips", f == null ? List.of() : f.chips());
        return out;
    }
}
