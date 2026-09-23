package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.local.Similarity;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.ports.SearchIndexPort;
import br.com.fashionai.application.ports.TimelineProjectionPort;
import br.com.fashionai.domain.model.ItemEmbedding;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.FollowStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.repository.FollowRepository;
import br.com.fashionai.domain.repository.ItemEmbeddingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Projeções derivadas do MySQL (persistência poliglota): embeddings locais (Acervo Grouping / Affinity /
 * SealBond), índice OpenSearch (RF8/RF14/RF22/RF26) e timeline Cassandra (fan-out on write). Falha de
 * projeção nunca desfaz a escrita principal — consistência eventual.
 */
@Service
public class ProjectionService {
    private static final Logger log = LoggerFactory.getLogger(ProjectionService.class);

    private final ItemEmbeddingRepository embeddings;
    private final SearchIndexPort search;
    private final TimelineProjectionPort timeline;
    private final FollowRepository follows;

    public ProjectionService(ItemEmbeddingRepository embeddings, SearchIndexPort search, TimelineProjectionPort timeline,
                             FollowRepository follows) {
        this.embeddings = embeddings;
        this.search = search;
        this.timeline = timeline;
        this.follows = follows;
    }

    public void piece(WardrobeItem w) {
        try {
            upsert(HypeEntityType.PIECE, w.getId(), w.getUser().getId(), Similarity.embed(w));
        } catch (RuntimeException ex) {
            log.warn("embedding da peça {} falhou: {}", w.getId(), ex.getMessage());
        }
        try {
            if (search.enabled()) {
                Map<String, Object> doc = new LinkedHashMap<>();
                doc.put("name", w.getName());
                doc.put("category", w.getCategory());
                doc.put("subcategory", w.getSubcategory());
                doc.put("color", w.getColor());
                doc.put("brand", w.getBrand() != null ? w.getBrand().getName() : w.getBrandName());
                doc.put("style", Json.csv(w.getStyleTags()));
                doc.put("occasion", Json.csv(w.getOccasionTags()));
                doc.put("sex", w.getSex());
                doc.put("market", w.getMarket());
                doc.put("country", w.getUser().getCountry());
                doc.put("visibility", w.getVisibility().name());
                doc.put("moderation", w.getModerationStatus().name());
                doc.put("ownerId", w.getUser().getId().toString());
                doc.put("hypeScore", w.getHypeScore());
                search.index("pieces", w.getId(), doc);
            }
        } catch (RuntimeException ex) {
            log.warn("indexação da peça {} falhou: {}", w.getId(), ex.getMessage());
        }
    }

    public void scheme(Scheme s, List<SchemeItem> items) {
        try {
            upsert(HypeEntityType.SCHEME, s.getId(), s.getUser().getId(), Similarity.embed(s, items));
        } catch (RuntimeException ex) {
            log.warn("embedding do esquema {} falhou: {}", s.getId(), ex.getMessage());
        }
        try {
            if (search.enabled()) {
                Map<String, Object> doc = new LinkedHashMap<>();
                doc.put("title", s.getTitle());
                doc.put("description", s.getDescription());
                doc.put("style", Json.csv(s.getStyle()));
                doc.put("occasion", Json.csv(s.getOccasion()));
                doc.put("season", s.getSeason() == null ? null : s.getSeason().name());
                doc.put("tags", Json.csv(s.getTags()));
                doc.put("colors", items.stream().map(i -> i.getWardrobeItem().getColor()).distinct().toList());
                doc.put("brands", items.stream().map(i -> i.getWardrobeItem().getBrandName()).filter(b -> b != null).distinct().toList());
                doc.put("country", s.getUser().getCountry());
                doc.put("visibility", s.getVisibility().name());
                doc.put("status", s.getStatus().name());
                doc.put("ownerId", s.getUser().getId().toString());
                doc.put("hypeScore", s.getHypeScore());
                search.index("schemes", s.getId(), doc);
            }
        } catch (RuntimeException ex) {
            log.warn("indexação do esquema {} falhou: {}", s.getId(), ex.getMessage());
        }
    }

    public void removeScheme(UUID id) {
        try {
            search.remove("schemes", id);
        } catch (RuntimeException ignored) {
            // índice indisponível
        }
    }

    public void removePiece(UUID id) {
        try {
            search.remove("pieces", id);
        } catch (RuntimeException ignored) {
            // índice indisponível
        }
    }

    /** Fan-out on write da publicação para a timeline dos seguidores (Cassandra). */
    public void published(Scheme s) {
        try {
            if (timeline.enabled()) {
                List<UUID> followers = follows.findByFollowingIdAndStatus(s.getUser().getId(), FollowStatus.ACEITO).stream()
                        .map(f -> f.getFollower().getId()).toList();
                timeline.appendSchemePublished(s.getUser().getId(), s.getId());
                timeline.fanOut(s.getUser().getId(), followers, s.getId(), s.getPublishedAt() == null ? Instant.now() : s.getPublishedAt());
            }
        } catch (RuntimeException ex) {
            log.warn("fan-out da timeline falhou (feed cai no MySQL): {}", ex.getMessage());
        }
    }

    private void upsert(HypeEntityType type, UUID id, UUID userId, double[] vector) {
        ItemEmbedding e = embeddings.findByEntityTypeAndEntityId(type, id).orElseGet(ItemEmbedding::new);
        e.setEntityType(type);
        e.setEntityId(id);
        e.setUserId(userId);
        e.setProvider("local-attributes-v1");
        e.setDimensions(vector.length);
        e.setVectorJson(Json.write(vector));
        embeddings.save(e);
    }
}
