package br.com.fashionai.application.lens;

import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.service.MultiPieceService;
import br.com.fashionai.application.vision.analysis.GarmentEmbedder;
import br.com.fashionai.domain.model.LensScan;
import br.com.fashionai.domain.model.enums.AiCallResult;
import br.com.fashionai.domain.model.enums.LensScanStatus;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Unidade pura extraída no lote GoF 13: nenhuma IA, repositório ou storage — só o resultado do detector (fake). */
class LensScanProvenanceTest {
    static final String EMBEDDER = GarmentEmbedder.MODEL.key();

    static MultiPieceService.DetectedPiece at(int i, double x, double y) {
        return new MultiPieceService.DetectedPiece(i, "p" + i, "upper_piece", "shirt", "white", null, null, List.of(),
                List.of(), new MultiPieceService.Box(x, y, 10, 10), 0.5);
    }

    static MultiPieceService.PieceDetection det(List<MultiPieceService.DetectedPiece> ps, String source, AiCallResult r,
                                                String provider, UUID inference) {
        return new MultiPieceService.PieceDetection(ps, source, new AiOutcome<>(ps, inference, r, "local".equals(source),
                provider, "vision", 0, BigDecimal.ZERO, null, null, null));
    }

    @Test
    void falhaDoDetectorNuncaViraSucesso() {
        LensScan s = new LensScan();
        LensScanProvenance.stamp(s, null);
        assertThat(s.getStatus()).isEqualTo(LensScanStatus.FAILED);
        assertThat(s.getErrorCode()).isEqualTo("FAILED");
        assertThat(s.getAiSource()).isEqualTo("local");
        assertThat(s.getAiInferenceId()).isNull();
        assertThat(s.getModelVersion()).isEqualTo("multi-piece-detector@local+" + EMBEDDER);
        assertThat(LensScanProvenance.readingOrder(null)).isEmpty();
    }

    @Test
    void semPecasESucessoComProvenienciaDoProvedor() {
        UUID inf = UUID.randomUUID();
        LensScan empty = new LensScan();
        LensScanProvenance.stamp(empty, det(List.of(), "ia", AiCallResult.SUCCESS, "gemini", inf));
        assertThat(empty.getStatus()).isEqualTo(LensScanStatus.NO_FASHION_FOUND);
        assertThat(empty.getErrorCode()).isEqualTo("NO_FASHION_FOUND");

        LensScan ok = new LensScan();
        LensScanProvenance.stamp(ok, det(List.of(at(0, 1, 1)), "ia", AiCallResult.SUCCESS, "gemini", inf));
        assertThat(ok.getStatus()).isEqualTo(LensScanStatus.READY);
        assertThat(ok.getErrorCode()).isNull();
        assertThat(ok.getAiSource()).isEqualTo("ia");
        assertThat(ok.getAiInferenceId()).isEqualTo(inf);
        assertThat(ok.getModelVersion()).isEqualTo("multi-piece-detector@gemini:vision+" + EMBEDDER);
    }

    @Test
    void motivoDeDegradacaoSoParaLeituraLocalPorConsentimentoOuCota() {
        Map<AiCallResult, String> expected = new EnumMap<>(AiCallResult.class);
        expected.put(AiCallResult.CONSENT_DENIED, "CONSENT_REQUIRED");
        expected.put(AiCallResult.RATE_LIMITED, "QUOTA");
        List<MultiPieceService.DetectedPiece> one = List.of(MultiPieceService.localPiece());
        for (AiCallResult r : AiCallResult.values()) {
            assertThat(LensScanProvenance.degradedReason(det(one, "local", r, "local", null))).as(r.name())
                    .isEqualTo(expected.get(r));
            assertThat(LensScanProvenance.degradedReason(det(one, "ia", r, "gemini", null))).as("ia " + r).isNull();
        }
        assertThat(LensScanProvenance.degradedReason(null)).isNull();
        assertThat(LensScanProvenance.degradedReason(LensScanProvenance.localDetection())).isNull();   // sem outcome
    }

    @Test
    void leituraLocalSemIaExterna() {
        MultiPieceService.PieceDetection local = LensScanProvenance.localDetection();
        assertThat(local.source()).isEqualTo("local");
        assertThat(local.outcome()).isNull();
        assertThat(local.pieces()).singleElement().satisfies(p -> assertThat(p.box()).isEqualTo(new MultiPieceService.Box(0, 0, 100, 100)));
    }

    @Test
    void versaoDoModeloLocalOuSemProvedorELimite() {
        assertThat(LensScanProvenance.modelVersion(null)).isEqualTo("multi-piece-detector@local+" + EMBEDDER);
        AiOutcome<Object> noProvider = new AiOutcome<>(null, null, AiCallResult.ERROR, true, null, "m", 0, null, null, null, null);
        assertThat(LensScanProvenance.modelVersion(noProvider)).isEqualTo("multi-piece-detector@local+" + EMBEDDER);
        AiOutcome<Object> huge = new AiOutcome<>(null, null, AiCallResult.SUCCESS, false, "x".repeat(300), "m", 0, null, null, null, null);
        assertThat(LensScanProvenance.modelVersion(huge)).hasSize(LensScanProvenance.MODEL_VERSION_MAX);
    }

    @Test
    void ordemDeLeituraDeCimaParaBaixoDepoisEsquerdaParaDireitaSemAlterarAEntrada() {
        List<MultiPieceService.DetectedPiece> in = List.of(at(0, 50, 60), at(1, 10, 5), at(2, 5, 60), at(3, 70, 5));
        List<MultiPieceService.DetectedPiece> out = LensScanProvenance.readingOrder(det(in, "ia", AiCallResult.SUCCESS, "g", null));
        assertThat(out).extracting(MultiPieceService.DetectedPiece::index).containsExactly(1, 3, 2, 0);
        assertThat(in).extracting(MultiPieceService.DetectedPiece::index).containsExactly(0, 1, 2, 3);
    }
}
