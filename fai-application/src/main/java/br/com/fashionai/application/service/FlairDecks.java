package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.FlairEngine;
import br.com.fashionai.application.flair.FlairEngine.Card;
import br.com.fashionai.application.flair.FlairEngine.Deck;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.Model3dStatus;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.data.domain.PageRequest;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Random;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.FlairService.season;
import static br.com.fashionai.application.service.FlairService.today;

/**
 * Cartas e decks do {@link FlairService}: o Hype v2 público das peças e dos looks (lido do job, nunca recalculado), a
 * carta de cada peça, o deck de cada esquema, o álbum de raridades, o deck da Casa do dia e o melhor deck público.
 */
final class FlairDecks {
    private final WardrobeItemRepository pieces;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final SchemeService schemeService;
    private final HypeScoreCurrentRepository hypeScores;
    private final HypeScoreConfig hypeConfig;

    FlairDecks(WardrobeItemRepository pieces, SchemeRepository schemes, SchemeItemRepository schemeItems, SchemeService schemeService,
               HypeScoreCurrentRepository hypeScores, HypeScoreConfig hypeConfig) {
        this.pieces = pieces;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.schemeService = schemeService;
        this.hypeScores = hypeScores;
        this.hypeConfig = hypeConfig;
    }

    // ================================================================== HypeScore v2 (RF53 · Lote 8)

    /** Estados v2 de várias entidades numa consulta (o que o job gravou; o jogo nunca recalcula). */
    Map<UUID, HypeScoreCurrent> hypeStates(HypeEntityType type, Collection<UUID> ids) {
        List<UUID> list = ids == null ? List.of() : ids.stream().filter(Objects::nonNull).distinct().toList();
        if (list.isEmpty()) {
            return Map.of();
        }
        return hypeScores.findByEntityTypeAndEntityIdInAndAlgorithmVersion(type, list, hypeConfig.algorithmVersion()).stream()
                .collect(Collectors.toMap(HypeScoreCurrent::getEntityId, Function.identity(), (a, b) -> a));
    }

    /** Hype v2 como o jogo enxerga a peça: só o público ({@link FlairEngine.Hype#of}); sem linha = {@code NONE}. */
    static FlairEngine.Hype gameHype(HypeScoreCurrent c) {
        if (c == null) {
            return FlairEngine.Hype.NONE;
        }
        BigDecimal rarity = c.getDimensions() == null ? null : c.getDimensions().getRarity();
        return FlairEngine.Hype.of(c.isPublicEligible(), c.getStatus() == null ? null : c.getStatus().name(),
                c.getScore() == null ? null : c.getScore().doubleValue(), c.getLevel() == null ? null : c.getLevel().name(),
                rarity == null ? null : rarity.doubleValue());
    }

    /** HypeScore v2 PÚBLICO de looks (atributo HYPE do FLAIR): ausente no mapa = sem Hype público (neutro no jogo). */
    public Map<UUID, Double> publicLookHype(Collection<UUID> schemeIds) {
        Map<UUID, Double> out = new LinkedHashMap<>();
        hypeStates(HypeEntityType.SCHEME, schemeIds).forEach((id, c) -> {
            Double score = gameHype(c).score();
            if (score != null) {
                out.put(id, score);
            }
        });
        return out;
    }

    public Double publicLookHype(UUID schemeId) {
        return schemeId == null ? null : publicLookHype(List.of(schemeId)).get(schemeId);
    }

    /** Cartas de várias peças com o Hype v2 em lote (uma consulta para todas). */
    public List<Card> cardsOf(List<WardrobeItem> ws) {
        Map<UUID, HypeScoreCurrent> states = hypeStates(HypeEntityType.PIECE, ws.stream().map(WardrobeItem::getId).toList());
        String season = season();
        return ws.stream().map(w -> FlairEngine.card(input(w, gameHype(states.get(w.getId()))), season)).toList();
    }

    FlairEngine.PieceInput input(WardrobeItem w, FlairEngine.Hype hype) {
        BrandProfile bp = w.getBrandProfile();
        Object overall = Json.map(w.getPhotoQualityScoresJson()).get("overall");
        String brandName = w.getBrandName() != null && !w.getBrandName().isBlank() ? w.getBrandName() : bp != null ? bp.getBrandName() : null;
        return new FlairEngine.PieceInput(w.getId().toString(), w.getName(), w.getCategory(), w.getSubcategory(),
                w.getStudioImageUrl() != null ? Views.studioThumb(w.getStudioImageUrl()) : w.getThumbnailUrl() != null ? w.getThumbnailUrl() : w.getImageUrl(),
                Taxonomy.hex(w.getColor()), brandName, bp != null || w.getBrand() != null, bp == null ? null : bp.getOwner().getId().toString(),
                Json.csv(w.getStyleTags()), Json.csv(w.getOccasionTags()), w.getMaterial(), overall instanceof Number n ? n.doubleValue() : null,
                w.getStudioImageUrl() != null, w.getStudioDetailUrl() != null, w.getModel3dStatus() == Model3dStatus.COMPLETED,
                w.getMannequinImageUrl() != null, w.isDefaultImage(), hype, Json.strings(w.getSealIdsJson()).size());
    }

