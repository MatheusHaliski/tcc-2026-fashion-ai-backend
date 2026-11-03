package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.ports.SearchIndexPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.SearchService.Filters;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.BrandRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.PublicPersonHeader;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static br.com.fashionai.application.service.SearchHype.meetsLevel;
import static br.com.fashionai.application.service.SearchHype.parseLevel;
import static br.com.fashionai.application.service.SearchMatching.matches;
import static br.com.fashionai.application.service.SearchService.TABS;
import static br.com.fashionai.application.service.SearchService.encodeOffset;
import static br.com.fashionai.application.service.SearchService.offsetOf;

/**
 * RF8.CA02–CA06 — busca segmentada nas abas Looks, Peças, Pessoas, Marcas e Celebridades, com o índice de busca quando
 * ligado, filtros combináveis, faixa mínima de Hype v2 e cursor de deslocamento; a busca vazia ganha sugestões (CA04).
 */
final class SearchTabs {
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final WardrobeItemRepository pieces;
    private final UserRepository users;
    private final BrandProfileRepository brands;
    private final CelebrityProfileRepository celebrities;
    private final BrandRepository catalog;
    private final ObjectProvider<SearchIndexPort> searchIndex;
    private final SchemeService schemeService;
    private final SearchVisibility visibility;
    private final SearchPeople people;
    private final SearchSuggestions suggestions;
    private final HypeScoreCurrentRepository hypeScores;
    private final HypeScoreConfig hypeConfig;

    SearchTabs(SchemeRepository schemes, SchemeItemRepository schemeItems, WardrobeItemRepository pieces, UserRepository users,
               BrandProfileRepository brands, CelebrityProfileRepository celebrities, BrandRepository catalog,
               ObjectProvider<SearchIndexPort> searchIndex, SchemeService schemeService, SearchVisibility visibility, SearchPeople people,
               SearchSuggestions suggestions, HypeScoreCurrentRepository hypeScores, HypeScoreConfig hypeConfig) {
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.pieces = pieces;
        this.users = users;
        this.brands = brands;
        this.celebrities = celebrities;
        this.catalog = catalog;
        this.searchIndex = searchIndex;
        this.schemeService = schemeService;
        this.visibility = visibility;
        this.people = people;
        this.suggestions = suggestions;
        this.hypeScores = hypeScores;
        this.hypeConfig = hypeConfig;
    }

    Map<String, Object> search(CurrentUser viewer, String rawTerm, String tab, Filters filters, int size, String rawCursor) {
        String term = InputSanitizer.clean(rawTerm == null ? "" : rawTerm, 80).trim();
        String t = tab == null ? "LOOKS" : tab.toUpperCase(Locale.ROOT);
        if (!TABS.contains(t)) {
            throw ApiException.badRequest("ABA_INVALIDA", "Abas: " + TABS);
        }
        int limit = Math.max(1, Math.min(size <= 0 ? 30 : size, 60));
        int offset = offsetOf(rawCursor);
        parseLevel(filters == null ? null : filters.hypeLevel());   // faixa inválida = 400 antes de buscar
        Set<UUID> blocked = visibility.blockedFor(viewer == null ? null : viewer.id());
        Pageable page = PageRequest.of(0, 400);
        int want = offset + limit + 1; // um a mais para saber se existe próxima página
        String needle = term.toLowerCase(Locale.ROOT);
        List<?> all = switch (t) {
            case "LOOKS" -> looks(viewer, term, filters, blocked, page, want);
            case "PECAS" -> pieces(viewer, term, filters, blocked, page, want);
            case "PESSOAS" -> users.searchPersonalProfiles(term, viewer != null && User.isTestUsername(viewer.username()),
                    blocked.isEmpty() ? List.of(new UUID(0, 0)) : blocked, PageRequest.of(0, want));
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
        out.put("results", "PESSOAS".equals(t) ? people.personProfiles(viewer, results.stream().map(PublicPersonHeader.class::cast).toList()) : results);
        out.put("nextCursor", nextCursor);
        out.put("chips", filters == null ? List.of() : filters.chips());
        out.put("engine", searchIndex.getIfAvailable() != null && searchIndex.getIfAvailable().enabled() ? "opensearch" : "mysql");
        if (results.isEmpty() && offset == 0) {
            // A people search has no reason to hydrate unrelated look owners (and their private account attributes).
            List<Views.SchemeView> hot = "PESSOAS".equals(t) ? List.of() : suggestions.trending(viewer, blocked);
            List<String> alts = suggestions.alternatives(term);
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

    private Map<UUID, HypeScoreCurrent> hypeRows(HypeEntityType type, Collection<UUID> ids) {
        return SearchHype.hypeRows(hypeScores, hypeConfig, type, ids);
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
            if (!visibility.visible(viewer, s, blocked) || !meetsLevel(hype.get(s.getId()), min, hypeConfig)) {
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
        return base.stream().filter(w -> visibility.visible(viewer, w, blocked)).filter(w -> matches(f, w))
                .filter(w -> meetsLevel(hype.get(w.getId()), min, hypeConfig))
                .limit(limit).map(w -> Views.piece(w, null, null)).toList();
    }
}
