package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.assets.AssetCatalogService;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.imaging.FlatLayPipeline;
import br.com.fashionai.application.imaging.GarmentCrop;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.imaging.QualityMetrics;
import br.com.fashionai.application.imaging.StudioPipeline;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.Photo;
import br.com.fashionai.domain.model.PipelineJob;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AiCallResult;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.PhotoProcessingStatus;
import br.com.fashionai.domain.model.enums.PipelineJobStatus;
import br.com.fashionai.domain.model.enums.PipelineJobType;
import br.com.fashionai.domain.repository.PipelineJobRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.awt.image.BufferedImage;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** RF4 · Estúdio (versões e aprovação), RF18.CA05 remoção de fundo, RF4.CA06 reprocessamento, RF15.CA02 imagem editada e marca. */
class WardrobeServiceEstudioTest {
    Kit kit;
    World world;
    WardrobeService service;
    CurrentUser ana;
    MediaService media;
    AiEngine ai;
    StudioPipeline studio;
    FlatLayPipeline flatLay;
    byte[] png;

    static AiOutcome<Object> outcome(Object value) {
        return new AiOutcome<>(value, UUID.randomUUID(), AiCallResult.values()[0], false, "local", "m", 1, BigDecimal.ZERO, null, null, null);
    }

    static StudioPipeline.Result studioResult() {
        return new StudioPipeline.Result(new byte[]{1}, new byte[]{2}, new byte[]{3}, new byte[]{4}, StudioPipeline.BACKDROPS.get(0),
                List.of(), BigDecimal.ZERO, false, Map.of(), Map.of(), Map.of(), List.of(), new byte[]{5},
                Map.of("pipelineVersion", GarmentCrop.VERSION));
    }

    FlatLayPipeline.Result flat(boolean removed) {
        BufferedImage img = new BufferedImage(20, 20, BufferedImage.TYPE_INT_ARGB);
        return new FlatLayPipeline.Result(png, png, png, "image/png", 20, 20, null,
                new QualityMetrics.Report(Map.of("sharp", 1.0), 0.9, true, List.of(), List.of()), List.of(), BigDecimal.ZERO, 5, false,
                removed, Map.of("m", 1), img, img, Set.of());
    }

