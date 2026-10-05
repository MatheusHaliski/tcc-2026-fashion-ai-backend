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
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.AiCallResult;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.LensFeedbackKind;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SchemeStatus;
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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.lang.reflect.Constructor;
import java.lang.reflect.Proxy;
import java.math.BigDecimal;
import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.BiFunction;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

/**
 * RF54 · FashionAI Lens (serviço): scan do dono (outra pessoa = 404 em toda rota), "Ver no Lens" respeitando a
 * visibilidade, NO_FASHION_FOUND, correções que refazem a correspondência, descarte, retenção de 30 dias, comunidade sem
 * peças próprias nem privadas, plano Recriar e nenhum sinal de Hype.
 */
class LensServiceTest {
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
        StyleDnaRepository dnas = proxy(StyleDnaRepository.class, (name, a) -> Optional.empty());
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
        return lens.create(meUser, new LensService.CreateCommand("CAMERA", "IDENTIFY", 1, false), photo());
    }

    static String code(Executable e) {
        return assertThrows(ApiException.class, e).code();
    }

    static int status(Executable e) {
        return assertThrows(ApiException.class, e).status();
    }

    // ------------------------------------------------------------------ testes

    @Test
    void scanGravaImagemPrivadaSemMetadadosEPecasEmOrdemDeLeitura() {
        LensViews.ScanView v = scan();
        assertThat(v.status()).isEqualTo("READY");
        assertThat(v.errorCode()).isNull();
        assertThat(v.source()).isEqualTo("CAMERA");
        assertThat(v.aiSource()).isEqualTo("ia");
        assertThat(v.algorithmVersion()).isEqualTo("LENS_V1");
        assertThat(v.facesRedacted()).isEqualTo(1);
        assertThat(v.expiresAt()).isAfter(Instant.now().plus(Duration.ofDays(29)));
        assertThat(v.savedAt()).isNull();
        assertThat(v.detections()).extracting(LensViews.DetectionView::label).containsExactly("Jaqueta jeans", "Calça preta");
        LensViews.DetectionView jacket = v.detections().get(0);
        assertThat(jacket.box()).isEqualTo(new LensViews.Box(10, 10, 50, 40));
        assertThat(jacket.colors().get(0).name()).isEqualTo("denim");
        assertThat(jacket.confidenceBand()).isEqualTo("HIGH");
        assertThat(v.detections().get(1).confidenceBand()).isEqualTo("MEDIUM");
        assertThat(jacket.pattern()).isNotNull();
        assertThat(jacket.topMatch()).isNull();                                     // guarda-roupa vazio: nunca 0%
        assertThat(v.reading().trend().status()).isEqualTo("INSUFFICIENT_DATA");
        assertThat(v.reading().impact().gaps()).isEqualTo(2);
        // só em restricted/, regravada como JPEG sem EXIF (o JPEG gerado aqui não tem APP1)
        assertThat(blobs.keySet()).allMatch(k -> k.startsWith("restricted/users/" + me.getId() + "/lens/" + v.id()));
        byte[] stored = lens.image(meUser, v.id(), false);
        assertThat(new String(stored, java.nio.charset.StandardCharsets.ISO_8859_1)).doesNotContain("Exif");
        assertThat(lens.image(meUser, v.id(), true).length).isLessThan(stored.length);
    }

    @Test
    void outraPessoaRecebe404EmTodaRota() {
        UUID id = scan().id();
        UUID did = detectionRows.values().iterator().next().getId();
        List<Executable> routes = List.of(
                () -> lens.get(otherUser, id),
                () -> lens.image(otherUser, id, false),
                () -> lens.matches(otherUser, id, did, "MY_CLOSET"),
                () -> lens.reading(otherUser, id, null),
                () -> lens.recreate(otherUser, id, new LensService.RecreateCommand("SAFE", null, null)),
                () -> lens.setSaved(otherUser, id, true),
                () -> lens.delete(otherUser, id),
                () -> lens.correct(otherUser, id, did, new LensService.CorrectionCommand("lower_piece", null, null, null, null, null, null)),
                () -> lens.add(otherUser, id, new LensService.AddDetectionCommand(new LensService.BoxInput(1.0, 1.0, 20.0, 20.0), "shoes_piece", null, null)),
                () -> lens.want(otherUser, id, did, true),
                () -> lens.own(otherUser, id, did, null));
        for (Executable route : routes) {
            assertEquals(404, status(route));
        }
        assertThat(scanRows).containsKey(id);                                      // nada mudou
        assertThat(detectionRows.values()).allMatch(d -> d.getWantedAt() == null && d.getDismissedAt() == null);
        assertThat(lens.history(otherUser, null, null, 0, 12).items()).isEmpty();
    }

    @Test
    void semPecasNaFotoNoFashionFoundEPessoaPodeMarcarUma() {
        nextPieces = List.of();
        LensViews.ScanView v = scan();
        assertThat(v.status()).isEqualTo("NO_FASHION_FOUND");
        assertThat(v.errorCode()).isEqualTo("NO_FASHION_FOUND");
        assertThat(v.detections()).isEmpty();
        LensViews.DetectionView added = lens.add(meUser, v.id(), new LensService.AddDetectionCommand(
                new LensService.BoxInput(10.0, 60.0, 30.0, 30.0), null, "casual_sneakers", "white"));
        assertThat(added.status()).isEqualTo("ADDED_BY_USER");
        assertThat(added.category()).isEqualTo("shoes_piece");
        assertThat(added.colors().get(0).name()).isEqualTo("white");
        assertThat(lens.get(meUser, v.id()).status()).isEqualTo("READY");
        assertThat(feedbackRows.values()).extracting(LensFeedback::getKind).containsExactly(LensFeedbackKind.MISSING_PIECE);
        assertEquals("CAIXA_INVALIDA", code(() -> lens.add(meUser, v.id(), new LensService.AddDetectionCommand(
                new LensService.BoxInput(99.0, 99.0, 30.0, 30.0), "shoes_piece", null, null))));
    }

    @Test
    void leituraLocalSemConsentimentoAvisaOMotivo() {
        nextSource = "local";
        nextResult = AiCallResult.CONSENT_DENIED;
        nextPieces = List.of(MultiPieceService.localPiece());
        LensViews.ScanView v = scan();
        assertThat(v.aiSource()).isEqualTo("local");
        assertThat(v.errorCode()).isEqualTo("CONSENT_REQUIRED");
        assertThat(v.detections()).hasSize(1);
        assertThat(v.detections().get(0).colors()).isNotEmpty();                  // cores medidas localmente
        assertThat(v.detections().get(0).confidenceBand()).isEqualTo("LOW");
    }

    @Test
    void correcaoGravaFeedbackERefazACorrespondencia() {
        WardrobeItem blazer = piece(me, "upper_piece", "blazer", "red", Visibility.PRIVATE);
        LensViews.ScanView v = scan();
        LensViews.DetectionView jacket = v.detections().get(0);
        // jaqueta jeans × blazer vermelho (subtipo e cor diferentes) fica abaixo do piso
        assertThat(jacket.topMatch()).isNull();
        LensViews.DetectionView fixed = lens.correct(meUser, v.id(), jacket.id(),
                new LensService.CorrectionCommand(null, "blazer", null, null, null, null, null));
        assertThat(fixed.status()).isEqualTo("CORRECTED");
        assertThat(fixed.subcategory()).isEqualTo("blazer");
        assertThat(fixed.topMatch()).isNotNull();
        assertThat(fixed.topMatch().pieceId()).isEqualTo(blazer.getId());
        assertThat(fixed.topMatch().similarity()).isGreaterThanOrEqualTo(LensConfig.FLOOR_MY_CLOSET);
        assertThat(lens.matches(meUser, v.id(), jacket.id(), "MY_CLOSET").items()).extracting(LensViews.MatchView::targetId)
                .containsExactly(blazer.getId());
        LensFeedback fb = feedbackRows.values().iterator().next();
        assertThat(fb.getKind()).isEqualTo(LensFeedbackKind.WRONG_CATEGORY);
        assertThat(fb.getBeforeJson()).contains("jacket");
        assertThat(fb.getAfterJson()).contains("blazer");
        assertThat(fb.isTrainingConsent()).isFalse();
        // cor fora da paleta: 400, nada muda
        assertEquals("VALOR_INVALIDO", code(() -> lens.correct(meUser, v.id(), jacket.id(),
                new LensService.CorrectionCommand(null, null, "roxo-inventado", null, null, null, null))));
        LensViews.DetectionView recolored = lens.correct(meUser, v.id(), jacket.id(),
                new LensService.CorrectionCommand(null, null, "red", null, "striped", List.of("streetwear"), null));
        assertThat(recolored.colors().get(0).name()).isEqualTo("red");
        assertThat(recolored.pattern()).isEqualTo("striped");
        assertThat(recolored.styles()).containsExactly("streetwear");
    }

    @Test
    void descartadaSomeDoScanEDesfazerVolta() {
        LensViews.ScanView v = scan();
        UUID did = v.detections().get(1).id();
        LensViews.DetectionView dismissed = lens.correct(meUser, v.id(), did,
                new LensService.CorrectionCommand(null, null, null, null, null, null, true));
        assertThat(dismissed.status()).isEqualTo("DISMISSED");
        assertThat(lens.get(meUser, v.id()).detections()).extracting(LensViews.DetectionView::id).doesNotContain(did).hasSize(1);
        assertThat(lens.matches(meUser, v.id(), null, "MY_CLOSET").items()).isEmpty();
        assertThat(feedbackRows.values()).extracting(LensFeedback::getKind).contains(LensFeedbackKind.NOT_CLOTHING);
        LensViews.DetectionView back = lens.correct(meUser, v.id(), did,
                new LensService.CorrectionCommand(null, null, null, null, null, null, false));
        assertThat(back.status()).isEqualTo("DETECTED");
        assertThat(lens.get(meUser, v.id()).detections()).hasSize(2);
    }

    @Test
    void salvoNaoExpiraENaoSalvoSomeDepoisDe30Dias() {
        LensViews.ScanView kept = scan();
        LensViews.ScanView gone = scan();
        lens.correct(meUser, gone.id(), gone.detections().get(0).id(),
                new LensService.CorrectionCommand(null, null, "red", null, null, null, null));
        LensViews.ScanView saved = lens.setSaved(meUser, kept.id(), true);
        assertThat(saved.savedAt()).isNotNull();
        assertThat(saved.expiresAt()).isNull();

        assertThat(lens.purgeExpired(Instant.now())).isZero();                     // ninguém venceu ainda
        int removed = lens.purgeExpired(Instant.now().plus(Duration.ofDays(31)));
        assertThat(removed).isEqualTo(1);
        assertThat(scanRows).containsOnlyKeys(kept.id());
        assertThat(detectionRows.values()).allMatch(d -> d.getScanId().equals(kept.id()));
        assertThat(feedbackRows).isEmpty();
        assertThat(blobs.keySet()).noneMatch(k -> k.contains(gone.id().toString()));
        assertThat(blobs.keySet()).anyMatch(k -> k.contains(kept.id().toString()));

        LensViews.ScanView unsaved = lens.setSaved(meUser, kept.id(), false);
        assertThat(unsaved.expiresAt()).isAfter(Instant.now().plus(Duration.ofDays(29)));
        assertThat(lens.history(meUser, true, null, 0, 12).items()).isEmpty();
        assertThat(lens.history(meUser, false, null, 0, 12).items()).hasSize(1);
    }

    @Test
    void excluirScanEExcluirContaApagamImagemELinhas() {
        LensViews.ScanView a = scan();
        lens.delete(meUser, a.id());
        assertThat(scanRows).isEmpty();
        assertThat(detectionRows).isEmpty();
        assertThat(blobs).isEmpty();
        scan();
        lens.setSaved(meUser, scan().id(), true);
        lens.deleteAllFor(me.getId());
        assertThat(scanRows).isEmpty();
        assertThat(detectionRows).isEmpty();
        assertThat(blobs).isEmpty();
    }

    @Test
    void verNoLensRespeitaAVisibilidade() {
        WardrobeItem privateOfOther = piece(other, "upper_piece", "jacket", "denim", Visibility.PRIVATE);
        blobs.put("users/" + other.getId() + "/p.jpg", photo());
        privateOfOther.setImageUrl("http://x/media/users/" + other.getId() + "/p.jpg");
        assertEquals(404, status(() -> lens.fromApp(meUser, new LensService.FromAppCommand("PIECE", privateOfOther.getId()))));
        assertEquals(404, status(() -> lens.fromApp(meUser, new LensService.FromAppCommand("PIECE", UUID.randomUUID()))));

        WardrobeItem pending = piece(other, "upper_piece", "jacket", "denim", Visibility.PUBLIC);
        pending.setModerationStatus(ModerationStatus.PENDING);
        pending.setImageUrl(privateOfOther.getImageUrl());
        assertEquals(404, status(() -> lens.fromApp(meUser, new LensService.FromAppCommand("PIECE", pending.getId()))));

        Scheme privateLook = new Scheme();
        privateLook.assignId(UUID.randomUUID());
        privateLook.setUser(other);
        privateLook.setVisibility(Visibility.PRIVATE);
        privateLook.setStatus(SchemeStatus.PUBLISHED);
        privateLook.setCoverImageUrl(privateOfOther.getImageUrl());
        schemeRows.put(privateLook.getId(), privateLook);
        assertEquals(404, status(() -> lens.fromApp(meUser, new LensService.FromAppCommand("LOOK", privateLook.getId()))));
        assertThat(scanRows).isEmpty();

        WardrobeItem publicPiece = piece(other, "upper_piece", "jacket", "denim", Visibility.PUBLIC);
        publicPiece.setImageUrl(privateOfOther.getImageUrl());
        LensViews.ScanView v = lens.fromApp(meUser, new LensService.FromAppCommand("PIECE", publicPiece.getId()));
        assertThat(v.source()).isEqualTo("IN_APP_PIECE");
        assertThat(scanRows.get(v.id()).getSourceRefId()).isEqualTo(publicPiece.getId());
        assertThat(scanRows.get(v.id()).getUserId()).isEqualTo(me.getId());       // o scan é de quem pediu
        // a própria peça privada pode ser escaneada pelo dono
        WardrobeItem mine = piece(me, "upper_piece", "jacket", "denim", Visibility.PRIVATE);
        mine.setImageUrl(privateOfOther.getImageUrl());
        assertThat(lens.fromApp(meUser, new LensService.FromAppCommand("PIECE", mine.getId())).source()).isEqualTo("IN_APP_PIECE");
        // peça sem foto legível (ilustração padrão): 422
        WardrobeItem illustrated = piece(me, "upper_piece", "jacket", "denim", Visibility.PRIVATE);
        illustrated.setDefaultImage(true);
        assertEquals("LENS_SEM_IMAGEM", code(() -> lens.fromApp(meUser, new LensService.FromAppCommand("PIECE", illustrated.getId()))));
    }

    @Test
    void comunidadeNuncaTrazPecaPropriaNemNaoPublica() {
        WardrobeItem publicOther = piece(other, "upper_piece", "jacket", "denim", Visibility.PUBLIC);
        WardrobeItem privateOther = piece(other, "upper_piece", "jacket", "denim", Visibility.PRIVATE);
        WardrobeItem mineToo = piece(me, "upper_piece", "jacket", "denim", Visibility.PUBLIC);
        WardrobeItem archived = piece(other, "upper_piece", "jacket", "denim", Visibility.PUBLIC);
        archived.setAvailabilityStatus(AvailabilityStatus.ARCHIVED);
        WardrobeItem notEligible = piece(other, "upper_piece", "jacket", "denim", Visibility.PUBLIC);
        publicHype(publicOther, 50);
        publicHype(privateOther, 50);            // linha velha do Hype: a leitura confere a visibilidade de novo
        publicHype(mineToo, 50);
        publicHype(archived, 50);
        LensViews.ScanView v = scan();
        UUID jacket = v.detections().get(0).id();
        List<LensViews.MatchView> community = lens.matches(meUser, v.id(), jacket, "COMMUNITY").items();
        assertThat(community).extracting(LensViews.MatchView::targetId).containsExactly(publicOther.getId());
        assertThat(community.get(0).scope()).isEqualTo("COMMUNITY");
        assertThat(community.get(0).targetType()).isEqualTo("PIECE");
        assertThat(community.get(0).similarity()).isGreaterThanOrEqualTo(LensConfig.FLOOR_COMMUNITY);
        assertThat(community.get(0).components().visual()).isNull();              // sem embedding do lado da peça
        assertThat(community.get(0).reasons()).contains("SAME_SUBCATEGORY");
        assertThat(notEligible.getId()).isNotIn(community.stream().map(LensViews.MatchView::targetId).toList());
        // o guarda-roupa só traz as minhas
        assertThat(lens.matches(meUser, v.id(), jacket, "MY_CLOSET").items()).extracting(LensViews.MatchView::targetId)
                .containsExactly(mineToo.getId());
        assertEquals("VALOR_INVALIDO", code(() -> lens.matches(meUser, v.id(), jacket, "EVERYONE")));
    }

    @Test
    void hypeDoGrupoComCincoPecasPublicas() {
        for (int i = 0; i < 5; i++) {
            publicHype(piece(other, "upper_piece", "jacket", "denim", Visibility.PUBLIC), 60 + i);
        }
        LensViews.ReadingView r = lens.reading(meUser, scan().id(), null);
        assertThat(r.trend().status()).isEqualTo("AVAILABLE");
        assertThat(r.trend().key()).isEqualTo("cc:upper_piece|denim");
        assertThat(r.trend().items()).isEqualTo(5);
        assertThat(r.trend().score()).isEqualTo(62);
        assertThat(r.trend().direction()).isEqualTo("UP");
        assertThat(r.fit()).isNull();                                               // sem DNA: não inventa número
        assertThat(r.styles().stream().mapToInt(LensViews.StyleShare::share).sum()).isEqualTo(100);
    }

    @Test
    void recriarMontaSlotsComPecaPropriaAlternativaELacuna() {
        WardrobeItem myJacket = piece(me, "upper_piece", "jacket", "denim", Visibility.PRIVATE);
        WardrobeItem otherJacket = piece(me, "upper_piece", "jacket", "black", Visibility.PRIVATE);
        WardrobeItem myShorts = piece(me, "lower_piece", "shorts", "white", Visibility.PRIVATE);
        LensViews.ScanView v = scan();
        LensViews.RecreatePlan plan = lens.recreate(meUser, v.id(), new LensService.RecreateCommand("SAFE", null, null));
        assertThat(plan.mode()).isEqualTo("SAFE");
        assertThat(plan.slots()).extracting(LensViews.SlotView::slot).containsExactly("TOP", "BOTTOM");
        LensViews.SlotView top = plan.slots().get(0);
        assertThat(top.state()).isEqualTo("own");
        assertThat(top.piece().id()).isEqualTo(myJacket.getId());
        assertThat(top.alternatives()).extracting(Views.PieceView::id).containsExactly(otherJacket.getId());
        LensViews.SlotView bottom = plan.slots().get(1);
        assertThat(bottom.state()).isEqualTo("gap");                                // calça preta × shorts branco
        assertThat(bottom.piece()).isNull();
        assertThat(bottom.alternatives()).extracting(Views.PieceView::id).containsExactly(myShorts.getId());
        assertThat(plan.pieceIds()).containsExactly(myJacket.getId());
        assertThat(plan.createHref()).isEqualTo("/schemes/new?pieces=" + myJacket.getId());
        assertThat(plan.scores().usage()).isNotNull();
        assertThat(plan.scores().sustainability()).isNotNull();

        // slot fixado: fica com a peça escolhida, em qualquer modo
        LensViews.RecreatePlan locked = lens.recreate(meUser, v.id(),
                new LensService.RecreateCommand("EXPERIMENTAL", v.detections().get(1).id(), Map.of("TOP", otherJacket.getId().toString())));
        assertThat(locked.slots().get(0).slot()).isEqualTo("BOTTOM");              // foco vem primeiro
        LensViews.SlotView lockedTop = locked.slots().stream().filter(s -> s.slot().equals("TOP")).findFirst().orElseThrow();
        assertThat(lockedTop.piece().id()).isEqualTo(otherJacket.getId());
        assertThat(lockedTop.state()).isEqualTo("own");
        // peça de outra pessoa não pode ser fixada; modo inválido é 400
        WardrobeItem notMine = piece(other, "upper_piece", "jacket", "denim", Visibility.PUBLIC);
        assertEquals(404, status(() -> lens.recreate(meUser, v.id(), new LensService.RecreateCommand("SAFE", null,
                Map.of("TOP", notMine.getId().toString())))));
        assertEquals("MODO_INVALIDO", code(() -> lens.recreate(meUser, v.id(), new LensService.RecreateCommand("YOLO", null, null))));
    }

    @Test
    void euTenhoEQuero() {
        WardrobeItem mine = piece(me, "upper_piece", "jacket", "denim", Visibility.PRIVATE);
        WardrobeItem notMine = piece(other, "upper_piece", "jacket", "denim", Visibility.PUBLIC);
        LensViews.ScanView v = scan();
        UUID did = v.detections().get(0).id();
        assertThat(lens.want(meUser, v.id(), did, true).wanted()).isTrue();
        assertThat(lens.history(meUser, null, true, 0, 12).items()).hasSize(1);
        assertThat(lens.want(meUser, v.id(), did, false).wanted()).isFalse();

        LensViews.OwnResult linked = lens.own(meUser, v.id(), did, mine.getId());
        assertThat(linked.detection().ownedItemId()).isEqualTo(mine.getId());
        assertThat(linked.href()).isEqualTo("/pieces/" + mine.getId());
        assertEquals(404, status(() -> lens.own(meUser, v.id(), did, notMine.getId())));

        LensViews.OwnResult draft = lens.own(meUser, v.id(), v.detections().get(1).id(), null);
        assertThat(draft.href()).startsWith("/pieces/new?").contains("category=lower_piece").contains("subcategory=tailored_pants")
                .contains("color=black").contains("from=lens").doesNotContain("image").doesNotContain("restricted");
    }

    @Test
    void cotaDiariaDe30ScansNaoGravaNada() {
        quota.put(me.getId() + LensService.QUOTA_BUCKET, 30);
        ApiException ex = assertThrows(ApiException.class, this::scan);
        assertThat(ex.status()).isEqualTo(429);
        assertThat(ex.code()).isEqualTo("QUOTA");
        assertThat(ex.details()).containsKeys("resetAt", "limit");
        assertThat(scanRows).isEmpty();
        assertThat(blobs).isEmpty();
    }

    @Test
    void origemEIntencaoValidadas() {
        assertEquals("ORIGEM_INVALIDA", code(() -> lens.create(meUser, new LensService.CreateCommand("IN_APP_PIECE", null, 0, false), photo())));
        assertEquals("VALOR_INVALIDO", code(() -> lens.create(meUser, new LensService.CreateCommand("FAX", null, 0, false), photo())));
        assertEquals("VALOR_INVALIDO", code(() -> lens.create(meUser, new LensService.CreateCommand("UPLOAD", "BUY", 0, false), photo())));
        assertThat(lens.create(meUser, new LensService.CreateCommand(null, "RECREATE", null, null), photo()).intent()).isEqualTo("RECREATE");
    }

    /**
     * O Lens nunca gera Hype: o serviço não recebe publicador de eventos nem nada que escreva em hype_signal_daily, e do
     * WardrobeService só usa o estado de quem vê (o detalhe da peça, que registra visualização, nunca é chamado).
     */
    @Test
    void lensNuncaEscreveSinalDeHype() {
        Set<String> deps = Arrays.stream(LensService.class.getConstructors()).map(Constructor::getParameterTypes)
                .flatMap(Arrays::stream).map(Class::getSimpleName).collect(Collectors.toSet());
        assertThat(deps).doesNotContain("ApplicationEventPublisher", "HypeSignalRecorder", "HypeSignalDailyRepository",
                "HypeSnapshotService", "HypeLiveRecalc", "DomainEventPublisherPort");
        WardrobeItem mine = piece(me, "upper_piece", "jacket", "denim", Visibility.PRIVATE);
        publicHype(piece(other, "upper_piece", "jacket", "denim", Visibility.PUBLIC), 70);
        LensViews.ScanView v = scan();
        UUID did = v.detections().get(0).id();
        lens.get(meUser, v.id());
        lens.matches(meUser, v.id(), did, "MY_CLOSET");
        lens.matches(meUser, v.id(), did, "COMMUNITY");
        lens.reading(meUser, v.id(), did);
        lens.recreate(meUser, v.id(), new LensService.RecreateCommand("DISCOVERY", did, null));
        lens.own(meUser, v.id(), did, mine.getId());
        verify(wardrobe, atLeast(1)).viewerState(any(), any());
        verifyNoMoreInteractions(wardrobe);
    }
}
