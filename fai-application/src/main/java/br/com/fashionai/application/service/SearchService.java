package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.ports.SearchIndexPort;
import br.com.fashionai.application.ports.TimelineProjectionPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.BrandRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.FollowRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.PublicPersonHeader;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.SealBondRepository;
import br.com.fashionai.domain.repository.ShareRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

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

    // Colaboradores por caso de uso (package-private, sem Spring): o serviço é a fachada transacional.
    final SearchVisibility visibility;
    final SearchCommunityFeed feed;
    final SearchFollowingRunway following;
    final SearchPeople people;
    final SearchSuggestions suggestions;
    final SearchTabs tabs;
    final SearchPublicPieces publicPieceWindow;

    public SearchService(SchemeRepository schemes, SchemeItemRepository schemeItems, WardrobeItemRepository pieces, UserRepository users,
                         BrandProfileRepository brands, CelebrityProfileRepository celebrities, FollowRepository follows, ShareRepository shares,
                         SealBondRepository bonds, StyleDnaRepository dnas, ObjectProvider<SearchIndexPort> searchIndex,
                         ObjectProvider<TimelineProjectionPort> timeline, SchemeService schemeService, ChallengeService challenges, Guard guard,
                         BrandRepository catalog, HypeScoreCurrentRepository hypeScores, HypeScoreConfig hypeConfig) {
        this.visibility = new SearchVisibility(follows, schemeService, guard);
        this.feed = new SearchCommunityFeed(schemes, schemeItems, pieces, shares, dnas, schemeService, visibility, hypeScores, hypeConfig);
        this.following = new SearchFollowingRunway(schemes, schemeItems, pieces, users, follows, shares, bonds, timeline, schemeService, challenges,
                visibility);
        this.people = new SearchPeople(follows, pieces, schemes);
        this.suggestions = new SearchSuggestions(schemes, schemeItems, brands, schemeService, visibility, hypeScores, hypeConfig);
        this.tabs = new SearchTabs(schemes, schemeItems, pieces, users, brands, celebrities, catalog, searchIndex, schemeService, visibility, people,
                suggestions, hypeScores, hypeConfig);
        this.publicPieceWindow = new SearchPublicPieces(pieces, visibility, hypeScores, hypeConfig);
    }

    // ================================================================== visibilidade (CA05)
    boolean visible(CurrentUser viewer, Scheme s, Set<UUID> blocked) {
        return visibility.visible(viewer, s, blocked);
    }

    boolean visible(CurrentUser viewer, WardrobeItem w, Set<UUID> blocked) {
        return visibility.visible(viewer, w, blocked);
    }

    // ================================================================== feed comunitário (CA01/CA06)
    @Transactional(readOnly = true)
    public Map<String, Object> communityFeed(CurrentUser viewer, String rawCursor, int size, Filters filters) {
        return feed.communityFeed(viewer, rawCursor, size, filters);
    }

    // ================================================================== The Runway (RF7/RF19)
    @Transactional(readOnly = true)
    public Map<String, Object> runway(CurrentUser viewer, String rawCursor, int size) {
        return following.runway(viewer, rawCursor, size);
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
        return tabs.search(viewer, rawTerm, tab, filters, size, rawCursor);
    }

    /** Apenas campos já públicos no cabeçalho do perfil; nunca e-mail, telefone, nascimento ou entidades JPA. */
    public record PersonProfile(UUID id, String username, String displayName, String avatarUrl, String profileType,
                                boolean verified, String country, boolean privateAccount, String coverUrl, String bio,
                                String pronouns, List<Map<String, Object>> links, String visibility, boolean contentVisible,
                                String relation, Map<String, Long> counters) { }

    List<PersonProfile> personProfiles(CurrentUser viewer, List<PublicPersonHeader> page) {
        return people.personProfiles(viewer, page);
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

    // ================================================================== Peças Públicas (vitrine)
    @Transactional(readOnly = true)
    public Map<String, Object> publicPieces(CurrentUser viewer, Filters f, String rawCursor, int size) {
        return publicPieceWindow.publicPieces(viewer, f, rawCursor, size);
    }
}
