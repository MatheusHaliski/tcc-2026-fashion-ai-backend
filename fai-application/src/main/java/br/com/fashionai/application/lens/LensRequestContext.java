package br.com.fashionai.application.lens;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.hype.RecommendationScoring;
import br.com.fashionai.application.hype.StyleCompatibility;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.WardrobeService;
import br.com.fashionai.application.vision.analysis.GarmentEmbedder;
import br.com.fashionai.domain.model.GarmentEmbedding;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.repository.GarmentEmbeddingRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.PieceImageRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Contexto de um pedido do Lens (era {@code LensService.Ctx}): carrega sob demanda e uma vez por pedido o que a camada
 * viva precisa (guarda-roupa, DNA, Hype público…). As fontes são os repositórios do {@link LensService}.
 */
final class LensRequestContext {
    private static final Logger log = LoggerFactory.getLogger(LensService.class);

    /** Repositórios lidos pela camada viva; {@link #open} cria o contexto de um pedido. */
    record Sources(WardrobeItemRepository pieces, SchemeRepository schemes, SchemeItemRepository schemeItems,
                   StyleDnaRepository dnas, HypeScoreCurrentRepository hypeScores, HypeScoreConfig hypeConfig,
                   GarmentEmbeddingRepository embeddings, PieceImageRepository pieceImages, Guard guard) {
        LensRequestContext open(CurrentUser user) {
            return new LensRequestContext(this, user);
        }
    }

    private final Sources src;
    private final CurrentUser user;
    private List<WardrobeItem> closet;
    private Map<UUID, float[]> closetEmbeddings;
    private StyleCompatibility.Profile dna;
    private boolean dnaLoaded;
    private Set<String> seenPairs;
    private final Map<String, List<LensReading.Member>> groups = new HashMap<>();
    private final Map<String, List<WardrobeItem>> community = new HashMap<>();

    LensRequestContext(Sources src, CurrentUser user) {
        this.src = src;
        this.user = user;
    }

