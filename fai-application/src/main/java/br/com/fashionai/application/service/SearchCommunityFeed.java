package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.SearchService.Cursor;
import br.com.fashionai.application.service.SearchService.Filters;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.Share;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.ShareChannel;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.ShareRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.data.domain.PageRequest;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static br.com.fashionai.application.service.SearchHype.meetsLevel;
import static br.com.fashionai.application.service.SearchHype.parseLevel;
import static br.com.fashionai.application.service.SearchHype.publicScore;
import static br.com.fashionai.application.service.SearchMatching.matches;
import static br.com.fashionai.application.service.SearchMatching.publishedAt;
import static br.com.fashionai.application.service.SearchMatching.relevance;

/**
 * RF8.CA01/CA06 — feed comunitário por relevância e recência: looks publicados e compartilhamentos no feed (RF19.CA08)
 * de looks e peças, um post por conteúdo (o mais recente), página por cursor e filtro de faixa mínima de Hype v2.
 */
final class SearchCommunityFeed {
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final WardrobeItemRepository pieces;
    private final ShareRepository shares;
    private final StyleDnaRepository dnas;
    private final SchemeService schemeService;
    private final SearchVisibility visibility;
    private final HypeScoreCurrentRepository hypeScores;
    private final HypeScoreConfig hypeConfig;

    SearchCommunityFeed(SchemeRepository schemes, SchemeItemRepository schemeItems, WardrobeItemRepository pieces, ShareRepository shares,
                        StyleDnaRepository dnas, SchemeService schemeService, SearchVisibility visibility,
                        HypeScoreCurrentRepository hypeScores, HypeScoreConfig hypeConfig) {
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.pieces = pieces;
        this.shares = shares;
        this.dnas = dnas;
        this.schemeService = schemeService;
        this.visibility = visibility;
        this.hypeScores = hypeScores;
        this.hypeConfig = hypeConfig;
    }

    Set<String> dnaStyles(UUID userId) {
        if (userId == null) {
            return Set.of();
        }
        return dnas.findByUserId(userId).map(StyleDna::getStyleKeywords).map(k -> (Set<String>) new HashSet<>(Json.csv(k))).orElse(Set.of());
    }

    /**
     * Um post do feed: o look publicado ou um compartilhamento no feed (RF19.CA08) de um look ou de uma peça, sem
     * descrição (o post do FashionAI é o próprio card). {@code at} é a hora do post (publicação ou compartilhamento) e
     * {@code id} é o do conteúdo — o mesmo conteúdo aparece uma vez só, pelo post mais recente.
     */
    record Post(Instant at, UUID id, Scheme scheme, WardrobeItem piece, Share share) {
        Collection<String> styles() {
            return scheme != null ? Json.csv(scheme.getStyle()) : Json.csv(piece.getStyleTags());
        }
    }

    Map<String, Object> communityFeed(CurrentUser viewer, String rawCursor, int size, Filters filters) {
        int limit = Math.max(1, Math.min(size <= 0 ? 20 : size, 50));
        Cursor cursor = Cursor.parse(rawCursor);
        Set<UUID> blocked = visibility.blockedFor(viewer == null ? null : viewer.id());
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
            if ((prev != null && !prev.at().isBefore(sh.getCreatedAt())) || !visibility.sharerVisible(viewer, sh.getUser(), blocked)) {
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
                .filter(p -> p.scheme() != null ? visibility.visible(viewer, p.scheme(), blocked) : visibility.visible(viewer, p.piece(), blocked)).toList();
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
                e.put("sharedBy", Views.user(p.share().getUser()));   // o post não tem descrição: só quem compartilhou
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

    private Map<UUID, HypeScoreCurrent> hypeRows(HypeEntityType type, Collection<UUID> ids) {
        return SearchHype.hypeRows(hypeScores, hypeConfig, type, ids);
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
}
