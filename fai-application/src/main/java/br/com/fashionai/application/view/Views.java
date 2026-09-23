package br.com.fashionai.application.view;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.Notification;
import br.com.fashionai.domain.model.Photo;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Visões expostas pela API (o frontend nunca recebe entidade JPA nem campo cifrado cru). */
public final class Views {
    private Views() {
    }

    public record UserCard(UUID id, String username, String displayName, String avatarUrl, String profileType,
                           boolean verified, String country, boolean privateAccount) {
    }

    public static UserCard user(User u) {
        if (u == null) {
            return null;
        }
        return new UserCard(u.getId(), u.getUsername(), u.getDisplayName(), u.getAvatarUrl(), u.getProfileType().name(),
                u.isVerified(), u.getCountry(), u.isPrivateAccount());
    }

    public record ViewerState(boolean liked, List<String> reactions, boolean saved, boolean canEdit, boolean following) {
        public static final ViewerState NONE = new ViewerState(false, List.of(), false, false, false);
    }

    public record Counters(long likes, long comments, long shares, long remixes, long views, long saves,
                           Map<String, Long> reactions) {
    }

    public record PieceView(UUID id, UserCard owner, String name, String category, String subcategory, String sex,
                            String brandName, UUID brandId, String brandLogoUrl, String color, String colorHex,
                            String material, String size, String market, List<String> style, List<String> occasion,
                            List<String> seals, BigDecimal price, String imageUrl, String originalImageUrl,
                            String thumbnailUrl, boolean defaultImage, String visibility, boolean disponivel,
                            String availabilityStatus, String condition, boolean favorite, boolean forSale,
                            int wearCount, LocalDate lastWornDate, String moderationStatus,
                            String photoProcessingStatus, Map<String, Object> photoQuality,
                            Map<String, Object> flatLayMetadata, Map<String, Object> background, BigDecimal hypeScore,
                            BigDecimal hypeScoreGlobal, UUID remixedFromPieceId, List<String> tags, String notes,
                            LocalDate purchaseDate, String purchaseLocation, String sku, String careInstructions,
                            String model3dStatus, String model3dUrl, Counters counters, ViewerState viewer,
                            boolean notAvailableAnymore, Instant createdAt, Instant updatedAt) {
    }

    public static PieceView piece(WardrobeItem w, ViewerState viewer, Map<String, Long> reactions) {
        return new PieceView(w.getId(), user(w.getUser()), w.getName(), w.getCategory(), w.getSubcategory(), w.getSex(),
                w.getBrand() != null ? w.getBrand().getName() : w.getBrandName(),
                w.getBrand() != null ? w.getBrand().getId() : null, w.getBrand() != null ? w.getBrand().getLogoUrl() : null,
                w.getColor(), Taxonomy.hex(w.getColor()), w.getMaterial(), w.getSizeLabel(), w.getMarket(),
                Json.csv(w.getStyleTags()), Json.csv(w.getOccasionTags()), Json.strings(w.getSealIdsJson()), w.getPrice(),
                w.getImageUrl(), w.getOriginalImageUrl(), w.getThumbnailUrl(), w.isDefaultImage(),
                w.getVisibility().name(), w.isDisponivel(), w.getAvailabilityStatus().name(),
                w.getCondition() == null ? null : w.getCondition().name(), w.isFavorite(), w.isForSale(), w.getWearCount(),
                w.getLastWornDate(), w.getModerationStatus().name(),
                w.getPhotoProcessingStatus() == null ? null : w.getPhotoProcessingStatus().name(),
                Json.map(w.getPhotoQualityScoresJson()), Json.map(w.getFlatLayMetadataJson()),
                Json.map(w.getBackgroundConfigJson()), w.getHypeScore(), w.getHypeScoreGlobal(), w.getRemixedFromPieceId(),
                Json.csv(w.getTags()), w.getNotes(), w.getPurchaseDate(), w.getPurchaseLocation(), w.getSku(),
                w.getCareInstructions(), w.getModel3dStatus() == null ? null : w.getModel3dStatus().name(),
                w.getModel3dUrl(), new Counters(w.getLikesCount(), w.getCommentCount(), w.getSharesCount(),
                w.getRemixesCount(), w.getViewCount(), 0, reactions == null ? Map.of() : reactions),
                viewer == null ? ViewerState.NONE : viewer, w.getAvailabilityStatus() == AvailabilityStatus.ARCHIVED,
                w.getCreatedAt(), w.getUpdatedAt());
    }

