package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.imaging.FlatLayPipeline;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Photo;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.PhotoOrigin;
import br.com.fashionai.domain.repository.PhotoRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
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
import java.util.HashMap;
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
    private final WardrobeService wardrobe;
    private final SchemeRepository schemes;

    public PhotoService(PhotoRepository photos, WardrobeItemRepository pieces, MediaService media, AiEngine ai, Guard guard,
                        WardrobeService wardrobe, SchemeRepository schemes) {
        this.photos = photos;
        this.schemes = schemes;
        this.pieces = pieces;
        this.media = media;
        this.ai = ai;
        this.guard = guard;
        this.wardrobe = wardrobe;
    }

    /**
     * CA01/CA06 — página de fotos (mais recentes primeiro) agrupada por origem. O filtro de origem vai para o banco
     * (índice user_id, origin, created_at) e a contagem por origem é uma consulta agrupada; cada foto de peça traz a
     * peça vinculada para o aviso do CA03 aparecer antes da exclusão.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> list(CurrentUser user, PhotoOrigin origin, int page, int size) {
        long started = System.nanoTime();
        int s = Math.max(1, Math.min(size <= 0 ? 48 : size, 96));
        PageRequest req = PageRequest.of(Math.max(0, page), s, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Photo> p = origin == null ? photos.findByUserIdAndDeletedAtIsNull(user.id(), req)
                : photos.findByUserIdAndOriginAndDeletedAtIsNull(user.id(), origin, req);
        List<Photo> items = p.getContent();
        Map<String, List<Views.PhotoView>> groups = new LinkedHashMap<>();
        for (PhotoOrigin o : PhotoOrigin.values()) {
            List<Views.PhotoView> g = items.stream().filter(x -> x.getOrigin() == o).map(Views::photo).toList();
            if (!g.isEmpty()) {
                groups.put(o.name(), g);
            }
        }
        Map<String, Long> counts = new LinkedHashMap<>();
        for (Object[] row : photos.countByOrigin(user.id())) {
            counts.put(String.valueOf(row[0]), ((Number) row[1]).longValue());
        }
        Set<UUID> pieceIds = items.stream().filter(x -> x.getOrigin() == PhotoOrigin.WARDROBE_ITEM || x.getOrigin() == PhotoOrigin.EDITOR)
                .map(Photo::getSourceEntityId).filter(java.util.Objects::nonNull).collect(Collectors.toSet());
        Map<UUID, WardrobeItem> linked = pieces.findAllById(pieceIds).stream().filter(w -> w.getUser().getId().equals(user.id()))
                .collect(Collectors.toMap(WardrobeItem::getId, w -> w));
        Map<String, Object> links = new LinkedHashMap<>();
        for (Photo x : items) {
            WardrobeItem w = x.getSourceEntityId() == null ? null : linked.get(x.getSourceEntityId());
            if (w == null) {
                continue;
            }
            boolean active = w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED && x.getPublicUrl() != null
                    && (x.getPublicUrl().equals(w.getImageUrl()) || x.getPublicUrl().equals(w.getOriginalImageUrl()));
            links.put(x.getId().toString(), Map.of("pieceId", w.getId(), "pieceName", w.getName(), "activeImage", active));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("groups", groups);
        out.put("links", links);
        out.put("counts", counts);
        out.put("page", p.getNumber());
        out.put("size", s);
        out.put("hasMore", p.hasNext());
        out.put("total", p.getTotalElements());
        out.put("lazy", true);
        out.put("serverMs", (System.nanoTime() - started) / 1_000_000);
        return out;
    }

    /**
     * RF12 — galeria de Minhas Fotos com os filtros em cascata (origem → ocasião → estilo → cor → mês da publicação →
     * período) e as facetas com os valores presentes NAS FOTOS QUE JÁ PASSARAM pelos filtros escolhidos: cada nível herda
     * os anteriores e só oferece o que existe ali. As contagens por origem (primeiro nível) são sobre todas as fotos.
     * Ocasião, estilo e cor vêm da peça (RF4) ou do look (RF5) de que a foto faz parte; fotos de peças e looks excluídos
     * não entram (CA13: saem junto com a peça ou o look).
     */
    @Transactional(readOnly = true)
    public Map<String, Object> gallery(CurrentUser user, PhotoInsights.Filter f, int page, int size) {
        long started = System.nanoTime();
        ZoneId zone = FaiPointsService.ZONE;
        List<Photo> all = photos.findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(user.id());
        Map<UUID, PhotoInsights.Subject> subjects = subjects(user, all);
        Instant now = Instant.now();
        List<Photo> matched = all.stream().filter(p -> PhotoInsights.matches(p, subjects.get(p.getId()), f, zone, now)).toList();
        int s = Math.max(1, Math.min(size <= 0 ? 60 : size, 120));
        int from = Math.min(matched.size(), Math.max(0, page) * s);
        int to = Math.min(matched.size(), from + s);
        List<Map<String, Object>> items = matched.subList(from, to).stream().map(p -> PhotoInsights.view(p, subjects.get(p.getId()), zone)).toList();
        Map<String, Long> counts = new LinkedHashMap<>();
        all.forEach(p -> counts.merge(p.getOrigin().name(), 1L, Long::sum));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("items", items);
        out.put("facets", PhotoInsights.facets(matched, subjects, zone));
        out.put("counts", counts);
        out.put("page", Math.max(0, page));
        out.put("size", s);
        out.put("hasMore", to < matched.size());
        out.put("total", matched.size());
        out.put("all", all.size());
        out.put("serverMs", (System.nanoTime() - started) / 1_000_000);
        return out;
    }

    /** Peça ou look de cada foto (só do próprio dono): é de onde saem ocasião, estilo e cor. */
    private Map<UUID, PhotoInsights.Subject> subjects(CurrentUser user, List<Photo> all) {
        Set<UUID> pieceIds = PhotoInsights.ids(all, Set.of(PhotoOrigin.WARDROBE_ITEM, PhotoOrigin.EDITOR));
        Set<UUID> schemeIds = PhotoInsights.ids(all, Set.of(PhotoOrigin.SCHEME));
        Map<UUID, WardrobeItem> pieceMap = pieceIds.isEmpty() ? Map.of() : pieces.findAllById(pieceIds).stream()
                .filter(w -> w.getUser().getId().equals(user.id())).collect(Collectors.toMap(WardrobeItem::getId, w -> w));
        Map<UUID, Scheme> schemeMap = schemeIds.isEmpty() ? Map.of() : schemes.findAllById(schemeIds).stream()
                .filter(sc -> sc.getUser().getId().equals(user.id())).collect(Collectors.toMap(Scheme::getId, sc -> sc));
        Map<UUID, PhotoInsights.Subject> out = new HashMap<>();
        for (Photo p : all) {
            out.put(p.getId(), PhotoInsights.subjectOf(p, pieceMap, schemeMap));
        }
        return out;
    }

    /**
     * RF12 — insights de IA (StyleInsight, calculado localmente): distribuição por cor, ocasião e estilo das peças e
     * looks fotografados, ritmo por mês e frases com o que mais aparece.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> insights(CurrentUser user) {
        ZoneId zone = FaiPointsService.ZONE;
        List<Photo> all = photos.findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(user.id());
        Map<UUID, PhotoInsights.Subject> subjects = subjects(user, all);
        Map<String, Object> facets = PhotoInsights.facets(all, subjects, zone);
        @SuppressWarnings("unchecked") Map<String, Long> color = (Map<String, Long>) facets.get("color");
        @SuppressWarnings("unchecked") Map<String, Long> occasion = (Map<String, Long>) facets.get("occasion");
        @SuppressWarnings("unchecked") Map<String, Long> style = (Map<String, Long>) facets.get("style");
        @SuppressWarnings("unchecked") Map<String, Long> months = (Map<String, Long>) facets.get("month");
        AiOutcome<List<String>> outcome = ai.local(user.id(), AiCapability.STYLE_INSIGHT,
                List.of(Msg.t("photo.insight_entrada", all.size())),
                () -> PhotoInsights.sentences(color, occasion, style, months, all.size(), WardrobeService::humanize));
        Map<String, Object> out = new LinkedHashMap<>(facets);
        out.put("total", all.size());
        out.put("keyMoments", all.stream().filter(Photo::isKeyMoment).count());
        out.put("withSubject", subjects.values().stream().filter(x -> x.kind() != null).count());
        out.put("sentences", outcome.value());
        out.put("explanation", outcome.explanation());
        out.put("inferenceId", outcome.inferenceId());
        return out;
    }

    Photo owned(CurrentUser user, UUID id) {
        Photo p = photos.findById(id).filter(x -> x.getDeletedAt() == null).orElseThrow(() -> ApiException.notFound(Msg.t("entity.foto")));
        guard.requireOwner(user, p.getUser().getId(), "photo:" + id);
        return p;
    }

    /** CA03 — foto ligada a peça ativa exige confirmação explícita; a peça fica sem imagem (volta à padrão). */
    @Transactional
    public Map<String, Object> delete(CurrentUser user, UUID id, boolean confirmed) {
        Photo p = owned(user, id);
        Optional<WardrobeItem> linked = linkedActivePiece(p);
        if (linked.isPresent() && !confirmed) {
            throw new ApiException(409, "CONFIRMACAO_NECESSARIA", Msg.t("photo.esta_foto_e_a_imagem", linked.get().getName()), Map.of("pieceId", linked.get().getId()));
        }
        linked.ifPresent(wardrobe::useDefaultImageAfterPhotoDeletion);
        p.setDeletedAt(Instant.now());
        Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("deleted", 1);
        out.put("pieceWithoutImage", linked.map(WardrobeItem::getId).orElse(null));
        return out;
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
                    "message", Msg.t("photo.excluir_fotos", list.size()) + (linked > 0 ? Msg.t("photo.sao_imagens_de_pecas_ativas", linked) : ""));
        }
        for (Photo p : list) {
            linkedActivePiece(p).ifPresent(wardrobe::useDefaultImageAfterPhotoDeletion);
            p.setDeletedAt(Instant.now());
        }
        return Map.of("deleted", list.size());
    }

    /** CA05 — original sem marca d'água, apenas ao dono. */
    @Transactional
    public byte[] download(CurrentUser user, UUID id) {
        Photo p = owned(user, id);
        p.setLastViewedAt(Instant.now());
        return media.read(p.getOriginalUrl() != null ? p.getOriginalUrl() : p.getPublicUrl()).orElseThrow(() -> ApiException.notFound(Msg.t("photo.arquivo_da_foto")));
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
        AiOutcome<List<List<Photo>>> outcome = ai.local(user.id(), AiCapability.PHOTO_CURATOR, List.of(Msg.t("photo.fotos_do_proprio_acervo_hash", (all.size()))), () -> {
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
        return Map.of("duplicateGroups", out, "explanation", outcome.explanation(), "note", Msg.t("photo.sugestao_apenas_nada_e_excluido"));
    }

    /** Linha do tempo de estilo (StyleInsight): fotos por mês e por origem. */
    @Transactional(readOnly = true)
    public Map<String, Object> timeline(CurrentUser user) {
        ZoneId zone = FaiPointsService.ZONE;
        Map<String, Map<String, Long>> byMonth = photos.findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(user.id()).stream()
                .collect(Collectors.groupingBy(p -> YearMonth.from(p.getCreatedAt().atZone(zone)).toString(), java.util.TreeMap::new,
                        Collectors.groupingBy(p -> p.getOrigin().name(), Collectors.counting())));
        List<Map<String, Object>> moments = new ArrayList<>();
        for (Photo p : photos.findByUserIdAndKeyMomentTrueAndDeletedAtIsNullOrderByCreatedAtDesc(user.id())) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("photo", Views.photo(p));
            m.put("date", p.getCreatedAt());
            m.put("origin", p.getOrigin().name());
            moments.add(m);
        }
        // linha do tempo completa (RF12.CA07/CA08): todas as fotos, mês a mês, da mais recente para a mais antiga
        List<Photo> all = photos.findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(user.id());
        Map<UUID, PhotoInsights.Subject> subjects = subjects(user, all);
        Map<String, List<Photo>> perMonth = new java.util.TreeMap<>(Comparator.reverseOrder());
        for (Photo p : all) {
            perMonth.computeIfAbsent(PhotoInsights.month(p, zone), k -> new ArrayList<>()).add(p);
        }
        List<Map<String, Object>> timeline = new ArrayList<>();
        for (Map.Entry<String, List<Photo>> e : perMonth.entrySet()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("month", e.getKey());
            m.put("count", e.getValue().size());
            m.put("keyMoments", e.getValue().stream().filter(Photo::isKeyMoment).count());
            m.put("byOrigin", byMonth.getOrDefault(e.getKey(), Map.of()));
            m.put("photos", e.getValue().stream().map(p -> PhotoInsights.view(p, subjects.get(p.getId()), zone)).toList());
            timeline.add(m);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("months", byMonth);
        out.put("moments", moments);
        out.put("timeline", timeline);
        return out;
    }

    /**
     * RF12.CA02 → RF15.CA02 — salva o resultado do Editor Canvas 2D. Foto de peça ativa: a edição vira a imagem exibida na
     * peça e a original continua em "Minhas Fotos". Demais fotos: a edição entra como nova foto (origem EDITOR) apontando
     * para a original, que nunca é sobrescrita.
     */
    @Transactional
    public Map<String, Object> saveEdit(CurrentUser user, UUID id, byte[] bytes) {
        Photo original = owned(user, id);
        guard.requireCanCreate(user);
        Optional<WardrobeItem> piece = original.getSourceEntityId() == null || (original.getOrigin() != PhotoOrigin.WARDROBE_ITEM && original.getOrigin() != PhotoOrigin.EDITOR)
                ? Optional.empty()
                : pieces.findById(original.getSourceEntityId()).filter(w -> w.getUser().getId().equals(user.id()) && w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED);
        if (piece.isPresent()) {
            Views.PieceView view = wardrobe.replaceImage(user, piece.get().getId(), bytes, id);
            return Map.of("replacedPieceImage", true, "piece", Map.of("id", view.id(), "name", view.name(), "imageUrl", String.valueOf(view.imageUrl())),
                    "message", Msg.t("photo.a_imagem_editada_agora_e", view.name()));
        }
        String mime = ImageOps.requireAcceptedImage(bytes);
        BufferedImage img = ImageOps.decode(bytes);
        String base = "users/" + user.id() + "/photos/edit-" + System.currentTimeMillis();
        MediaStoragePort.StoredObject stored = media.put(base + ".png", ImageOps.png(img), "image/png");
        MediaStoragePort.StoredObject thumb = media.put(base + "-thumb.png", ImageOps.png(ImageOps.scale(img, Math.max(1, Math.min(360, img.getWidth())),
                Math.max(1, (int) Math.round(img.getHeight() * (Math.min(360.0, img.getWidth()) / img.getWidth()))))), "image/png");
        Photo edited = media.register(original.getUser(), PhotoOrigin.EDITOR, original.getSourceEntityId(), stored, original.getOriginalUrl() != null ? original.getOriginalUrl() : original.getPublicUrl(),
                thumb.url(), bytes, img.getWidth(), img.getHeight(), null, ModerationStatus.APPROVED, Map.of("sourceMime", mime, "editedFrom", id.toString()));
        edited.setEditedFromPhotoId(id);
        return Map.of("replacedPieceImage", false, "photo", Views.photo(edited), "message", Msg.t("photo.copia_editada_salva_em_minhas"));
    }

    /**
     * RF15.CA01/CA04 — remoção de fundo sob demanda para o editor; a falha é informada e as outras ferramentas seguem.
     * Passa pelo motor de IA (cota diária do Flat Lay e teto de gasto): remove.bg é pago por imagem.
     */
    public Map<String, Object> removeBackground(CurrentUser user, byte[] bytes) {
        guard.requireCanCreate(user);
        FlatLayPipeline.Result r = wardrobe.governedFlatLay(user.id(), bytes);
        if (!r.backgroundRemoved() || r.processedPng() == null) {
            return Map.of("ok", false, "message", Msg.t("photo.a_remocao_de_fundo_nao"));
        }
        return Map.of("ok", true, "png", java.util.Base64.getEncoder().encodeToString(r.processedPng()),
                "provider", r.stages().stream().filter(x -> "REMOCAO_FUNDO".equals(x.name()) && x.ok())
                        .map(FlatLayPipeline.Stage::provider).findFirst().orElse("local"));
    }
}
