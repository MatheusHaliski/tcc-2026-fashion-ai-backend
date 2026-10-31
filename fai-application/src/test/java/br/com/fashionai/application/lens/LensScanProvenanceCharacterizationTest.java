package br.com.fashionai.application.lens;

import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.ports.RateLimitPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.MediaService;
import br.com.fashionai.application.service.MultiPieceService;
import br.com.fashionai.application.service.WardrobeService;
import br.com.fashionai.application.vision.analysis.GarmentEmbedder;
import br.com.fashionai.domain.model.LensDetection;
import br.com.fashionai.domain.model.LensScan;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.AiCallResult;
import br.com.fashionai.domain.model.enums.LensDetectionStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
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

import java.awt.image.BufferedImage;
import java.math.BigDecimal;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Caracterização (lote GoF 13) da proveniência do scan do Lens, observada só pelo {@code create} público: status e
 * motivo de degradação, {@code aiSource}, {@code modelVersion}, id da inferência, ordem de leitura das peças e linha
 * gravada por peça. O detector é um fake determinístico local (Mockito); nenhuma IA real é chamada.
 */
class LensScanProvenanceCharacterizationTest {
    static final String EMBEDDER = GarmentEmbedder.MODEL.key();

    final List<LensScan> savedScans = new ArrayList<>();
    final List<LensDetection> savedDetections = new ArrayList<>();
    MultiPieceService multiPiece;
    RateLimitPort rateLimit;
    LensService lens;
    CurrentUser me;

    @BeforeEach
    void setUp() {
        LensScanRepository scans = mock(LensScanRepository.class);
        when(scans.save(any())).thenAnswer(inv -> {
            LensScan s = inv.getArgument(0);
            if (s.getId() == null) {
                s.assignId(UUID.randomUUID());
            }
            savedScans.add(s);
            return s;
        });
        LensDetectionRepository detections = mock(LensDetectionRepository.class);
        when(detections.save(any())).thenAnswer(inv -> {
            LensDetection d = inv.getArgument(0);
            d.assignId(UUID.randomUUID());
            savedDetections.add(d);
            return d;
        });
        rateLimit = mock(RateLimitPort.class);
        when(rateLimit.tryAcquire(any(), anyString(), anyInt(), any())).thenReturn(true);
        multiPiece = mock(MultiPieceService.class);
        MediaStoragePort storage = mock(MediaStoragePort.class);
        lens = new LensService(scans, detections, mock(LensFeedbackRepository.class), mock(WardrobeItemRepository.class),
                mock(SchemeRepository.class), mock(SchemeItemRepository.class), mock(StyleDnaRepository.class),
                mock(HypeScoreCurrentRepository.class), HypeScoreConfig.defaults(), mock(GarmentEmbeddingRepository.class),
                mock(PieceImageRepository.class), mock(UserConsentRepository.class), multiPiece, storage,
                new MediaService(storage, null), rateLimit, mock(WardrobeService.class),
                new Guard(event -> { }, mock(FollowRepository.class)), LensConfig.defaults());
        me = new CurrentUser(UUID.randomUUID(), "eu", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, "127.0.0.1", "test");
    }

    static MultiPieceService.DetectedPiece piece(int i, String name, double x, double y, double conf) {
        return new MultiPieceService.DetectedPiece(i, name, "upper_piece", "jacket", "denim", "COTTON", "UNISSEX",
                List.of("casual"), List.of("work"), new MultiPieceService.Box(x, y, 30, 30), conf);
    }

    void detector(List<MultiPieceService.DetectedPiece> ps, String source, AiCallResult result, String provider, String model,
                  UUID inference) {
        AiOutcome<List<MultiPieceService.DetectedPiece>> out = new AiOutcome<>(ps, inference, result, "local".equals(source),
                provider, model, 1, BigDecimal.ZERO, null, null, null);
        when(multiPiece.detectPieces(any(), any())).thenReturn(new MultiPieceService.PieceDetection(ps, source, out));
    }

    static byte[] photo() {
        return ImageOps.jpeg(new BufferedImage(200, 300, BufferedImage.TYPE_INT_RGB), 0.9f);
    }

    LensViews.ScanView scan(boolean redactionConfirmed) {
        return lens.create(me, new LensService.CreateCommand("UPLOAD", "IDENTIFY", 0, redactionConfirmed), photo());
    }

    LensScan lastScan() {
        return savedScans.get(savedScans.size() - 1);
    }

    @Test
    void iaComSucessoFicaProntaComProvedorModeloEInferencia() {
        UUID inference = UUID.randomUUID();
        detector(List.of(piece(0, "Baixo direita", 50, 60, 0.9), piece(1, "Cima", 10, 5, 0.8), piece(2, "Baixo esquerda", 5, 60, 0.7)),
                "ia", AiCallResult.SUCCESS, "gemini", "vision", inference);
        LensViews.ScanView v = scan(true);
        assertThat(v.status()).isEqualTo("READY");
        assertThat(v.errorCode()).isNull();
        assertThat(v.aiSource()).isEqualTo("ia");
        assertThat(v.algorithmVersion()).isEqualTo(LensConfig.ALGORITHM_VERSION);
        assertThat(v.modelVersion()).isEqualTo("multi-piece-detector@gemini:vision+" + EMBEDDER);
        assertThat(lastScan().getAiInferenceId()).isEqualTo(inference);
        // ordem de leitura: de cima para baixo, depois da esquerda para a direita
        assertThat(v.detections()).extracting(LensViews.DetectionView::label)
                .containsExactly("Cima", "Baixo esquerda", "Baixo direita");
        assertThat(savedDetections).extracting(LensDetection::getOrdinal).containsExactly(0, 1, 2);
        verify(rateLimit, never()).release(any(), anyString());
    }