    /** Linha compacta da lista de peças do esquema (≤ 18 mm: logo + marca + nome + tipo + tamanho). */
    public record PieceRow(UUID id, String name, String brandName, String brandLogoUrl, String subcategory,
                           String category, String size, String sex, String color, String colorHex, String imageUrl,
                           String thumbnailUrl, BigDecimal price, boolean notAvailableAnymore, UUID ownerId) {
    }

    public static PieceRow row(SchemeItem si) {
        WardrobeItem w = si.getWardrobeItem();
        boolean gone = w == null || w.getAvailabilityStatus() == AvailabilityStatus.ARCHIVED;
        if (gone && si.getSnapshotJson() != null) {
            Map<String, Object> snap = Json.map(si.getSnapshotJson());
            return new PieceRow(w == null ? null : w.getId(), (String) snap.get("name"), (String) snap.get("brandName"),
                    (String) snap.get("brandLogoUrl"), (String) snap.get("subcategory"), (String) snap.get("category"),
                    (String) snap.get("size"), (String) snap.get("sex"), (String) snap.get("color"),
                    Taxonomy.hex((String) snap.get("color")), (String) snap.get("imageUrl"), (String) snap.get("thumbnailUrl"),
                    snap.get("price") == null ? null : new BigDecimal(String.valueOf(snap.get("price"))), true,
                    w == null ? null : w.getUser().getId());
        }
        return new PieceRow(w.getId(), w.getName(), w.getBrand() != null ? w.getBrand().getName() : w.getBrandName(),
                w.getBrand() != null ? w.getBrand().getLogoUrl() : null, w.getSubcategory(), w.getCategory(), w.getSizeLabel(),
                w.getSex(), w.getColor(), Taxonomy.hex(w.getColor()), w.getImageUrl(), w.getThumbnailUrl(), w.getPrice(), gone,
                w.getUser().getId());
    }

    public static Map<String, Object> snapshot(WardrobeItem w) {
        java.util.LinkedHashMap<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("name", w.getName());
        m.put("brandName", w.getBrand() != null ? w.getBrand().getName() : w.getBrandName());
        m.put("brandLogoUrl", w.getBrand() != null ? w.getBrand().getLogoUrl() : null);
        m.put("category", w.getCategory());
        m.put("subcategory", w.getSubcategory());
        m.put("size", w.getSizeLabel());
        m.put("sex", w.getSex());
        m.put("color", w.getColor());
        m.put("imageUrl", w.getImageUrl());
        m.put("thumbnailUrl", w.getThumbnailUrl());
        m.put("price", w.getPrice());
        m.put("capturedAt", Instant.now().toString());
        return m;
    }

    public record SchemeItemView(UUID id, UUID wardrobeItemId, String slot, String tryOnLayer, int sortOrder, int zIndex,
                                 BigDecimal positionX, BigDecimal positionY, BigDecimal scale, BigDecimal rotation,
                                 BigDecimal opacity, Map<String, Object> filters, PieceRow piece) {
    }

    public static SchemeItemView item(SchemeItem si) {
        return new SchemeItemView(si.getId(), si.getWardrobeItem() == null ? null : si.getWardrobeItem().getId(),
                si.getSlot().name(), si.getTryOnLayer() == null ? null : si.getTryOnLayer().name(), si.getSortOrder(),
                si.getZIndex(), si.getPositionX(), si.getPositionY(), si.getScale(), si.getRotation(), si.getOpacity(),
                Json.map(si.getFiltersJson()), row(si));
    }

    public record SchemeView(UUID id, UserCard owner, String title, String description, String creationMode,
                             String origin, List<String> style, List<String> occasion, String season, String mood,
                             String visibility, String status, String displayMode, boolean disponivel,
                             boolean lookDoDia, String coverImageUrl, Map<String, Object> background,
                             String cardSkin, String layoutAnatomy, String containerOrigin, String containerColor,
                             List<SchemeItemView> items, BigDecimal totalPrice, List<String> seals, List<String> tags,
                             String renderingStatus, String virtualTryOnUrl, Map<String, Object> renderingQuality,
                             Map<String, Object> renderingMetadata, BigDecimal hypeScore, BigDecimal hypeScoreGlobal,
                             UUID remixedFromId, boolean revalidationPending, Counters counters, ViewerState viewer,
                             Instant publishedAt, Instant createdAt, Instant updatedAt,
                             List<Map<String, Object>> sealBadges) {
    }

