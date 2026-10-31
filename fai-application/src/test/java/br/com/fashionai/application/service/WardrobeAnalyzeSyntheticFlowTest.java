package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.assets.PieceReferenceCatalog;
import br.com.fashionai.application.imaging.FlatLayPipeline;
import br.com.fashionai.application.imaging.LocalVision;
import br.com.fashionai.application.imaging.StudioPipeline;
import br.com.fashionai.application.imaging.SubtypeReferences;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.PipelineJob;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.AiCallResult;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.PipelineJobRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.transaction.annotation.Transactional;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.Polygon;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * RF4 — a análise da foto inteira ({@code analyze}/{@code analyzeForCapture}: {@link PieceDraftAnalyzer#detect} seguido
 * de {@link DraftRecorder#record}) com o pipeline de imagem local de verdade, a IA simulada e uma foto sintética, sem
 * depender de {@code public/assets_pecas} (ausente fora do checkout completo, o que pula o {@code WardrobeAnalyzeFlowTest}).
 * Fixa a ordem usuário → Flat Lay → moderação → analisador → gravação do rascunho e que a recusa acontece antes de
 * {@code jobs.save}, depois de as inferências já terem sido feitas (por isso {@code noRollbackFor}).
 */
class WardrobeAnalyzeSyntheticFlowTest {
    final List<AiEngine.TextCall<?>> textCalls = new ArrayList<>();
    String analyzerAnswer;
    WardrobeService service;
    CurrentUser user;
    UserRepository users;
    PipelineJobRepository jobs;
    AiEngine ai;

    @BeforeEach
    void setUp() {
        PieceReferenceCatalog catalog = mock(PieceReferenceCatalog.class);
        when(catalog.get()).thenReturn(new SubtypeReferences(List.of()));
        User owner = new User();
        owner.assignId(UUID.randomUUID());
        user = new CurrentUser(owner.getId(), "ana", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
        users = mock(UserRepository.class);
        when(users.findById(owner.getId())).thenReturn(Optional.of(owner));
        jobs = mock(PipelineJobRepository.class);
        when(jobs.save(any())).thenAnswer(inv -> {
            PipelineJob j = inv.getArgument(0);
            j.assignId(UUID.randomUUID());
            return j;
        });
        MediaService media = mock(MediaService.class);
        when(media.put(anyString(), any(), anyString())).thenAnswer(inv ->
                new MediaStoragePort.StoredObject(inv.getArgument(0), "http://media/" + inv.getArgument(0), 1, inv.getArgument(2)));
        ai = mock(AiEngine.class);
        // pipeline de imagem e estúdio: sempre o motor local (o de verdade)
        when(ai.execute(any(), any(), any(), any(), any(), any(), any())).thenAnswer(inv ->
                outcome(((Supplier<?>) inv.getArgument(6)).get(), "local"));
        when(ai.text(any())).thenAnswer(inv -> {
            AiEngine.TextCall<?> call = inv.getArgument(0);
            textCalls.add(call);
            if (call.capability() == AiCapability.CONTENT_MODERATOR) {
                return outcome(new LocalVision.ModerationVerdict(ModerationStatus.APPROVED, 0.95, List.of(), false), "claude");
            }
            return outcome(call.parser().apply(analyzerAnswer), "claude");
        });
        service = new WardrobeService(null, users, null, jobs, null, null, null, null, null, null, null, null,
                new FlatLayPipeline(List.of(), List.of()), ai, media, null, null, null, null, null,
                new StudioPipeline(List.of(), List.of()), mock(br.com.fashionai.application.security.Guard.class), null, null, null, null,
                catalog, null, null, null);
    }

    static AiOutcome<Object> outcome(Object value, String provider) {
        return new AiOutcome<>(value, UUID.randomUUID(), AiCallResult.values()[0], false, provider, "m", 1, BigDecimal.ZERO, null, null, null);
    }

    /** Camiseta desenhada (corpo, mangas e gola) com trama, centrada num fundo claro liso, em JPEG 1400×1400. */
    static byte[] syntheticTee() throws Exception {
        BufferedImage photo = new BufferedImage(1400, 1400, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = photo.createGraphics();
        g.setColor(new Color(236, 236, 232));
        g.fillRect(0, 0, 1400, 1400);
        Polygon tee = new Polygon(
                new int[]{560, 840, 1080, 1010, 920, 920, 480, 480, 390, 320},
                new int[]{300, 300, 470, 600, 540, 1100, 1100, 540, 600, 470}, 10);
        g.setColor(new Color(38, 78, 160));
        g.fillPolygon(tee);
        g.setClip(tee);
        g.setColor(new Color(30, 64, 138));
        for (int y = 300; y < 1100; y += 6) {
            g.drawLine(300, y, 1100, y);
        }
        g.setClip(null);
        g.setColor(new Color(236, 236, 232));
        g.fillArc(620, 260, 160, 100, 180, 180);
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(photo, "jpg", out);
        return out.toByteArray();
    }

    @Test
    void analiseGravaORascunhoDepoisDoUsuarioDoFlatLayDaModeracaoEDoAnalisador() throws Exception {
        analyzerAnswer = """
                {"name": "Camiseta azul", "matchesCategory": true, "detectedCategory": "upper_piece", "subcategory": "t_shirt",
                 "color": "blue", "material": "COTTON", "sex": "UNISSEX", "occasion": ["casual"], "style": ["basic"],
                 "brand": "Fashion AI", "brandZone": "peito_esquerdo", "brandEvidence": "selo bordado",
                 "photo": {"fullyVisible": true, "viewAngle": "frontal_90", "singlePiece": true},
                 "confidence": {"category": 0.97, "subcategory": 0.9, "color": 0.9, "material": 0.6, "brand": 0.9, "photo": 0.9},
                 "logo": null}""";
        WardrobeService.Draft d = service.analyze(user, syntheticTee(), "upper_piece");

        assertThat(d.draftId()).isNotNull();
        assertThat(d.rejection()).isNull();
        assertThat(d.prefill().category()).isEqualTo("upper_piece");
        assertThat(d.prefill().subcategory()).isEqualTo("t_shirt");
        assertThat(d.prefill().brand()).isEqualTo("Fashion AI");
        assertThat(d.prefill().brandSearch()).containsEntry("foundIn", "peito_esquerdo");
        assertThat(d.processedUrl()).startsWith("http://media/users/" + user.id() + "/drafts/" + d.draftId() + "/");
        assertThat(textCalls).extracting(AiEngine.TextCall::capability)
                .containsExactly(AiCapability.CONTENT_MODERATOR, AiCapability.PIECE_ANALYZER);
        InOrder order = inOrder(users, ai, jobs);
        order.verify(users).findById(user.id());
        order.verify(ai).execute(any(), any(), any(), any(), any(), any(), any());
        order.verify(ai, times(2)).text(any());
        order.verify(jobs).save(any());
        verify(jobs, times(1)).save(any());
    }

    @Test
    void recusaDaIaVemDepoisDasInferenciasEAntesDeGravarORascunho() throws Exception {
        analyzerAnswer = """
                {"matchesCategory": false, "detectedCategory": "shoes_piece", "subcategory": "t_shirt",
                 "photo": {"fullyVisible": true, "viewAngle": "frontal_90", "singlePiece": true},
                 "confidence": {"category": 0.92, "photo": 0.9}}""";
        assertThatThrownBy(() -> service.analyze(user, syntheticTee(), "upper_piece"))
                .isInstanceOf(PhotoRejectedException.class)
                .hasMessageContaining("Calçados");
        verify(ai, times(1)).execute(any(), any(), any(), any(), any(), any(), any());
        verify(ai, times(2)).text(any());
        verify(jobs, never()).save(any());
        // a recusa não desfaz a transação: o registro das inferências e a cota consumida ficam gravados
        for (var m : List.of(WardrobeService.class.getMethod("analyze", CurrentUser.class, byte[].class, String.class),
                WardrobeService.class.getMethod("analyzeForCapture", CurrentUser.class, byte[].class, String.class, boolean.class),
                WardrobeService.class.getMethod("analyzeBatch", CurrentUser.class, List.class, String.class))) {
            assertThat(m.getAnnotation(Transactional.class).noRollbackFor()).containsExactly(PhotoRejectedException.class);
        }
    }

    @Test
    void capturaLenienteDevolveOsCriteriosReprovadosEGravaORascunho() throws Exception {
        analyzerAnswer = """
                {"matchesCategory": true, "detectedCategory": "upper_piece", "subcategory": "t_shirt",
                 "photo": {"fullyVisible": false, "viewAngle": "angulo", "singlePiece": true},
                 "confidence": {"category": 0.95, "photo": 0.85}}""";
        assertThatThrownBy(() -> service.analyze(user, syntheticTee(), "upper_piece"))
                .isInstanceOf(PhotoRejectedException.class);
        verify(jobs, never()).save(any());

        WardrobeService.CaptureAnalysis c = service.analyzeForCapture(user, syntheticTee(), "upper_piece", true);

        assertThat(c.aiRan()).isTrue();
        assertThat(c.failedChecks()).extracting(br.com.fashionai.application.imaging.PhotoAcceptance.Check::id)
                .containsExactly("inteira_ia", "frontal_ia");
        assertThat(c.allChecks()).hasSizeGreaterThan(c.failedChecks().size());
        assertThat(c.draft().draftId()).isNotNull();
        assertThat(c.studioSource()).isNotNull();
        verify(jobs, times(1)).save(any());
    }
}
