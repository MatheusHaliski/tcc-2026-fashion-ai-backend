package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.FlairEngine;
import br.com.fashionai.application.flair.FlairTier;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.Brand;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.FlairCardInstance;
import br.com.fashionai.domain.model.HypeDimensions;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.Model3dStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.repository.BrandRepository;
import br.com.fashionai.domain.repository.CatalogProductRepository;
import br.com.fashionai.domain.repository.FlairCardInstanceRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * FLAIR-UT F3 — "Converter para FLAIR" e "Minhas cartas FLAIR" (docs/plano/FLAIR_UT_Cartas_e_Desafios.md §4, §5, D6, D11).
 *
 * <ul>
 *   <li>Converter <b>duplica</b>: a peça e o card do guarda-roupa ficam onde estão (o card é o post social); a carta FLAIR
 *   é uma cópia com o retrato do dia (foto, nome, marca, nota, nível, Hype) e vai para "Minhas cartas FLAIR".</li>
 *   <li>Converter <b>nunca publica no feed</b>: só o Compartilhar faz isso, e só quando a pessoa liga a opção.</li>
 *   <li>Uma carta por peça por temporada (D6): converter de novo devolve 409 com a carta que já existe.</li>
 *   <li>Quem visita o perfil vê só as cartas de peças que pode abrir; as de peças privadas ficam para a dona.</li>
 * </ul>
 */
@Service
public class FlairCollectionService {
    static final List<String> TIERS = List.of("ESPECIAL", "OURO", "PRATA", "BRONZE");
    static final Set<String> RARE = Set.of("LIMITED", "RARE");

    private final FlairCardInstanceRepository cards;
    private final WardrobeItemRepository pieces;
    private final CatalogProductRepository catalog;
    private final BrandRepository brands;
    private final WardrobeService wardrobe;
    private final FlairService flair;
    private final HypeScoreCurrentRepository hypeScores;
    private final HypeScoreConfig hypeConfig;
    private final Guard guard;

    public FlairCollectionService(FlairCardInstanceRepository cards, WardrobeItemRepository pieces, CatalogProductRepository catalog,
                                  BrandRepository brands, WardrobeService wardrobe, FlairService flair,
                                  HypeScoreCurrentRepository hypeScores, HypeScoreConfig hypeConfig, Guard guard) {
        this.cards = cards;
        this.pieces = pieces;
        this.catalog = catalog;
        this.brands = brands;
        this.wardrobe = wardrobe;
        this.flair = flair;
        this.hypeScores = hypeScores;
        this.hypeConfig = hypeConfig;
        this.guard = guard;
    }

    /** Rascunho do criador (a peça ainda não existe): os campos do formulário e o produto do catálogo, se houver. */
    public record Draft(String category, String subcategory, BigDecimal price, String brandName, UUID brandId,
                        UUID catalogProductId, List<String> styles, List<String> occasions, String color, String material) {
    }

    // ------------------------------------------------------------------ prévia (sem gravar)
    /** Prévia no criador: nota, nível e o que decidiu o nível, a partir do rascunho. */
    @Transactional(readOnly = true)
    public Map<String, Object> previewDraft(Draft d) {
        Brand brand = d.brandId() == null ? null : brands.findById(d.brandId()).orElse(null);
        CatalogProduct product = d.catalogProductId() == null ? null : catalog.findById(d.catalogProductId()).orElse(null);
        if (brand == null && product != null) {
            brand = brands.findById(product.getBrandId()).orElse(null);
        }
        FlairTier.Input in = new FlairTier.Input(d.category(), d.subcategory(), d.price() == null ? null : d.price().doubleValue(),
                min(product), max(product), brand == null ? null : brand.getPriceTier(), notBlank(d.brandName()) || brand != null,
                brand != null && brand.getBrandProfile() != null, d.styles() != null && !d.styles().isEmpty(),
                d.occasions() != null && !d.occasions().isEmpty(), notBlank(d.color()), notBlank(d.material()), false, false);
        return previewOf(FlairTier.compute(in), d.category());
    }

    /** Prévia da carta de uma peça já salva (o botão "Converter para FLAIR" do detalhe). */
    @Transactional(readOnly = true)
    public Map<String, Object> previewPiece(CurrentUser user, UUID pieceId) {
        WardrobeItem w = wardrobe.owned(user, pieceId);
        Map<String, Object> out = previewOf(tierOf(w), w.getCategory());
        cards.findByOriginTypeAndOriginIdAndSeason("PIECE", w.getId(), FlairService.season()).ifPresent(c -> out.put("existing", view(c, true)));
        return out;
    }