    @Test
    void falhaDoDetectorViraFailedLocalEDevolveACota() {
        when(multiPiece.detectPieces(any(), any())).thenThrow(new IllegalStateException("provedor fora"));
        LensViews.ScanView v = scan(true);
        assertThat(v.status()).isEqualTo("FAILED");
        assertThat(v.errorCode()).isEqualTo("FAILED");
        assertThat(v.aiSource()).isEqualTo("local");
        assertThat(v.modelVersion()).isEqualTo("multi-piece-detector@local+" + EMBEDDER);
        assertThat(lastScan().getAiInferenceId()).isNull();
        assertThat(v.detections()).isEmpty();
        verify(rateLimit, times(1)).release(eq(me.id()), eq(LensService.QUOTA_BUCKET));
    }

    @Test
    void semPecasNoFashionFoundSemDevolverCota() {
        detector(List.of(), "ia", AiCallResult.SUCCESS, "gemini", "vision", UUID.randomUUID());
        LensViews.ScanView v = scan(true);
        assertThat(v.status()).isEqualTo("NO_FASHION_FOUND");
        assertThat(v.errorCode()).isEqualTo("NO_FASHION_FOUND");
        verify(rateLimit, never()).release(any(), anyString());
    }

    @Test
    void leituraLocalExplicaSoConsentimentoECota() {
        List<MultiPieceService.DetectedPiece> local = List.of(MultiPieceService.localPiece());
        Object[][] cases = {
                {"local", AiCallResult.CONSENT_DENIED, "CONSENT_REQUIRED"},
                {"local", AiCallResult.RATE_LIMITED, "QUOTA"},
                {"local", AiCallResult.ERROR, null},
                {"local", AiCallResult.TIMEOUT, null},
                {"ia", AiCallResult.RATE_LIMITED, null},
        };
        for (Object[] c : cases) {
            detector(local, (String) c[0], (AiCallResult) c[1], "local", "local", UUID.randomUUID());
            LensViews.ScanView v = scan(true);
            assertThat(v.status()).as("%s/%s", c[0], c[1]).isEqualTo("READY");
            assertThat(v.errorCode()).as("%s/%s", c[0], c[1]).isEqualTo(c[2]);
            assertThat(v.modelVersion()).isEqualTo("multi-piece-detector@local+" + EMBEDDER);
        }
    }

    @Test
    void fotoSemConfirmacaoDoBorraoNuncaVaiParaAIaExterna() {
        LensViews.ScanView v = scan(false);
        verify(multiPiece, never()).detectPieces(any(), any());
        assertThat(v.status()).isEqualTo("READY");
        assertThat(v.errorCode()).isNull();
        assertThat(v.aiSource()).isEqualTo("local");
        assertThat(v.modelVersion()).isEqualTo("multi-piece-detector@local+" + EMBEDDER);
        assertThat(lastScan().getAiInferenceId()).isNull();
        assertThat(v.detections()).singleElement().satisfies(d -> {
            assertThat(d.confidenceBand()).isEqualTo("LOW");
            assertThat(d.box()).isEqualTo(new LensViews.Box(0, 0, 100, 100));
        });
    }

    @Test
    void versaoDoModeloLimitadaA160Caracteres() {
        detector(List.of(piece(0, "Peça", 1, 1, 0.5)), "ia", AiCallResult.SUCCESS, "p".repeat(150), "m".repeat(50), UUID.randomUUID());
        LensViews.ScanView v = scan(true);
        assertThat(v.modelVersion()).hasSize(160).startsWith("multi-piece-detector@" + "p".repeat(139));
    }

    @Test
    void linhaDaPecaGuardaRotuloConfiancaEmbeddingEStatus() {
        detector(List.of(piece(0, "  ", 10, 10, 0.9235)), "ia", AiCallResult.SUCCESS, "gemini", "vision", UUID.randomUUID());
        LensViews.ScanView v = scan(true);
        LensDetection d = savedDetections.get(0);
        assertThat(d.getScanId()).isEqualTo(v.id());
        assertThat(d.getLabel()).isEqualTo(LensService.defaultLabel("upper_piece", "jacket"));
        assertThat(d.getConfidence()).isEqualByComparingTo("0.924");
        assertThat(d.getConfidence().scale()).isEqualTo(3);
        assertThat(d.getAttributeConfidenceJson()).startsWith("{\"detection\":0.9235,\"pattern\":");
        assertThat(d.getBoxJson()).isEqualTo("{\"x\":10.0,\"y\":10.0,\"w\":30.0,\"h\":30.0}");
        assertThat(d.getStyleTags()).isEqualTo("casual");
        assertThat(d.getOccasionTags()).isEqualTo("work");
        assertThat(d.getMaterial()).isEqualTo("COTTON");
        assertThat(d.getSex()).isEqualTo("UNISSEX");
        assertThat(d.getEmbeddingModel()).isEqualTo(EMBEDDER);
        assertThat(d.getEmbeddingJson()).startsWith("[");
        assertThat(d.getStatus()).isEqualTo(LensDetectionStatus.DETECTED);
    }

    @Test
    void cotaPedidaUmaVezPorScanNoBucketDoLens() {
        detector(List.of(piece(0, "Peça", 1, 1, 0.5)), "ia", AiCallResult.SUCCESS, "gemini", "vision", UUID.randomUUID());
        scan(true);
        verify(rateLimit, times(1)).tryAcquire(eq(me.id()), eq(LensService.QUOTA_BUCKET), anyInt(), eq(Duration.ofDays(1)));
    }
}
