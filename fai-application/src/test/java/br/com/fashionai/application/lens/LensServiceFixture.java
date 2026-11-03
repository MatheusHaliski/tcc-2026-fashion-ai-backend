package br.com.fashionai.application.lens;

import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.ports.RateLimitPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.MediaService;
import br.com.fashionai.application.service.MultiPieceService;
import br.com.fashionai.application.service.WardrobeService;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.AuditableEntity;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.LensDetection;
import br.com.fashionai.domain.model.LensFeedback;
import br.com.fashionai.domain.model.LensScan;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.AiCallResult;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.FollowRepository;
import br.com.fashionai.domain.repository.GarmentEmbeddingRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.LensDetectionRepository;
import br.com.fashionai.domain.repository.LensFeedbackRepository;
import br.com.fashionai.domain.repository.LensScanRepository;
import br.com.fashionai.domain.repository.PieceImageRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserConsentRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.function.Executable;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.lang.reflect.Proxy;
import java.math.BigDecimal;
import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.BiFunction;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Fixture compartilhada dos testes do {@link LensService}: repositórios em memória (proxies), storage e cota fake,
 * detector simulado e construtores de peças, Hype público e foto sintética.
 */
abstract class LensServiceFixture {
    // ------------------------------------------------------------------ armazenamento em memória
    final Map<UUID, LensScan> scanRows = new LinkedHashMap<>();
    final Map<UUID, LensDetection> detectionRows = new LinkedHashMap<>();
    final Map<UUID, LensFeedback> feedbackRows = new LinkedHashMap<>();
    final Map<UUID, WardrobeItem> pieceRows = new LinkedHashMap<>();
    final Map<UUID, Scheme> schemeRows = new LinkedHashMap<>();
    final List<HypeScoreCurrent> hypeRows = new ArrayList<>();
    final Map<String, byte[]> blobs = new LinkedHashMap<>();
    final Map<String, Integer> quota = new HashMap<>();

    User me, other;
    CurrentUser meUser, otherUser;
    MultiPieceService multiPiece;
    WardrobeService wardrobe;
    LensService lens;
    /** Resposta do detector no próximo scan. */
    List<MultiPieceService.DetectedPiece> nextPieces;
    String nextSource = "ia";
    AiCallResult nextResult = AiCallResult.SUCCESS;
    /** DNA de estilo de quem pede (vazio = sem DNA, como nos testes originais). */
    Optional<StyleDna> dnaRow = Optional.empty();