    // ------------------------------------------------------------------ converter
    @Transactional
    public Map<String, Object> convertPiece(CurrentUser user, UUID pieceId) {
        guard.requireCanCreate(user);
        WardrobeItem w = wardrobe.owned(user, pieceId);
        String season = FlairService.season();
        Optional<FlairCardInstance> existing = cards.findByOriginTypeAndOriginIdAndSeason("PIECE", w.getId(), season);
        if (existing.isPresent()) {
            throw new ApiException(409, "CARTA_JA_EXISTE", Msg.t("flair.carta_ja_existe"), Map.of("cardId", existing.get().getId()));
        }
        FlairTier.Result r = tierOf(w);
        FlairEngine.Card engine = flair.cardsOf(List.of(w)).get(0);
        FlairCardInstance c = new FlairCardInstance();
        c.setOwnerId(user.id());
        c.setCreatorId(user.id());
        c.setOriginType("PIECE");
        c.setOriginId(w.getId());
        c.setSeason(season);
        c.setTier(r.tier());
        c.setOvr(r.ovr());
        c.setRare(RARE.contains(engine.rarity()));
        c.setPosition(FlairTier.position(w.getCategory()));
        c.setName(w.getName());
        c.setBrandName(engine.brandName());
        c.setImageUrl(engine.imageUrl());
        c.setCategory(w.getCategory());
        c.setSubcategory(w.getSubcategory());
        c.setHypeJson(hypeSnapshot(w.getId()));
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("stats", engine.stats());
        stats.put("rarity", engine.rarity());
        stats.put("power", engine.power());
        stats.put("ability", engine.ability());
        c.setStatsJson(Json.write(stats));
        c.setBasisJson(Json.write(r.basis()));
        c.setPriceVerified(r.priceVerified());
        cards.save(c);
        return view(c, true);
    }

    // ------------------------------------------------------------------ coleção
    @Transactional(readOnly = true)
    public Map<String, Object> mine(CurrentUser user, UUID originId) {
        List<FlairCardInstance> list = cards.findByOwnerIdOrderByCreatedAtDesc(user.id()).stream()
                .filter(c -> originId == null || originId.equals(c.getOriginId())).toList();
        return collection(list, true);
    }

    /** Coleção de outra pessoa: só as cartas de peças que quem vê pode abrir (as privadas ficam para a dona). */
    @Transactional(readOnly = true)
    public Map<String, Object> ofUser(CurrentUser viewer, UUID ownerId) {
        if (viewer != null && viewer.id().equals(ownerId)) {
            return mine(viewer, null);
        }
        List<FlairCardInstance> list = cards.findByOwnerIdOrderByCreatedAtDesc(ownerId).stream()
                .filter(c -> visible(viewer, c)).toList();
        return collection(list, false);
    }

    boolean visible(CurrentUser viewer, FlairCardInstance c) {
        if (!"PIECE".equals(c.getOriginType())) {
            return false;
        }
        return pieces.findById(c.getOriginId())
                .filter(w -> w.getModerationStatus() == ModerationStatus.APPROVED)
                .filter(w -> guard.canView(viewer, w.getUser().getId(), WardrobeService.effectiveVisibility(w)))
                .isPresent();
    }

    private Map<String, Object> collection(List<FlairCardInstance> list, boolean mine) {
        Map<String, Long> counts = new LinkedHashMap<>();
        TIERS.forEach(t -> counts.put(t, list.stream().filter(c -> t.equals(c.getTier())).count()));
        List<Map<String, Object>> views = new ArrayList<>();
        list.stream().sorted(Comparator.comparingInt((FlairCardInstance c) -> TIERS.indexOf(c.getTier())).thenComparing(FlairCardInstance::getOvr, Comparator.reverseOrder()))
                .forEach(c -> views.add(view(c, mine)));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("season", FlairService.season());
        out.put("counts", counts);
        out.put("total", list.size());
        out.put("cards", views);
        return out;
    }

