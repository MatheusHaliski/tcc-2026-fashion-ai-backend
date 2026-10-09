package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.imaging.FlatLayPipeline;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.application.testkit.MultiPiecePhotoFixtures;
import br.com.fashionai.domain.model.PipelineJob;
import br.com.fashionai.domain.repository.PipelineJobRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * Várias peças numa foto (RF4): as regiões locais quando a visão externa está indisponível, o rascunho de cada peça pelo
 * mesmo Flat Lay e moderação do cadastro, a cópia por IA (indisponível sem provedor de edição de imagem) e o rascunho
 * só de quem enviou a foto.
 */
class MultiPieceServiceTest {
    private Kit kit;
    private World world;
    private MultiPieceService multi;
    private CurrentUser ana;
    private byte[] photo;

    @BeforeEach
    void setUp() throws Exception {
        kit = new Kit();
        world = new World(kit);
        when(kit.dep(Guard.class).deny(any(), any(), any())).thenAnswer(i -> new ApiException(403, "NEGADO", "negado"));
        MediaService media = kit.dep(MediaService.class);
        when(media.put(anyString(), any(), anyString())).thenAnswer(i -> new MediaStoragePort.StoredObject(i.getArgument(0), "/media/" + i.getArgument(0), 10, "image/png"));
        photo = png();
        when(media.read(anyString())).thenReturn(Optional.of(photo));
        kit.with(List.of());
        kit.with(new FlatLayPipeline(List.of(), List.of()));
        kit.real(WardrobeService.class);
        multi = kit.build(MultiPieceService.class);
        ana = Kit.as(world.me);
    }

    private static byte[] png() throws Exception {
        BufferedImage img = new BufferedImage(600, 800, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(new Color(240, 240, 240));
        g.fillRect(0, 0, 600, 800);
        g.setColor(new Color(30, 60, 140));
        g.fillRect(150, 100, 300, 350);
        g.setColor(new Color(20, 20, 20));
        g.fillRect(180, 460, 240, 300);
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        javax.imageio.ImageIO.write(img, "png", out);
        return out.toByteArray();
    }

    @Test
    void detectorFallbackPersistsFiveIndependentDraftSlotsOnUnevenBedding() {
        var detection = multi.detect(ana, ImageOps.png(MultiPiecePhotoFixtures.beddingWithFiveShirts()));
        assertThat(detection.source()).isEqualTo("local");
        assertThat(detection.pieces()).hasSize(5);
        assertThat(detection.pieces()).allSatisfy(piece -> {
            assertThat(piece.box().width()).isBetween(24.0, 30.0);
            assertThat(piece.box().height()).isBetween(36.0, 42.0);
            assertThat(piece.color()).isNotBlank();
            assertThat(piece.material()).isNull();
            assertThat(piece.brandName()).isNull();
        });
        PipelineJob draft = kit.dep(PipelineJobRepository.class).findById(detection.draftId()).orElseThrow();
        assertThat(Json.map(draft.getResultJson()).get("pieces")).asList().hasSize(5);
    }

    @Test
    void detectarECriarORascunhoDeCadaPeca() {
        MultiPieceService.Detection d = multi.detect(ana, photo);
        assertThat(d.pieces()).hasSize(2);
        assertThat(d.source()).isEqualTo("local");
        assertThat(d.originalUrl()).endsWith("original.png");
        PipelineJob parent = kit.dep(PipelineJobRepository.class).findById(d.draftId()).orElseThrow();
        assertThat(Json.map(parent.getResultJson())).containsKeys("pieces", "width", "height");

        MultiPieceService.PieceDraft draft = multi.pieceDraft(ana, d.draftId(), 0, photo);
        assertThat(draft.processedUrl()).endsWith("processed.png");
        assertThat(draft.thumbnailUrl()).endsWith("thumb.png");
        PipelineJob job = kit.dep(PipelineJobRepository.class).findById(draft.draftId()).orElseThrow();
        Map<String, Object> result = Json.map(job.getResultJson());
        assertThat(result).containsKeys("quality", "moderation", "prefill", "hash");
        assertThat(multi.pieceDraft(ana, d.draftId(), null, photo).draftId()).isNotNull();
    }

    @Test
    void rascunhoSoDeQuemEnviouAFoto() {
        MultiPieceService.Detection d = multi.detect(ana, photo);
        assertThatThrownBy(() -> multi.pieceDraft(Kit.as(world.rival), d.draftId(), 0, photo)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> multi.pieceDraft(ana, UUID.randomUUID(), 0, photo)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> multi.aiPieceDraft(ana, d.draftId(), UUID.randomUUID())).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> multi.detect(ana, new byte[]{1, 2, 3})).isInstanceOf(ApiException.class);
    }

    @Test
    void copiaPorIaSemProvedorDeImagemFicaIndisponivel() {
        MultiPieceService.Detection d = multi.detect(ana, photo);
        assertThatThrownBy(() -> multi.recreate(ana, d.draftId(), 0, photo, "Camisa azul", "upper_piece", "blue"))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getMessage()).isNotBlank());
        assertThat(MultiPieceService.recreatePrompt("Camisa", "upper_piece", "blue")).contains("Camisa");
        assertThat(MultiPieceService.recreatePrompt(null, null, null)).isNotBlank();
    }

    @Test
    void rascunhoComACopiaPorIaJaGerada() {
        MultiPieceService.Detection d = multi.detect(ana, photo);
        PipelineJob ai = new PipelineJob();
        ai.setUser(world.me);
        ai.setType(br.com.fashionai.domain.model.enums.PipelineJobType.FLAT_LAY_STANDARDIZATION);
        ai.setStatus(br.com.fashionai.domain.model.enums.PipelineJobStatus.COMPLETED);
        ai.setTargetType("AI_PIECE_IMAGE");
        ai.setInputJson(Json.write(Map.of("multiPieceDraftId", d.draftId().toString(), "index", 0)));
        ai.setResultJson(Json.write(Map.of("rawUrl", "/media/raw.png")));
        kit.dep(PipelineJobRepository.class).save(ai);
        MultiPieceService.PieceDraft draft = multi.aiPieceDraft(ana, d.draftId(), ai.getId());
        assertThat(draft.aiGenerated()).isTrue();
    }
}