    @BeforeEach
    void setUp() {
        me = user("eu");
        other = user("outra");
        meUser = current(me);
        otherUser = current(other);

        LensScanRepository scans = proxy(LensScanRepository.class, (name, a) -> switch (name) {
            case "save" -> saveRow(scanRows, (LensScan) a[0]);
            case "findByIdAndUserId" -> Optional.ofNullable(scanRows.get((UUID) a[0])).filter(s -> s.getUserId().equals(a[1]));
            case "findById" -> Optional.ofNullable(scanRows.get((UUID) a[0]));
            case "findByUserId" -> scanRows.values().stream().filter(s -> s.getUserId().equals(a[0])).toList();
            case "findByUserIdOrderByCreatedAtDesc" -> page(scanRows.values().stream().filter(s -> s.getUserId().equals(a[0])).toList(), (Pageable) a[1]);
            case "findByUserIdAndSavedAtIsNotNullOrderByCreatedAtDesc" -> page(scanRows.values().stream()
                    .filter(s -> s.getUserId().equals(a[0]) && s.getSavedAt() != null).toList(), (Pageable) a[1]);
            case "findByUserIdAndSavedAtIsNullOrderByCreatedAtDesc" -> page(scanRows.values().stream()
                    .filter(s -> s.getUserId().equals(a[0]) && s.getSavedAt() == null).toList(), (Pageable) a[1]);
            case "findWanted" -> page(scanRows.values().stream().filter(s -> s.getUserId().equals(a[0])
                    && (a[1] == null || (Boolean) a[1] == (s.getSavedAt() != null))
                    && detectionRows.values().stream().anyMatch(d -> d.getScanId().equals(s.getId()) && d.getWantedAt() != null
                    && d.getDismissedAt() == null)).toList(), (Pageable) a[2]);
            case "findTop200BySavedAtIsNullAndExpiresAtBefore" -> scanRows.values().stream()
                    .filter(s -> s.getSavedAt() == null && s.getExpiresAt() != null && s.getExpiresAt().isBefore((Instant) a[0])).limit(200).toList();
            case "delete" -> {
                scanRows.remove(((LensScan) a[0]).getId());
                yield null;
            }
            default -> throw new UnsupportedOperationException(name);
        });
        LensDetectionRepository detections = proxy(LensDetectionRepository.class, (name, a) -> switch (name) {
            case "save" -> saveRow(detectionRows, (LensDetection) a[0]);
            case "findByScanIdOrderByOrdinalAsc" -> detectionRows.values().stream().filter(d -> d.getScanId().equals(a[0]))
                    .sorted(Comparator.comparingInt(LensDetection::getOrdinal)).toList();
            case "findByScanIdIn" -> detectionRows.values().stream().filter(d -> ((Collection<?>) a[0]).contains(d.getScanId())).toList();
            case "findByIdAndScanId" -> Optional.ofNullable(detectionRows.get((UUID) a[0])).filter(d -> d.getScanId().equals(a[1]));
            case "deleteAll" -> {
                ((Iterable<?>) a[0]).forEach(d -> detectionRows.remove(((LensDetection) d).getId()));
                yield null;
            }
            default -> throw new UnsupportedOperationException(name);
        });
        LensFeedbackRepository feedback = proxy(LensFeedbackRepository.class, (name, a) -> switch (name) {
            case "save" -> saveRow(feedbackRows, (LensFeedback) a[0]);
            case "findByScanId" -> feedbackRows.values().stream().filter(f -> f.getScanId().equals(a[0])).toList();
            case "deleteAll" -> {
                ((Iterable<?>) a[0]).forEach(f -> feedbackRows.remove(((LensFeedback) f).getId()));
                yield null;
            }
            default -> throw new UnsupportedOperationException(name);
        });
        WardrobeItemRepository pieces = proxy(WardrobeItemRepository.class, (name, a) -> switch (name) {
            case "findById" -> Optional.ofNullable(pieceRows.get((UUID) a[0]));
            case "findByUserIdOrderByCreatedAtDesc" -> pieceRows.values().stream().filter(w -> w.getUser().getId().equals(a[0])).toList();
            case "findByIdIn" -> pieceRows.values().stream().filter(w -> ((Collection<?>) a[0]).contains(w.getId())).toList();
            default -> throw new UnsupportedOperationException(name);
        });
        SchemeRepository schemes = proxy(SchemeRepository.class, (name, a) -> switch (name) {
            case "findById" -> Optional.ofNullable(schemeRows.get((UUID) a[0]));
            case "findByUserIdOrderByCreatedAtDesc" -> List.of();
            default -> throw new UnsupportedOperationException(name);
        });
        SchemeItemRepository schemeItems = proxy(SchemeItemRepository.class, (name, a) -> List.of());
        StyleDnaRepository dnas = proxy(StyleDnaRepository.class, (name, a) -> dnaRow);
        HypeScoreCurrentRepository hype = proxy(HypeScoreCurrentRepository.class, (name, a) -> switch (name) {
            case "findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus" -> hypeRows.stream()
                    .filter(h -> h.getEntityType() == a[0] && h.isPublicEligible() && h.getStatus() == a[2]).toList();
            case "findByEntityTypeAndEntityIdInAndAlgorithmVersion" -> hypeRows.stream()
                    .filter(h -> h.getEntityType() == a[0] && ((Collection<?>) a[1]).contains(h.getEntityId())).toList();
            default -> throw new UnsupportedOperationException(name);
        });
        GarmentEmbeddingRepository embeddings = proxy(GarmentEmbeddingRepository.class, (name, a) -> List.of());
        PieceImageRepository pieceImages = proxy(PieceImageRepository.class, (name, a) -> List.of());
        UserConsentRepository consents = proxy(UserConsentRepository.class, (name, a) -> Optional.empty());
        FollowRepository follows = proxy(FollowRepository.class, (name, a) -> Optional.empty());

        MediaStoragePort storage = new MediaStoragePort() {
            public URI createUploadUrl(String k, String c) { return URI.create("http://x/" + k); }
            public URI publicUrl(String k) { return URI.create("http://x/media/" + k); }
            public StoredObject put(String k, byte[] b, String c) { blobs.put(k, b); return new StoredObject(k, "http://x/media/" + k, b.length, c); }
            public byte[] get(String k) { byte[] b = blobs.get(k); if (b == null) throw ApiException.notFound("x"); return b; }
            public void delete(String k) { blobs.remove(k); }
            public Optional<String> keyOf(String url) {
                return url != null && url.startsWith("http://x/media/") ? Optional.of(url.substring("http://x/media/".length())) : Optional.empty();
            }
        };
        RateLimitPort rateLimit = new RateLimitPort() {
            public boolean tryAcquire(UUID userId, String bucket, int limit, Duration window) {
                int used = quota.getOrDefault(userId + bucket, 0);
                if (used >= limit) {
                    return false;
                }
                quota.put(userId + bucket, used + 1);
                return true;
            }

            public QuotaStatus status(UUID userId, String bucket, int limit, Duration window) {
                return new QuotaStatus(limit, quota.getOrDefault(userId + bucket, 0), Instant.now().plus(Duration.ofHours(3)));
            }
        };

        multiPiece = mock(MultiPieceService.class);
        when(multiPiece.detectPieces(any(), any())).thenAnswer(inv -> {
            List<MultiPieceService.DetectedPiece> ps = nextPieces;
            AiOutcome<List<MultiPieceService.DetectedPiece>> out = new AiOutcome<>(ps, UUID.randomUUID(), nextResult,
                    "local".equals(nextSource), "local".equals(nextSource) ? "local" : "gemini", "local".equals(nextSource) ? "local" : "vision",
                    1, BigDecimal.ZERO, null, null, null);
            return new MultiPieceService.PieceDetection(ps, nextSource, out);
        });
        wardrobe = mock(WardrobeService.class);
        when(wardrobe.viewerState(any(), any())).thenReturn(Views.ViewerState.NONE);

        Guard guard = new Guard(event -> { }, follows);
        lens = new LensService(scans, detections, feedback, pieces, schemes, schemeItems, dnas, hype, HypeScoreConfig.defaults(),
                embeddings, pieceImages, consents, multiPiece, storage, new MediaService(storage, null), rateLimit, wardrobe,
                guard, LensConfig.defaults());
        nextPieces = List.of(
                detected(0, "Jaqueta jeans", "upper_piece", "jacket", "denim", List.of("casual"), 10, 10, 50, 40, 0.92),
                detected(1, "Calça preta", "lower_piece", "tailored_pants", "black", List.of("minimalist"), 20, 55, 40, 40, 0.6));
    }