    List<WardrobeItem> closet() {
        if (closet == null) {
            closet = src.pieces().findByUserIdOrderByCreatedAtDesc(user.id()).stream()
                    .filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED).toList();
        }
        return closet;
    }

    /** Embeddings visuais das peças próprias (garment_embeddings do mesmo modelo), quando o backfill já existe. */
    float[] embeddingOf(UUID pieceId) {
        if (closetEmbeddings == null) {
            closetEmbeddings = new HashMap<>();
            try {
                List<GarmentEmbedding> rows = src.embeddings().findByUserId(user.id()).stream()
                        .filter(e -> GarmentEmbedder.MODEL.key().equals(e.getModelVersion())).toList();
                if (!rows.isEmpty()) {
                    Set<UUID> mine = closet().stream().map(WardrobeItem::getId).collect(Collectors.toSet());
                    Map<UUID, UUID> imageToPiece = new HashMap<>();
                    src.pieceImages().findAllById(rows.stream().map(GarmentEmbedding::getImageId).toList())
                            .forEach(img -> imageToPiece.put(img.getId(), img.getPieceId()));
                    for (GarmentEmbedding e : rows) {
                        UUID piece = mine.contains(e.getImageId()) ? e.getImageId() : imageToPiece.get(e.getImageId());
                        float[] v = LensDetectionFields.embedding(e.getVectorJson());
                        if (piece != null && v != null) {
                            closetEmbeddings.putIfAbsent(piece, v);
                        }
                    }
                }
            } catch (RuntimeException ex) {
                log.debug("Lens: embeddings do guarda-roupa indisponíveis ({})", ex.toString());
            }
        }
        return closetEmbeddings.get(pieceId);
    }

    StyleCompatibility.Profile dna() {
        if (!dnaLoaded) {
            dna = src.dnas().findByUserId(user.id()).map(HypeQueryService::profileOf).filter(p -> !p.empty()).orElse(null);
            dnaLoaded = true;
        }
        return dna;
    }

    /** Pares de peças que a pessoa já combinou em looks (novidade do plano). */
    Set<String> seenPairs() {
        if (seenPairs == null) {
            seenPairs = new HashSet<>();
            List<Scheme> mine = src.schemes().findByUserIdOrderByCreatedAtDesc(user.id());
            if (!mine.isEmpty()) {
                src.schemeItems().findBySchemeIdIn(mine.stream().map(Scheme::getId).toList()).stream()
                        .filter(si -> si.getWardrobeItem() != null)
                        .collect(Collectors.groupingBy(si -> si.getScheme().getId(),
                                Collectors.mapping(si -> si.getWardrobeItem().getId(), Collectors.toList())))
                        .values().forEach(ids -> {
                            for (int a = 0; a < ids.size(); a++) {
                                for (int b = a + 1; b < ids.size(); b++) {
                                    seenPairs.add(RecommendationScoring.pair(ids.get(a), ids.get(b)));
                                }
                            }
                        });
            }
        }
        return seenPairs;
    }

    /** Peças públicas com Hype disponível na categoria, com as chaves de atributo de cada uma. */
    List<LensReading.Member> publicGroup(String category) {
        return groups.computeIfAbsent(category == null ? "" : category, c -> {
            if (c.isEmpty()) {
                return List.of();
            }
            List<HypeScoreCurrent> rows = src.hypeScores().findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(
                            HypeEntityType.PIECE, src.hypeConfig().algorithmVersion(), HypeStatus.AVAILABLE).stream()
                    .filter(r -> r.getScore() != null && c.equals(r.getCategory())).toList();
            if (rows.isEmpty()) {
                return List.of();
            }
            Map<UUID, WardrobeItem> byId = src.pieces().findByIdIn(rows.stream().map(HypeScoreCurrent::getEntityId).toList())
                    .stream().collect(Collectors.toMap(WardrobeItem::getId, w -> w, (a, b) -> a));
            List<LensReading.Member> out = new ArrayList<>();
            for (HypeScoreCurrent r : rows) {
                WardrobeItem w = byId.get(r.getEntityId());
                if (w == null) {
                    continue;
                }
                Set<String> keys = new HashSet<>(LensReading.groupKeys(w.getCategory(), w.getColor(), w.getMaterial(),
                        Json.csv(w.getStyleTags())));
                out.add(new LensReading.Member(keys, r.getScore().doubleValue(),
                        r.getDeltaPoints() == null ? null : r.getDeltaPoints().doubleValue()));
            }
            return out;
        });
    }

    /** Candidatas da comunidade (públicas e elegíveis, de outras pessoas, visíveis para quem pede agora). */
    List<WardrobeItem> community(String category) {
        return community.computeIfAbsent(category == null ? "" : category, c -> {
            List<HypeScoreCurrent> rows = new ArrayList<>();
            for (HypeStatus st : HypeStatus.values()) {
                rows.addAll(src.hypeScores().findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(
                        HypeEntityType.PIECE, src.hypeConfig().algorithmVersion(), st));
            }
            List<UUID> ids = rows.stream()
                    .filter(r -> r.isPublicEligible() && !user.id().equals(r.getOwnerId()))
                    .filter(r -> c.isEmpty() || r.getCategory() == null || c.equals(r.getCategory()))
                    .map(HypeScoreCurrent::getEntityId).distinct().toList();
            if (ids.isEmpty()) {
                return List.of();
            }
            return src.pieces().findByIdIn(ids).stream()
                    .filter(w -> w.getUser() != null && !user.id().equals(w.getUser().getId()))
                    .filter(w -> c.isEmpty() || c.equals(w.getCategory()))
                    .filter(w -> w.getModerationStatus() == ModerationStatus.APPROVED)
                    .filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED)
                    .filter(w -> WardrobeService.effectiveVisibility(w) == br.com.fashionai.domain.model.enums.Visibility.PUBLIC)
                    .filter(w -> src.guard().canView(user, w.getUser().getId(), WardrobeService.effectiveVisibility(w)))
                    .toList();
        });
    }
}
