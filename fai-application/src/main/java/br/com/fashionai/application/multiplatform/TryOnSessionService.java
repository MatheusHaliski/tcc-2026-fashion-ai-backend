package br.com.fashionai.application.multiplatform;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.GarmentAsset3d;
import br.com.fashionai.domain.model.TryOnSession;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.GarmentAssetStatus;
import br.com.fashionai.domain.model.enums.TryOnSlot;
import br.com.fashionai.domain.repository.GarmentAsset3dRepository;
import br.com.fashionai.domain.repository.TryOnSessionRepository;
import br.com.fashionai.domain.repository.UserAvatar3dRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * MP-2 — Provador sincronizado entre plataformas. Quatro lugares (parte de cima, parte de baixo, calçado, acessório);
 * experimentar não pede título, não cria look e não publica. Cada mudança exige a revisão que o cliente viu
 * ({@code If-Match}); se outra plataforma mudou antes, a resposta é 412 com o estado atual, e o cliente decide
 * (reaplicar a mudança ou aceitar a outra). Para cada peça vestida a resposta diz COMO desenhá-la no perfil de qualidade
 * do aparelho: MESH_3D (asset aprovado que veste o avatar) ou PREVIEW_2D (foto, identificada como prévia).
 */
@Service
public class TryOnSessionService {
    public static final String PREVIEW_2D_LABEL = "Prévia 2D — esta peça ainda não tem modelo 3D aprovado para vestir o avatar.";

    private final TryOnSessionRepository sessions;
    private final WardrobeItemRepository pieces;
    private final GarmentAsset3dRepository assets;
    private final UserAvatar3dRepository avatars;

