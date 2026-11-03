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
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.repository.BrandRepository;
import br.com.fashionai.domain.repository.CatalogProductRepository;
import br.com.fashionai.domain.repository.FlairCardInstanceRepository;
import br.com.fashionai.domain.repository.FlairChallengeRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static br.com.fashionai.application.service.FlairCardSnapshot.max;
import static br.com.fashionai.application.service.FlairCardSnapshot.min;
import static br.com.fashionai.application.service.FlairCardSnapshot.notBlank;
import static br.com.fashionai.application.service.FlairCardSnapshot.previewOf;

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
    private final Guard guard;
    private final FlairCardSnapshot snapshot;
    private final FlairCardViews views;

    public FlairCollectionService(FlairCardInstanceRepository cards, WardrobeItemRepository pieces, CatalogProductRepository catalog,
                                  BrandRepository brands, WardrobeService wardrobe, FlairService flair,
                                  HypeScoreCurrentRepository hypeScores, HypeScoreConfig hypeConfig, Guard guard, FlairChallengeRepository challengeRepo) {
        this.cards = cards;
        this.pieces = pieces;
        this.catalog = catalog;
        this.brands = brands;
        this.wardrobe = wardrobe;
        this.flair = flair;
        this.guard = guard;
        this.snapshot = new FlairCardSnapshot(catalog, brands, hypeScores, hypeConfig);
        this.views = new FlairCardViews(challengeRepo);
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
        cards.findByOriginTypeAndOriginIdAndSeason("PIECE", w.getId(), FlairService.season()).ifPresent(c -> out.put("existing", views.view(c, true)));
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
        c.setHypeJson(snapshot.hypeSnapshot(w.getId()));
        c.setTagsJson(Json.write(tagsOf(w)));
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("stats", engine.stats());
        stats.put("rarity", engine.rarity());
        stats.put("power", engine.power());
        stats.put("ability", engine.ability());
        c.setStatsJson(Json.write(stats));
        c.setBasisJson(Json.write(r.basis()));
        c.setPriceVerified(r.priceVerified());
        cards.save(c);
        return views.view(c, true);
    }

    // ------------------------------------------------------------------ coleção
    @Transactional(readOnly = true)
    public Map<String, Object> mine(CurrentUser user, UUID originId) {
        List<FlairCardInstance> list = cards.findByOwnerIdOrderByCreatedAtDesc(user.id()).stream()
                .filter(c -> originId == null || originId.equals(c.getOriginId())).toList();
        return views.collection(list, true);
    }

    /** Coleção de outra pessoa: só as cartas de peças que quem vê pode abrir (as privadas ficam para a dona). */
    @Transactional(readOnly = true)
    public Map<String, Object> ofUser(CurrentUser viewer, UUID ownerId) {
        if (viewer != null && viewer.id().equals(ownerId)) {
            return mine(viewer, null);
        }
        List<FlairCardInstance> list = cards.findByOwnerIdOrderByCreatedAtDesc(ownerId).stream()
                .filter(c -> visible(viewer, c)).toList();
        return views.collection(list, false);
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

    // ------------------------------------------------------------------ apoio
    FlairTier.Result tierOf(WardrobeItem w) {
        return snapshot.tierOf(w);
    }

    /** Estilos, ocasiões, cor e material da peça (requisitos e sintonia dos Desafios de Montagem, FLAIR-UT §14.5). */
    static Map<String, Object> tagsOf(WardrobeItem w) {
        return FlairCardSnapshot.tagsOf(w);
    }
}
