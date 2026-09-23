package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Photo;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.PhotoOrigin;
import br.com.fashionai.domain.repository.PhotoRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.awt.image.BufferedImage;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * RF12 — Minhas Fotos: todas as fotografias agrupadas por origem e ordenadas por data (CA01), paginação sob demanda
 * (CA06), edição no Editor Canvas 2D (CA02 → RF15), exclusão com aviso de peça ativa (CA03), exclusão em lote com uma
 * confirmação (CA04), download do original só pelo dono (CA05) e o Photo Curator (RF24.CA11): pHash local agrupa
 * quase-duplicatas e sugere manter a de melhor qualidade — nunca exclui sozinho.
 */
@Service
public class PhotoService {
    public static final int DUPLICATE_DISTANCE = 6;

    private final PhotoRepository photos;
    private final WardrobeItemRepository pieces;
    private final MediaService media;
    private final AiEngine ai;
    private final Guard guard;

    public PhotoService(PhotoRepository photos, WardrobeItemRepository pieces, MediaService media, AiEngine ai, Guard guard) {
        this.photos = photos;
        this.pieces = pieces;
        this.media = media;
        this.ai = ai;
        this.guard = guard;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> list(CurrentUser user, PhotoOrigin origin, int page, int size) {
        int s = Math.max(1, Math.min(size <= 0 ? 48 : size, 96));
        Page<Photo> p = photos.findByUserIdAndDeletedAtIsNull(user.id(), PageRequest.of(Math.max(0, page), s, Sort.by(Sort.Direction.DESC, "createdAt")));
        List<Photo> items = p.getContent().stream().filter(x -> origin == null || x.getOrigin() == origin).toList();
        Map<String, List<Views.PhotoView>> groups = new LinkedHashMap<>();
        for (PhotoOrigin o : PhotoOrigin.values()) {
            List<Views.PhotoView> g = items.stream().filter(x -> x.getOrigin() == o).map(Views::photo).toList();
            if (!g.isEmpty()) {
                groups.put(o.name(), g);
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("groups", groups);
        out.put("page", p.getNumber());
        out.put("hasMore", p.hasNext());
        out.put("total", p.getTotalElements());
        out.put("lazy", true);
        return out;
    }

    Photo owned(CurrentUser user, UUID id) {
        Photo p = photos.findById(id).filter(x -> x.getDeletedAt() == null).orElseThrow(() -> ApiException.notFound("Foto"));
        guard.requireOwner(user, p.getUser().getId(), "photo:" + id);
        return p;
    }

    /** CA03 — foto ligada a peça ativa exige confirmação explícita; a peça fica sem imagem (volta à padrão). */
    @Transactional
    public Map<String, Object> delete(CurrentUser user, UUID id, boolean confirmed) {
        Photo p = owned(user, id);
        Optional<WardrobeItem> linked = linkedActivePiece(p);
        if (linked.isPresent() && !confirmed) {
            throw new ApiException(409, "CONFIRMACAO_NECESSARIA", "Esta foto é a imagem da peça «" + linked.get().getName()
                    + "». Se excluir, a peça ficará sem imagem. Confirme para continuar.", Map.of("pieceId", linked.get().getId()));
        }
        linked.ifPresent(w -> {
            w.setImageUrl(null);
            w.setThumbnailUrl(null);
        });
        p.setDeletedAt(Instant.now());
        return Map.of("deleted", 1, "pieceWithoutImage", linked.map(WardrobeItem::getId).orElse(null) == null ? "" : linked.get().getId().toString());
    }

    Optional<WardrobeItem> linkedActivePiece(Photo p) {
        if (p.getOrigin() != PhotoOrigin.WARDROBE_ITEM && p.getOrigin() != PhotoOrigin.EDITOR || p.getSourceEntityId() == null) {
            return Optional.empty();
        }
        return pieces.findById(p.getSourceEntityId()).filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED)
                .filter(w -> p.getPublicUrl() != null && (p.getPublicUrl().equals(w.getImageUrl()) || p.getPublicUrl().equals(w.getOriginalImageUrl())));
    }

    /** CA04 — exclusão em lote com uma única confirmação informando a quantidade. */
    @Transactional
    public Map<String, Object> bulkDelete(CurrentUser user, List<UUID> ids, boolean confirmed) {
        List<Photo> list = photos.findByIdInAndUserId(ids == null ? List.of() : ids, user.id()).stream().filter(p -> p.getDeletedAt() == null).toList();
        long linked = list.stream().filter(p -> linkedActivePiece(p).isPresent()).count();
        if (!confirmed) {
            return Map.of("requiresConfirmation", true, "count", list.size(), "linkedToPieces", linked,
                    "message", "Excluir " + list.size() + " foto(s)?" + (linked > 0 ? " " + linked + " são imagens de peças ativas." : ""));
        }
        for (Photo p : list) {
            linkedActivePiece(p).ifPresent(w -> {
                w.setImageUrl(null);
                w.setThumbnailUrl(null);
            });
            p.setDeletedAt(Instant.now());
        }
        return Map.of("deleted", list.size());
    }

    /** CA05 — original sem marca d'água, apenas ao dono. */
    @Transactional
    public byte[] download(CurrentUser user, UUID id) {
        Photo p = owned(user, id);
        p.setLastViewedAt(Instant.now());
        return media.read(p.getOriginalUrl() != null ? p.getOriginalUrl() : p.getPublicUrl()).orElseThrow(() -> ApiException.notFound("Arquivo da foto"));
    }

    @Transactional
    public Map<String, Object> setKeyMoment(CurrentUser user, UUID id, boolean key) {
        Photo p = owned(user, id);
        p.setKeyMoment(key);
        return Map.of("id", id, "keyMoment", key);
    }

    // ================================================================== Photo Curator (RF24.CA11)
    /** dHash 64 bits (9×8 em tons de cinza) — hash perceptual local, sem enviar dados. */
    static long dHash(BufferedImage img) {
        BufferedImage small = ImageOps.scale(img, 9, 8);
        long hash = 0;
        int bit = 0;
        for (int y = 0; y < 8; y++) {
            for (int x = 0; x < 8; x++) {
                int a = gray(small.getRGB(x, y));
                int b = gray(small.getRGB(x + 1, y));
                if (a > b) {
                    hash |= 1L << bit;
                }
                bit++;
            }
        }
        return hash;
    }

    static int gray(int rgb) {
        return (int) (0.299 * ((rgb >> 16) & 0xFF) + 0.587 * ((rgb >> 8) & 0xFF) + 0.114 * (rgb & 0xFF));
    }

    @Transactional
    public Map<String, Object> curate(CurrentUser user) {
        List<Photo> all = photos.findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(user.id()).stream().limit(400).toList();
        AiOutcome<List<List<Photo>>> outcome = ai.local(user.id(), AiCapability.PHOTO_CURATOR, List.of(all.size() + " fotos do próprio acervo (hash perceptual local)"), () -> {
            Map<UUID, Long> hashes = new LinkedHashMap<>();
            for (Photo p : all) {
                Map<String, Object> meta = Json.map(p.getMetadataJson());
                Object cached = meta.get("dhash");
                if (cached != null) {
                    hashes.put(p.getId(), Long.parseUnsignedLong(String.valueOf(cached), 16));
                    continue;
                }
                media.readImage(p.getThumbnailUrl() != null ? p.getThumbnailUrl() : p.getPublicUrl()).ifPresent(img -> {
                    long h = dHash(img);
                    hashes.put(p.getId(), h);
                    meta.put("dhash", Long.toHexString(h));
                    p.setMetadataJson(Json.write(meta));
                });
            }
            List<List<Photo>> groups = new ArrayList<>();
            Set<UUID> used = new HashSet<>();
            for (Photo a : all) {
                if (used.contains(a.getId()) || !hashes.containsKey(a.getId())) {
                    continue;
                }
                List<Photo> g = new ArrayList<>(List.of(a));
                for (Photo b : all) {
                    if (!b.getId().equals(a.getId()) && !used.contains(b.getId()) && hashes.containsKey(b.getId())
                            && Long.bitCount(hashes.get(a.getId()) ^ hashes.get(b.getId())) <= DUPLICATE_DISTANCE) {
                        g.add(b);
                    }
                }
                if (g.size() > 1) {
                    g.forEach(x -> used.add(x.getId()));
                    groups.add(g);
                }
            }
            return groups;
        });
        List<Map<String, Object>> out = new ArrayList<>();
        for (List<Photo> g : outcome.value()) {
            Photo keep = g.stream().max(Comparator.comparingDouble((Photo p) -> p.getQualityScore() == null ? 0 : p.getQualityScore().doubleValue())
                    .thenComparingLong(p -> p.getBytesSize() == null ? 0 : p.getBytesSize())).orElse(g.get(0));
            out.add(Map.of("photos", g.stream().map(Views::photo).toList(), "suggestKeep", keep.getId(),
                    "suggestDiscard", g.stream().filter(p -> !p.getId().equals(keep.getId())).map(Photo::getId).toList()));
        }
        return Map.of("duplicateGroups", out, "explanation", outcome.explanation(), "note", "Sugestão apenas — nada é excluído sem a sua confirmação.");
    }

    /** Linha do tempo de estilo (StyleInsight): fotos por mês e por origem. */
    @Transactional(readOnly = true)
    public Map<String, Object> timeline(CurrentUser user) {
        ZoneId zone = FaiPointsService.ZONE;
        Map<String, Map<String, Long>> byMonth = photos.findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(user.id()).stream()
                .collect(Collectors.groupingBy(p -> YearMonth.from(p.getCreatedAt().atZone(zone)).toString(), java.util.TreeMap::new,
                        Collectors.groupingBy(p -> p.getOrigin().name(), Collectors.counting())));
        return Map.of("months", byMonth);
    }
}