    public static SchemeView scheme(Scheme s, List<SchemeItem> items, ViewerState viewer, Map<String, Long> reactions) {
        return scheme(s, items, viewer, reactions, List.of());
    }

    /** sealBadges = medalhões dos vínculos APROVADOS (SealService.badge) — o card mostra no espaço reservado ao selo. */
    public static SchemeView scheme(Scheme s, List<SchemeItem> items, ViewerState viewer, Map<String, Long> reactions,
                                    List<Map<String, Object>> sealBadges) {
        java.util.LinkedHashMap<String, Object> bg = new java.util.LinkedHashMap<>(Json.map(s.getStudioConfigJson()));
        bg.putIfAbsent("color", s.getBackgroundColor());
        bg.putIfAbsent("gradient", s.getBackgroundGradient());
        bg.putIfAbsent("artUrl", s.getBackgroundArtUrl());
        bg.putIfAbsent("animation", s.getBackgroundAnimationType() == null ? null : s.getBackgroundAnimationType().name());
        return new SchemeView(s.getId(), user(s.getUser()), s.getTitle(), s.getDescription(), s.getCreationMode().name(),
                s.getOrigin() == null ? null : s.getOrigin().name(), Json.csv(s.getStyle()), Json.csv(s.getOccasion()),
                s.getSeason() == null ? null : s.getSeason().name(), s.getMood() == null ? null : s.getMood().name(),
                s.getVisibility().name(), s.getStatus().name(), s.getDisplayMode().name(), s.isDisponivel(), s.isLookDoDia(),
                s.getCoverImageUrl(), bg, s.getCardSkin(), s.getLayoutAnatomy(),
                s.getContainerOrigin() == null ? null : s.getContainerOrigin().name(), s.getContainerColor(),
                items.stream().map(Views::item).toList(), s.getTotalPrice(), Json.strings(s.getSealIdsJson()),
                Json.csv(s.getTags()), s.getRenderingStatus() == null ? null : s.getRenderingStatus().name(),
                s.getVirtualTryOnUrl(), Json.map(s.getRenderingQualityJson()), Json.map(s.getRenderingMetadataJson()),
                s.getHypeScore(), s.getHypeScoreGlobal(), s.getOriginalScheme() == null ? null : s.getOriginalScheme().getId(),
                s.isRevalidationPending(), new Counters(s.getLikeCount(), s.getCommentCount(), s.getShareCount(),
                s.getRemixCount(), s.getViewCount(), s.getSaveCount(), reactions == null ? Map.of() : reactions),
                viewer == null ? ViewerState.NONE : viewer, s.getPublishedAt(), s.getCreatedAt(), s.getUpdatedAt(),
                sealBadges == null ? List.of() : sealBadges);
    }

    public record PhotoView(UUID id, String origin, UUID sourceEntityId, String url, String thumbnailUrl,
                            String originalUrl, String mimeType, Integer width, Integer height, Long bytes,
                            BigDecimal qualityScore, String moderationStatus, boolean keyMoment, UUID editedFromPhotoId,
                            Instant lastViewedAt, Map<String, Object> metadata, Instant createdAt) {
    }

    public static PhotoView photo(Photo p) {
        return new PhotoView(p.getId(), p.getOrigin().name(), p.getSourceEntityId(), p.getPublicUrl(), p.getThumbnailUrl(),
                p.getOriginalUrl(), p.getMimeType(), p.getWidth(), p.getHeight(), p.getBytesSize(), p.getQualityScore(),
                p.getModerationStatus() == null ? null : p.getModerationStatus().name(), p.isKeyMoment(),
                p.getEditedFromPhotoId(), p.getLastViewedAt(), Json.map(p.getMetadataJson()), p.getCreatedAt());
    }

    public record NotificationView(UUID id, String type, String category, UserCard actor, String resourceType,
                                   UUID resourceId, String title, String body, Map<String, Object> payload,
                                   boolean read, Instant createdAt) {
    }

    public static NotificationView notification(Notification n) {
        return new NotificationView(n.getId(), n.getType().name(), n.getCategory().name(), user(n.getActor()),
                n.getResourceType(), n.getResourceId(), n.getTitle(), n.getBody(), Json.map(n.getPayloadJson()), n.isRead(),
                n.getCreatedAt());
    }

    public record Page<T>(List<T> items, int page, int size, long total, boolean hasMore) {
    }
}