    public TryOnSessionService(TryOnSessionRepository sessions, WardrobeItemRepository pieces, GarmentAsset3dRepository assets,
                               UserAvatar3dRepository avatars) {
        this.sessions = sessions;
        this.pieces = pieces;
        this.assets = assets;
        this.avatars = avatars;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> get(CurrentUser user, QualityProfile quality) {
        return sessions.findByUserId(user.id())
                .map(s -> view(user, s, quality))
                .orElseGet(() -> view(user, empty(user.id()), quality));
    }

    @Transactional
    public Map<String, Object> put(CurrentUser user, TryOnSlot slot, UUID pieceId, Long ifMatch, ClientPlatform platform, QualityProfile quality) {
        if (slot == null || pieceId == null) {
            throw ApiException.badRequest("VALIDACAO", "Informe o lugar e a peça.");
        }
        WardrobeItem w = ownPiece(user, pieceId);
        TryOnSlot fits = TryOnSlot.ofCategory(w.getCategory());
        if (fits == null) {
            throw new ApiException(422, "PECA_SEM_CATEGORIA", "Revise a categoria da peça antes de provar.");
        }
        if (fits != slot) {
            throw new ApiException(422, "LUGAR_INCOMPATIVEL", "Esta peça vai em " + fits.name() + ", não em " + slot.name() + ".",
                    Map.of("expectedSlot", fits.name()));
        }
        TryOnSession s = locked(user, ifMatch, quality);
        set(s, slot, w.getId());
        if (slot == TryOnSlot.TOP && "full_body_piece".equals(w.getCategory())) {
            s.setBottomPieceId(null);                                    // peça inteira libera a parte de baixo
        }
        if (slot == TryOnSlot.BOTTOM && s.getTopPieceId() != null) {
            pieces.findById(s.getTopPieceId())
                    .filter(top -> "full_body_piece".equals(top.getCategory()))
                    .ifPresent(top -> s.setTopPieceId(null));            // e a parte de baixo tira a peça inteira
        }
        return save(user, s, platform, quality);
    }

    @Transactional
    public Map<String, Object> clear(CurrentUser user, TryOnSlot slot, Long ifMatch, ClientPlatform platform, QualityProfile quality) {
        TryOnSession s = locked(user, ifMatch, quality);
        if (slot == null) {
            for (TryOnSlot each : TryOnSlot.values()) {
                set(s, each, null);
            }
        } else {
            set(s, slot, null);
        }
        return save(user, s, platform, quality);
    }

    // ---------- internos ----------

    private TryOnSession locked(CurrentUser user, Long ifMatch, QualityProfile quality) {
        if (ifMatch == null) {
            throw new ApiException(428, "REVISAO_OBRIGATORIA", "Envie a revisão do provador que você está vendo (If-Match).");
        }
        TryOnSession s = sessions.findForUpdateByUserId(user.id()).orElseGet(() -> empty(user.id()));
        if (s.getRevision() != ifMatch) {
            throw new ApiException(412, "PROVADOR_MUDOU", "O provador mudou em outro aparelho. Veja o estado atual e tente de novo.",
                    Map.of("current", view(user, s, quality)));
        }
        return s;
    }

    private Map<String, Object> save(CurrentUser user, TryOnSession s, ClientPlatform platform, QualityProfile quality) {
        s.setRevision(s.getRevision() + 1);
        s.setUpdatedPlatform(platform == null ? null : platform.name());
        avatars.findByUserId(user.id()).ifPresent(a -> {
            s.setAvatarIdentityId(a.getIdentityId());
            s.setAvatarVersion(a.getCurrentVersion());
        });
        return view(user, sessions.save(s), quality);
    }

    private WardrobeItem ownPiece(CurrentUser user, UUID pieceId) {
        WardrobeItem w = pieces.findById(pieceId).orElseThrow(() -> ApiException.notFound("Peça"));
        if (w.getUser() == null || !user.id().equals(w.getUser().getId())) {
            throw ApiException.notFound("Peça");                        // peça de outra pessoa: não revela que existe
        }
        if (w.getAvailabilityStatus() == AvailabilityStatus.ARCHIVED) {
            throw new ApiException(422, "PECA_ARQUIVADA", "Esta peça está arquivada.");
        }
        return w;
    }

    private static TryOnSession empty(UUID userId) {
        TryOnSession s = new TryOnSession();
        s.setUserId(userId);
        s.setRevision(0);
        return s;
    }

    static UUID get(TryOnSession s, TryOnSlot slot) {
        return switch (slot) {
            case TOP -> s.getTopPieceId();
            case BOTTOM -> s.getBottomPieceId();
            case SHOES -> s.getShoesPieceId();
            case ACCESSORY -> s.getAccessoryPieceId();
        };
    }

    static void set(TryOnSession s, TryOnSlot slot, UUID id) {
        switch (slot) {
            case TOP -> s.setTopPieceId(id);
            case BOTTOM -> s.setBottomPieceId(id);
            case SHOES -> s.setShoesPieceId(id);
            case ACCESSORY -> s.setAccessoryPieceId(id);
        }
    }

    private Map<String, Object> view(CurrentUser user, TryOnSession s, QualityProfile quality) {
        Map<TryOnSlot, WardrobeItem> worn = new EnumMap<>(TryOnSlot.class);
        for (TryOnSlot slot : TryOnSlot.values()) {
            UUID id = get(s, slot);
            if (id != null) {
                // peça apagada, arquivada ou que deixou de ser da pessoa some do provador sem erro
                pieces.findById(id)
                        .filter(w -> w.getUser() != null && user.id().equals(w.getUser().getId()))
                        .filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED)
                        .ifPresent(w -> worn.put(slot, w));
            }
        }
        Map<UUID, GarmentAsset3d> approved = approvedAssets(worn.values());
        Map<String, Object> slots = new LinkedHashMap<>();
        for (TryOnSlot slot : TryOnSlot.values()) {
            WardrobeItem w = worn.get(slot);
            slots.put(slot.name(), w == null ? null : slotView(w, approved.get(w.getId()), quality));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("revision", s.getRevision());
        out.put("updatedAt", s.getUpdatedAt());
        out.put("updatedPlatform", s.getUpdatedPlatform());
        out.put("qualityProfile", quality.name());
        out.put("slots", slots);
        Map<String, Object> avatar = new LinkedHashMap<>();
        avatars.findByUserId(user.id()).ifPresentOrElse(a -> {
            avatar.put("identityId", a.getIdentityId());
            avatar.put("version", a.getCurrentVersion());
            avatar.put("changedSinceLastTryOn", s.getAvatarVersion() != null
                    && (!Objects.equals(s.getAvatarIdentityId(), a.getIdentityId()) || s.getAvatarVersion() != a.getCurrentVersion()));
        }, () -> avatar.put("identityId", null));
        out.put("avatar", avatar);
        return out;
    }

    private Map<String, Object> slotView(WardrobeItem w, GarmentAsset3d asset, QualityProfile quality) {
        Map<String, Object> m = new LinkedHashMap<>();
        Map<String, Object> piece = new LinkedHashMap<>();
        piece.put("id", w.getId());
        piece.put("category", w.getCategory());
        piece.put("subcategory", w.getSubcategory());
        piece.put("color", w.getColor());
        piece.put("brandName", w.getBrandName());
        piece.put("fullBody", "full_body_piece".equals(w.getCategory()));
        m.put("piece", piece);
        Optional<Map<String, Object>> rendition = asset == null ? Optional.empty() : rendition(asset, quality);
        if (rendition.isPresent()) {
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("mode", "MESH_3D");
            r.put("assetId", asset.getId());
            r.put("assetVersion", asset.getVersion());
            r.put("rigStandard", asset.getRigStandard());
            r.putAll(rendition.get());
            m.put("representation", r);
        } else {
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("mode", "PREVIEW_2D");
            r.put("label", PREVIEW_2D_LABEL);
            r.put("imageUrl", firstNonBlank(w.getStudioImageUrl(), w.getCanonicalImageUrl(), w.getImageUrl()));
            m.put("representation", r);
        }
        return m;
    }

    /** Arquivo do perfil pedido; sem ele, o do perfil mais leve da mesma família; nunca um mais pesado. */
    static Optional<Map<String, Object>> rendition(GarmentAsset3d asset, QualityProfile quality) {
        if (asset.getRenditionsJson() == null) {
            return Optional.empty();
        }
        Map<String, Object> all = Json.map(asset.getRenditionsJson());
        for (QualityProfile p : quality.fallbackChain()) {
            if (all.get(p.name()) instanceof Map<?, ?> r && r.get("key") != null) {
                Map<String, Object> out = new LinkedHashMap<>();
                out.put("renditionProfile", p.name());
                out.put("url", "/media/" + r.get("key"));
                out.put("bytes", r.get("bytes"));
                out.put("triangles", r.get("triangles"));
                out.put("sha256", r.get("sha256"));
                return Optional.of(out);
            }
        }
        return Optional.empty();
    }

    private Map<UUID, GarmentAsset3d> approvedAssets(java.util.Collection<WardrobeItem> worn) {
        Map<UUID, GarmentAsset3d> out = new LinkedHashMap<>();
        if (worn.isEmpty()) {
            return out;
        }
        List<UUID> ids = worn.stream().map(WardrobeItem::getId).toList();
        for (GarmentAsset3d a : assets.findByPieceIdInAndStatus(ids, GarmentAssetStatus.APPROVED)) {
            out.merge(a.getPieceId(), a, TryOnSessionService::newest);
        }
        // peça vinda do catálogo usa o asset do produto quando não tem um próprio
        List<UUID> products = new ArrayList<>();
        worn.stream().filter(w -> !out.containsKey(w.getId()) && w.getCatalogProductId() != null).forEach(w -> products.add(w.getCatalogProductId()));
        if (!products.isEmpty()) {
            Map<UUID, GarmentAsset3d> byProduct = new LinkedHashMap<>();
            for (GarmentAsset3d a : assets.findByCatalogProductIdInAndStatus(products, GarmentAssetStatus.APPROVED)) {
                byProduct.merge(a.getCatalogProductId(), a, TryOnSessionService::newest);
            }
            worn.stream().filter(w -> !out.containsKey(w.getId()) && w.getCatalogProductId() != null)
                    .forEach(w -> {
                        GarmentAsset3d a = byProduct.get(w.getCatalogProductId());
                        if (a != null) {
                            out.put(w.getId(), a);
                        }
                    });
        }
        return out;
    }

    private static GarmentAsset3d newest(GarmentAsset3d a, GarmentAsset3d b) {
        if (a.getApprovedAt() == null) {
            return b;
        }
        if (b.getApprovedAt() == null) {
            return a;
        }
        return b.getApprovedAt().isAfter(a.getApprovedAt()) ? b : a;
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) {
                return v;
            }
        }
        return null;
    }
}