    /** Uma carta (o Hype v2 da peça numa consulta); para várias, {@link #cardsOf}. */
    Card card(WardrobeItem w) {
        return cardsOf(List.of(w)).get(0);
    }

    Deck deck(Scheme s) {
        List<Card> cards = cardsOf(schemeItems.findBySchemeIdOrderBySortOrder(s.getId()).stream().map(SchemeItem::getWardrobeItem)
                .filter(Objects::nonNull).toList());
        return FlairEngine.deck(s.getId().toString(), s.getTitle(), cards, s.getSeason() == null ? null : s.getSeason().name(), season());
    }

    public Map<String, Object> cards(CurrentUser user) {
        List<Card> cs = cardsOf(pieces.findByUserIdOrderByCreatedAtDesc(user.id()).stream()
                .filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED).toList());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("season", season());
        out.put("cards", cs);
        out.put("album", album(cs));
        return out;
    }

    /** Álbum: para cada categoria, as 4 raridades — completa quem tem carta de cada. */
    static Map<String, Object> album(List<Card> cs) {
        List<String> cats = List.of("upper_piece", "lower_piece", "shoes_piece", "accessory_piece", "full_body_piece");
        List<Map<String, Object>> rows = new ArrayList<>();
        int got = 0;
        for (String c : cats) {
            Map<String, Boolean> have = new LinkedHashMap<>();
            for (String r : FlairEngine.RARITIES) {
                boolean h = cs.stream().anyMatch(x -> c.equals(x.category()) && r.equals(x.rarity()));
                have.put(r, h);
                got += h ? 1 : 0;
            }
            rows.add(Map.of("category", c, "rarities", have));
        }
        return Map.of("slots", cats.size() * FlairEngine.RARITIES.size(), "collected", got, "rows", rows);
    }

    public List<Deck> decks(CurrentUser user) {
        return schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(user.id(), SchemeStatus.ARCHIVED).stream()
                .map(this::deck).filter(d -> !d.cards().isEmpty()).sorted(Comparator.comparingInt(Deck::power).reversed()).toList();
    }

    public Deck deckOf(CurrentUser viewer, UUID schemeId) {
        Scheme s = schemes.findById(schemeId).orElseThrow(() -> ApiException.notFound("Esquema"));
        if (!schemeService.canView(viewer, s)) {
            throw ApiException.notFound("Esquema");
        }
        return deck(s);
    }

    Scheme ownDeckScheme(CurrentUser user, UUID schemeId) {
        Scheme s = schemeService.owned(user, schemeId);
        if (s.getStatus() == SchemeStatus.ARCHIVED) {
            throw ApiException.badRequest("DECK_ARQUIVADO", Msg.t("flair.esse_esquema_esta_arquivado"));
        }
        return s;
    }

    /** Deck da Casa do dia: uma peça pública de cada categoria, sorteada pela data (igual para todos no dia). */
    Deck houseDeck() {
        List<WardrobeItem> pub = pieces.findAllPublic(PageRequest.of(0, 400));
        Random r = new Random(today().toEpochDay());
        List<WardrobeItem> picked = new ArrayList<>();
        for (String cat : List.of("upper_piece", "lower_piece", "shoes_piece", "accessory_piece")) {
            List<WardrobeItem> c = pub.stream().filter(w -> cat.equals(w.getCategory())).toList();
            if (!c.isEmpty()) {
                picked.add(c.get(r.nextInt(c.size())));
            }
        }
        return FlairEngine.deck(null, Msg.t("flair.deck_da_casa", today()), cardsOf(picked), season(), season());
    }

    /** Melhor deck público de outra pessoa (o que ela mostraria numa vitrine). */
    Optional<Map.Entry<Scheme, Deck>> bestPublicDeck(CurrentUser viewer, User owner) {
        return schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(owner.getId(), SchemeStatus.ARCHIVED).stream()
                .filter(s -> s.getStatus() == SchemeStatus.PUBLISHED && schemeService.canView(viewer, s))
                .map(s -> Map.entry(s, deck(s))).filter(e -> !e.getValue().cards().isEmpty())
                .max(Comparator.comparingInt(e -> e.getValue().power()));
    }

}