    // ------------------------------------------------------------------ apoio
    FlairTier.Result tierOf(WardrobeItem w) {
        CatalogProduct product = w.getCatalogProductId() == null ? null : catalog.findById(w.getCatalogProductId()).orElse(null);
        Brand brand = w.getBrand() != null ? w.getBrand() : product != null ? brands.findById(product.getBrandId()).orElse(null) : null;
        FlairTier.Input in = new FlairTier.Input(w.getCategory(), w.getSubcategory(), w.getPrice() == null ? null : w.getPrice().doubleValue(),
                min(product), max(product), brand == null ? null : brand.getPriceTier(),
                notBlank(w.getBrandName()) || brand != null || w.getBrandProfile() != null, w.getBrandProfile() != null,
                !Json.csv(w.getStyleTags()).isEmpty(), !Json.csv(w.getOccasionTags()).isEmpty(), notBlank(w.getColor()),
                notBlank(w.getMaterial()), w.getStudioImageUrl() != null, w.getModel3dStatus() == Model3dStatus.COMPLETED);
        return FlairTier.compute(in);
    }

    private static Map<String, Object> previewOf(FlairTier.Result r, String category) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ovr", r.ovr());
        out.put("tier", r.tier());
        out.put("position", FlairTier.position(category));
        out.put("priceVerified", r.priceVerified());
        out.put("cappedByUnverifiedPrice", r.cappedByUnverifiedPrice());
        out.put("basis", r.basis());
        out.put("season", FlairService.season());
        return out;
    }

    /** As 7 dimensões do verso + o score, só do Hype PÚBLICO; sem ele, nada (a carta mostra "—", nunca 0). */
    private String hypeSnapshot(UUID pieceId) {
        HypeScoreCurrent h = hypeScores.findByEntityTypeAndEntityIdInAndAlgorithmVersion(HypeEntityType.PIECE, List.of(pieceId),
                hypeConfig.algorithmVersion()).stream().findFirst().orElse(null);
        if (h == null || !h.isPublicEligible() || h.getScore() == null) {
            return null;
        }
        HypeDimensions d = h.getDimensions() == null ? new HypeDimensions() : h.getDimensions();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("POP", num(d.getPopularity()));
        m.put("ENG", num(d.getEngagement()));
        m.put("TRD", num(d.getTrend()));
        m.put("ORI", num(d.getOriginality()));
        m.put("RAR", num(d.getRarity()));
        m.put("LON", num(d.getLongevity()));
        m.put("NOV", num(d.getNovelty()));
        m.put("HYP", num(h.getScore()));
        return Json.write(m);
    }

    Map<String, Object> view(FlairCardInstance c, boolean mine) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", c.getId());
        m.put("originType", c.getOriginType());
        m.put("originId", c.getOriginId());
        m.put("season", c.getSeason());
        m.put("tier", c.getTier());
        m.put("ovr", c.getOvr());
        m.put("rare", c.isRare());
        m.put("position", c.getPosition());
        m.put("name", c.getName());
        m.put("brandName", c.getBrandName());
        m.put("imageUrl", c.getImageUrl());
        m.put("category", c.getCategory());
        m.put("subcategory", c.getSubcategory());
        m.put("hype", c.getHypeJson() == null ? null : Json.map(c.getHypeJson()));
        Map<String, Object> back = c.getStatsJson() == null ? Map.of() : Json.map(c.getStatsJson());
        m.put("stats", back.get("stats"));
        m.put("rarity", back.get("rarity"));
        m.put("ability", back.get("ability"));
        m.put("priceVerified", c.isPriceVerified());
        m.put("state", c.getState());
        m.put("tradeable", c.isTradeable());
        m.put("acquiredVia", c.getAcquiredVia());
        m.put("createdAt", c.getCreatedAt());
        if (mine) {
            m.put("basis", c.getBasisJson() == null ? null : Json.map(c.getBasisJson()));
        }
        return m;
    }

    private static Double min(CatalogProduct p) {
        if (p == null) {
            return null;
        }
        BigDecimal v = p.getPriceMin() != null ? p.getPriceMin() : p.getListPrice();
        return v == null ? null : v.doubleValue();
    }

    private static Double max(CatalogProduct p) {
        if (p == null) {
            return null;
        }
        BigDecimal v = p.getPriceMax() != null ? p.getPriceMax() : p.getListPrice();
        return v == null ? null : v.doubleValue();
    }

    private static Double num(BigDecimal v) {
        return v == null ? null : Math.round(v.doubleValue() * 10) / 10.0;
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