    // ------------------------------------------------------------------ fixtures

    @SuppressWarnings("unchecked")
    static <T> T proxy(Class<T> type, BiFunction<String, Object[], Object> body) {
        return (T) Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type},
                (p, m, a) -> m.getDeclaringClass() == Object.class ? m.invoke(new Object(), a) : body.apply(m.getName(), a == null ? new Object[0] : a));
    }

    static <T extends AuditableEntity> T saveRow(Map<UUID, T> rows, T row) {
        if (row.getId() == null) {
            row.assignId(UUID.randomUUID());
        }
        if (row.getCreatedAt() == null) {
            row.markCreatedAt(Instant.now());
        }
        rows.put(row.getId(), row);
        return row;
    }

    static <T> PageImpl<T> page(List<T> all, Pageable p) {
        int from = Math.min(all.size(), (int) p.getOffset());
        int to = Math.min(all.size(), from + p.getPageSize());
        return new PageImpl<>(all.subList(from, to), p, all.size());
    }

    static User user(String name) {
        User u = new User();
        u.assignId(UUID.randomUUID());
        u.setUsername(name);
        u.setProfileType(ProfileType.PESSOAL);
        u.setProfileVisibility(Visibility.PUBLIC);
        u.setStatus(AccountStatus.ACTIVE);
        u.setEmailVerified(true);
        return u;
    }

    static CurrentUser current(User u) {
        return new CurrentUser(u.getId(), u.getUsername(), "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, "127.0.0.1", "test");
    }

    static MultiPieceService.DetectedPiece detected(int i, String name, String cat, String sub, String color, List<String> styles,
                                                    double x, double y, double w, double h, double conf) {
        return new MultiPieceService.DetectedPiece(i, name, cat, sub, color, "COTTON", "UNISSEX", styles, List.of("casual"),
                new MultiPieceService.Box(x, y, w, h), conf);
    }

    WardrobeItem piece(User owner, String cat, String sub, String color, Visibility visibility) {
        WardrobeItem w = new WardrobeItem();
        w.assignId(UUID.randomUUID());
        w.markCreatedAt(Instant.now().minus(Duration.ofDays(90)));
        w.setUser(owner);
        w.setName(sub);
        w.setCategory(cat);
        w.setSubcategory(sub);
        w.setColor(color);
        w.setMaterial("COTTON");
        w.setStyleTags("casual");
        w.setVisibility(visibility);
        w.setModerationStatus(ModerationStatus.APPROVED);
        pieceRows.put(w.getId(), w);
        return w;
    }

    void publicHype(WardrobeItem w, double score) {
        HypeScoreCurrent h = new HypeScoreCurrent();
        h.setEntityType(HypeEntityType.PIECE);
        h.setEntityId(w.getId());
        h.setOwnerId(w.getUser().getId());
        h.setAlgorithmVersion(HypeScoreConfig.DEFAULT_VERSION);
        h.setStatus(HypeStatus.AVAILABLE);
        h.setScore(BigDecimal.valueOf(score));
        h.setDeltaPoints(BigDecimal.valueOf(5));
        h.setPublicEligible(true);
        h.setCategory(w.getCategory());
        hypeRows.add(h);
    }

    static byte[] photo() {
        BufferedImage img = new BufferedImage(400, 600, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, 400, 600);
        g.setColor(new Color(0x4A6A8C));
        g.fillRect(40, 60, 200, 240);
        g.setColor(new Color(0x12100F));
        g.fillRect(80, 330, 160, 240);
        g.dispose();
        return ImageOps.jpeg(img, 0.9f);
    }

    LensViews.ScanView scan() {
        return lens.create(meUser, new LensService.CreateCommand("CAMERA", "IDENTIFY", 1, true), photo());
    }

    static String code(Executable e) {
        return assertThrows(ApiException.class, e).code();
    }

    static int status(Executable e) {
        return assertThrows(ApiException.class, e).status();
    }
}