    @BeforeEach
    @SuppressWarnings({"unchecked", "rawtypes"})
    void setUp() {
        kit = new Kit();
        ai = mock(AiEngine.class);
        kit.with(ai);
        world = new World(kit);
        media = kit.dep(MediaService.class);
        studio = kit.dep(StudioPipeline.class);
        flatLay = kit.dep(FlatLayPipeline.class);
        when(ai.execute(any(), any(), any(), any(), any(), any(), any())).thenAnswer(i -> outcome(((Supplier<?>) i.getArgument(6)).get()));
        when(studio.run(any(), anyString(), anyBoolean(), any())).thenReturn(studioResult());
        when(media.put(anyString(), any(), anyString())).thenAnswer(i -> new MediaStoragePort.StoredObject(i.getArgument(0), "/media/" + i.getArgument(0), 1, i.getArgument(2)));
        when(media.register(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(new Photo());
        when(kit.dep(Guard.class).deny(any(), anyString(), anyString())).thenAnswer(i -> new ApiException(403, "PROIBIDO", i.getArgument(2)));
        BufferedImage img = new BufferedImage(60, 80, BufferedImage.TYPE_INT_ARGB);
        for (int y = 10; y < 70; y++) {
            for (int x = 10; x < 50; x++) {
                img.setRGB(x, y, 0xFF3366AA);
            }
        }
        png = ImageOps.png(img);
        when(media.read(anyString())).thenReturn(Optional.of(png));
        service = kit.build(WardrobeService.class);
        ana = Kit.as(world.me);
    }

    WardrobeItem photoPiece() {
        WardrobeItem w = world.piece(world.me, "t_shirt");
        w.setPhotoProcessingStatus(PhotoProcessingStatus.COMPLETED);
        return w;
    }

    @Test
    void estudioNovoComAprovadaNoArFicaPendenteAteAprovar() {
        WardrobeItem w = photoPiece();
        w.setStudioImageUrl("/velha.jpg");          // legado: aprovada sem resumo
        service.studioPiece(ana, w.getId(), null);
        assertThat(w.getStudioImageUrl()).isEqualTo("/velha.jpg");
        assertThat(w.getFlatLayMetadataJson()).contains("pending");
        // outra rodada troca a pendente (apaga os arquivos dela, mesmo se um falhar)
        doThrow(new RuntimeException("storage")).when(media).deleteUrl(org.mockito.ArgumentMatchers.contains(".thumb"));
        service.studioPiece(ana, w.getId(), "white");
        verify(media, org.mockito.Mockito.atLeastOnce()).deleteUrl(anyString());
        service.approveStudio(ana, w.getId());
        assertThat(w.getStudioImageUrl()).startsWith("/media/users/");
        assertThat(w.getFlatLayMetadataJson()).contains("previous").contains("/velha.jpg");
        assertThatThrownBy(() -> service.discardStudio(ana, w.getId())).isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).code()).isEqualTo("NADA_A_DESCARTAR"));
        assertThatThrownBy(() -> service.approveStudio(ana, w.getId())).isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).code()).isEqualTo("NADA_A_APROVAR"));
        service.studioPiece(ana, w.getId(), null);
        service.discardStudio(ana, w.getId());
        assertThat(w.getFlatLayMetadataJson()).doesNotContain("pending");
    }

    @Test
    void primeiraFotoDeEstudioEntraNoArAguardandoAprovacao() {
        WardrobeItem w = photoPiece();
        w.setFlatLayMetadataJson("{\"studio_source_url\":\"/fonte.png\",\"detected\":{\"logo\":{\"box\":[0.1,0.1,0.2,0.2]}}}");
        service.studioPiece(ana, w.getId(), null);
        assertThat(w.getStudioImageUrl()).isNotNull();
        assertThat(w.getFlatLayMetadataJson()).contains("\"approved\":false");
        verify(media).read("/fonte.png");
        service.approveStudio(ana, w.getId());
        assertThat(w.getFlatLayMetadataJson()).contains("\"approved\":true").contains("approvedAt");
    }

    @Test
    void estudioDaPecaExigeRecorteEFonte() {
        WardrobeItem padrao = world.piece(world.me, "jeans");
        padrao.setDefaultImage(true);
        assertThatThrownBy(() -> service.studioPiece(ana, padrao.getId(), null)).isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).status()).isEqualTo(422));
        WardrobeItem w = photoPiece();
        when(media.read(anyString())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.studioPiece(ana, w.getId(), null)).isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).status()).isEqualTo(404));
        when(media.read(anyString())).thenReturn(Optional.of(png));
        when(studio.run(any(), anyString(), anyBoolean(), any())).thenThrow(new IllegalStateException("fora"));
        assertThatThrownBy(() -> service.studioPiece(ana, w.getId(), null)).isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).status()).isEqualTo(503));
    }

    @Test
    void ofertaDeEstudioSemResultado() {
        WardrobeItem w = photoPiece();
        w.setStudioImageUrl("/s.jpg");
        assertThat(service.offerStudio(w, null, false)).isEqualTo("failed");
        assertThat(w.getStudioImageUrl()).isEqualTo("/s.jpg");
        assertThat(service.offerStudio(w, null, true)).isEqualTo("failed");
        assertThat(w.getStudioImageUrl()).isNull();
        assertThat(service.offerStudio(w, Map.of("url", "/n.jpg", "backdrop", "white"), true)).isEqualTo("applied");
        assertThat(w.getStudioImageUrl()).isEqualTo("/n.jpg");
        assertThat(service.offerStudio(w, Map.of("url", "/m.jpg", "backdrop", "white"), true)).isEqualTo("applied");
        assertThat(w.getFlatLayMetadataJson()).contains("previous");
    }

    @Test
    void estudioDoRascunho() {
        PipelineJob d = new PipelineJob();
        d.setUser(world.me);
        d.setResultJson("{\"backgroundRemoved\":false,\"backgroundWarning\":\"fundo parecido\",\"processedUrl\":\"/p.png\"}");
        d = kit.dep(PipelineJobRepository.class).save(d);
        UUID id = d.getId();
        assertThatThrownBy(() -> service.studioDraft(ana, id, null, false)).isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).code()).isEqualTo("SEM_RECORTE"));
        Map<String, Object> info = service.studioDraft(ana, id, "white", true);
        assertThat(info).containsEntry("forced", true).containsKey("url");
        assertThat(d.getResultJson()).contains("\"studio\"");

        d.setResultJson("{\"backgroundRemoved\":false}");
        assertThatThrownBy(() -> service.studioDraft(ana, id, null, false)).isInstanceOf(ApiException.class);
        d.setResultJson("{\"backgroundRemoved\":true,\"studioSourceUrl\":\"/ss.png\",\"prefill\":{\"category\":\"upper_piece\",\"subcategory\":\"t_shirt\"},"
                + "\"flatLayMetadata\":{\"truncated_sides\":[\"top\"]}}");
        assertThat(service.studioDraft(ana, id, null, false)).doesNotContainKey("forced");
        assertThatThrownBy(() -> service.studioDraft(Kit.as(world.rival), id, null, true)).isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).status()).isEqualTo(403));
        when(studio.run(any(), anyString(), anyBoolean(), any())).thenThrow(new IllegalStateException("fora"));
        assertThatThrownBy(() -> service.studioDraft(ana, id, null, true)).isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).status()).isEqualTo(503));
        when(media.read(anyString())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.studioDraft(ana, id, null, true)).isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).status()).isEqualTo(404));
        assertThatThrownBy(() -> service.studioDraft(ana, UUID.randomUUID(), null, true)).isInstanceOf(ApiException.class);
    }

    @Test
    void estudioEmTodasAsPecas() {
        List<WardrobeItem> mine = world.piecesOf(world.me);
        mine.get(0).setPhotoProcessingStatus(PhotoProcessingStatus.COMPLETED);
        mine.get(1).setPhotoProcessingStatus(PhotoProcessingStatus.COMPLETED);
        mine.get(1).setStudioImageUrl("/ja.jpg");
        mine.get(2).setPhotoProcessingStatus(PhotoProcessingStatus.COMPLETED);
        mine.get(2).setAvailabilityStatus(AvailabilityStatus.ARCHIVED);
        mine.get(3).setPhotoProcessingStatus(PhotoProcessingStatus.COMPLETED);
        mine.get(3).setDefaultImage(true);         // imagem padrão sem arquivo: pula
        Map<String, Object> r = service.studioAll(ana, null);
        assertThat(r).containsEntry("generated", 1).containsEntry("skipped", 11);
        assertThat(mine.get(0).getStudioImageUrl()).isNotNull();
    }

    @Test
    void imagemPadraoReaproveitaOEstudioJaFeito() {
        WardrobeItem pronta = world.piece(world.rival, "t_shirt");
        pronta.setImageUrl("/assets_pecas/camiseta.png");
        pronta.setDefaultImage(true);
        pronta.setStudioImageUrl("/estudio/camiseta.jpg");
        pronta.setFlatLayMetadataJson("{\"studio\":{\"feed\":{\"pipelineVersion\":\"" + GarmentCrop.VERSION + "\"}}}");
        WardrobeItem w = world.piece(world.me, "t_shirt");
        w.setImageUrl("/assets_pecas/camiseta.png");
        w.setDefaultImage(true);
        service.defaultStudio(w);
        assertThat(w.getStudioImageUrl()).isEqualTo("/estudio/camiseta.jpg");
        assertThat(w.getFlatLayMetadataJson()).contains("pipelineVersion");

        WardrobeItem semArquivo = world.piece(world.me, "jeans");
        semArquivo.setDefaultImage(true);
        when(kit.dep(AssetCatalogService.class).publicFile(any())).thenReturn(Optional.empty());
        service.defaultStudio(semArquivo);
        assertThat(semArquivo.getStudioImageUrl()).isNull();
        WardrobeItem comFoto = world.piece(world.me, "hoodie");
        service.defaultStudio(comFoto);
        assertThat(comFoto.getStudioImageUrl()).isNull();
        service.backfillDefaultStudio();
    }

    @Test
    void imagemPadraoGeraEstudioDoArquivo(@org.junit.jupiter.api.io.TempDir java.nio.file.Path dir) throws Exception {
        java.nio.file.Path f = dir.resolve("camisa.png");
        java.nio.file.Files.write(f, png);
        when(kit.dep(AssetCatalogService.class).publicFile("/assets_pecas/camisa.png")).thenReturn(Optional.of(f));
        WardrobeItem w = world.piece(world.me, "shirt");
        w.setImageUrl("/assets_pecas/camisa.png");
        w.setDefaultImage(true);
        service.defaultStudio(w);
        assertThat(w.getStudioImageUrl()).contains("defaults/studio/camisa/");
        assertThat(w.getFlatLayMetadataJson()).contains("\"approved\":true");
    }

    @Test
    void remocaoDeFundoSobDemanda() {
        WardrobeItem w = photoPiece();
        w.setStudioImageUrl("/s.jpg");
        when(flatLay.run(any(), eq(false))).thenReturn(flat(false));
        assertThat(service.removeBackground(ana, w.getId())).containsEntry("ok", false);
        when(flatLay.run(any(), eq(false))).thenReturn(flat(true));
        w.setFlatLayMetadataJson("{\"detected\":{\"x\":1},\"studio\":{\"url\":\"/s.jpg\"}}");
        Map<String, Object> ok = service.removeBackground(ana, w.getId());
        assertThat(ok).containsEntry("ok", true);
        assertThat(w.getImageUrl()).contains("/processed-");
        assertThat(w.getFlatLayMetadataJson()).contains("studio_source_url").contains("pending");
        when(media.read(anyString())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.removeBackground(ana, w.getId())).isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).status()).isEqualTo(422));
    }

    @Test
    void etapaRemotaDoFlatLay() throws Exception {
        when(flatLay.externalAvailable()).thenReturn(true);
        when(flatLay.run(any(), eq(true))).thenReturn(flat(true));
        var step = service.flatLayStep(png);
        assertThat(step.provider()).contains("rembg");
        assertThat(step.model()).isEqualTo("flat-lay-hybrid");
        assertThat(step.available()).isTrue();
        assertThat(step.call().value().backgroundRemoved()).isTrue();
        when(flatLay.run(any(), eq(false))).thenReturn(flat(false));
        assertThat(service.governedFlatLay(world.me.getId(), png).backgroundRemoved()).isFalse();
    }

    PipelineJob job(PipelineJobType type, UUID piece) {
        PipelineJob j = new PipelineJob();
        j.setUser(world.me);
        j.setType(type);
        j.setStatus(PipelineJobStatus.PENDING);
        j.setInputResourceId(piece);
        return kit.dep(PipelineJobRepository.class).save(j);
    }

    @Test
    @SuppressWarnings("unchecked")
    void reprocessamentoDasFotosPendentes() {
        WardrobeItem w = photoPiece();
        w.setOriginalImageUrl("/o.jpg");
        PipelineJob outro = job(PipelineJobType.values()[0] == PipelineJobType.FLAT_LAY_STANDARDIZATION ? PipelineJobType.values()[1] : PipelineJobType.values()[0], w.getId());
        PipelineJob semPeca = job(PipelineJobType.FLAT_LAY_STANDARDIZATION, null);
        PipelineJob sumiu = job(PipelineJobType.FLAT_LAY_STANDARDIZATION, UUID.randomUUID());
        PipelineJob bom = job(PipelineJobType.FLAT_LAY_STANDARDIZATION, w.getId());
        // sem provedor: espera
        assertThat(service.reprocessPending()).isZero();
        assertThat(bom.getStatus()).isEqualTo(PipelineJobStatus.PENDING);
        when(flatLay.externalAvailable()).thenReturn(true);
        when(ai.remoteAllowed(any(), any())).thenReturn(true);
        // remoto sem resposta: segue pendente
        assertThat(service.reprocessPending()).isZero();
        assertThat(bom.getStatus()).isEqualTo(PipelineJobStatus.PENDING);
        assertThat(bom.getAttempts()).isEqualTo(1);
        // resposta com recorte
        org.mockito.Mockito.doAnswer(i -> outcome(i.getArgument(1) == br.com.fashionai.application.ai.AiCapability.FLAT_LAY_STANDARDIZER
                ? flat(true) : ((Supplier<?>) i.getArgument(6)).get())).when(ai).execute(any(), any(), any(), any(), any(), any(), any());
        assertThat(service.reprocessPending()).isEqualTo(1);
        assertThat(bom.getStatus()).isEqualTo(PipelineJobStatus.COMPLETED);
        assertThat(w.getImageUrl()).contains("reprocessed");
        assertThat(w.getStudioImageUrl()).isNotNull();
        verify(kit.dep(NotificationService.class)).notify(eq(world.me.getId()), any(), any(), eq("PIECE"), eq(w.getId()), any(), any(), any());
        assertThat(outro.getStatus()).isEqualTo(PipelineJobStatus.PENDING);
        assertThat(semPeca.getAttempts()).isZero();
        assertThat(sumiu.getAttempts()).isZero();

        // falha na chamada: 3ª tentativa reprova
        PipelineJob falha = job(PipelineJobType.FLAT_LAY_STANDARDIZATION, w.getId());
        falha.setAttempts(2);
        doThrow(new IllegalStateException("caiu")).when(ai).execute(any(), any(), any(), any(), any(), any(), any());
        service.reprocessPending();
        assertThat(falha.getStatus()).isEqualTo(PipelineJobStatus.FAILED);
        assertThat(falha.getErrorMessage()).isEqualTo("caiu");
        // sem a original
        PipelineJob semOriginal = job(PipelineJobType.FLAT_LAY_STANDARDIZATION, w.getId());
        when(media.read("/o.jpg")).thenReturn(Optional.empty());
        service.reprocessPending();
        assertThat(semOriginal.getStatus()).isEqualTo(PipelineJobStatus.FAILED);
        assertThat(semOriginal.getErrorCode()).isEqualTo("SEM_ORIGINAL");
    }

    @Test
    void imagemEditadaNoCanvas() {
        WardrobeItem w = photoPiece();
        w.setStudioImageUrl("/s.jpg");
        w.setAiGeneratedImage(true);
        w.setFlatLayMetadataJson("{\"studio_source_url\":\"/velha.png\"}");
        service.replaceImage(ana, w.getId(), png, null);          // recorte com transparência: refaz o estúdio
        assertThat(w.getImageUrl()).contains("/edit-");
        assertThat(w.isAiGeneratedImage()).isFalse();
        assertThat(w.getFlatLayMetadataJson()).doesNotContain("velha");
        assertThat(w.getStudioImageUrl()).isNotEqualTo("/s.jpg");

        BufferedImage opaca = new BufferedImage(30, 30, BufferedImage.TYPE_INT_RGB);
        w.setAiGeneratedImage(true);
        UUID origem = UUID.randomUUID();
        service.replaceImage(ana, w.getId(), ImageOps.png(opaca), origem);  // opaca: sai do estúdio
        assertThat(w.getStudioImageUrl()).isNull();
        assertThat(w.isAiGeneratedImage()).isTrue();
    }

    @Test
    @SuppressWarnings("unchecked")
    void novaLeituraDaMarcaPelaIa() {
        PipelineJob d = new PipelineJob();
        d.setUser(world.me);
        d.setResultJson("{\"processedUrl\":\"/p.png\",\"prefill\":{\"brandSearch\":{\"suggestion\":\"X\"}}}");
        d = kit.dep(PipelineJobRepository.class).save(d);
        UUID id = d.getId();
        when(ai.text(any())).thenAnswer(i -> outcome(Map.of("brand", "Nike", "image", 2, "confidence", 0.9, "text", "NIKE")));
        Map<String, Object> r = service.retryBrand(ana, id, 9);
        assertThat(r).containsEntry("grid", 5).containsEntry("source", "ia").containsEntry("brand", "Nike")
                .containsEntry("certainty", "confirmada").containsKey("regionUrl");
        assertThat(d.getResultJson()).contains("\"brand\":\"Nike\"").contains("logo");

        when(ai.text(any())).thenAnswer(i -> outcome(Map.of("brand", "Puma")));
        assertThat(service.retryBrand(ana, id, 1)).containsEntry("grid", 3).containsEntry("brand", "Puma");
        when(ai.text(any())).thenAnswer(i -> outcome(null));
        assertThat(service.retryBrand(ana, id, 4)).containsEntry("source", null).doesNotContainKey("brand");
        assertThatThrownBy(() -> service.retryBrand(Kit.as(world.rival), id, 3)).isInstanceOf(ApiException.class);
        when(media.read(anyString())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.retryBrand(ana, id, 3)).isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).status()).isEqualTo(404));
    }

    @Test
    void marcaPeloOcrLocal() {
        var reader = mock(br.com.fashionai.application.imaging.BrandReader.class);
        when(reader.available()).thenReturn(true);
        when(reader.find(any(), any())).thenReturn(Optional.of(new br.com.fashionai.application.imaging.BrandReader.Found(
                "Adidas", "logo_q1", "ADIDAS", 0.6, false, new double[]{0.1, 0.1, 0.3, 0.3})));
        service.setBrandReader(reader);
        PipelineJob d = new PipelineJob();
        d.setUser(world.me);
        d.setResultJson("{\"processedUrl\":\"/p.png\",\"prefill\":{\"logo\":{\"box\":[0.1,0.1,0.3,0.3]}}}");
        d = kit.dep(PipelineJobRepository.class).save(d);
        when(ai.text(any())).thenAnswer(i -> outcome(null));
        Map<String, Object> r = service.retryBrand(ana, d.getId(), 3);
        assertThat(r).containsEntry("source", "ocr").containsEntry("certainty", "possivel").containsEntry("ocrAvailable", true);
        assertThat(d.getResultJson()).contains("suggestion");
    }
}
