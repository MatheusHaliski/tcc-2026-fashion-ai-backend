package br.com.fashionai.application.service;

import br.com.fashionai.application.assets.AssetCatalogService;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.ports.JobQueuePort;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Brand;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.ModerationQueueItem;
import br.com.fashionai.domain.model.Photo;
import br.com.fashionai.domain.model.PipelineJob;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.ImageOrigin;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.PhotoProcessingStatus;
import br.com.fashionai.domain.model.enums.PipelineJobStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.BrandRepository;
import br.com.fashionai.domain.repository.ModerationQueueRepository;
import br.com.fashionai.domain.repository.PipelineJobRepository;
import br.com.fashionai.domain.repository.ProcessingJobLogRepository;
import br.com.fashionai.domain.repository.QualityScoreRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** RF4 salvar peça (formulário, catálogo, rascunho da foto), RF9.CA07 edição, marca, RF31 estados e RF6.CA05 exclusão. */
class WardrobeServiceCadastroTest {
    Kit kit;
    World world;
    WardrobeService service;
    CurrentUser ana;
    MediaService media;
    ApplicationEventPublisher events;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        world = new World(kit);
        media = kit.dep(MediaService.class);
        when(media.put(anyString(), any(), anyString())).thenAnswer(i -> new MediaStoragePort.StoredObject(i.getArgument(0), "/media/" + i.getArgument(0), 1, i.getArgument(2)));
        when(media.register(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(new Photo());
        when(kit.dep(AssetCatalogService.class).defaultPieceImage(any(), any())).thenReturn("/assets_pecas/padrao.png");
        when(kit.dep(Guard.class).deny(any(), anyString(), anyString())).thenAnswer(i -> new ApiException(403, "PROIBIDO", i.getArgument(2)));
        events = kit.dep(ApplicationEventPublisher.class);
        service = kit.build(WardrobeService.class);
        ana = Kit.as(world.me);
    }

    static WardrobeService.PieceForm form(UUID draftId, boolean useDefault, String name, BigDecimal price, List<String> seals, String market,
                                          UUID brandId, String brandName, String logo, String source, Visibility vis, UUID session) {
        return new WardrobeService.PieceForm(draftId, useDefault, name, "upper_piece", "t_shirt", "UNISSEX", brandId, brandName, "white", "COTTON",
                "m", market, List.of("casual"), List.of("basic"), seals, price, vis, List.of("verão"), "nota", null, null, "Loja", "SKU1", "lavar",
                true, null, logo, source, "ref", Map.of(), session, null, null, null);
    }

    static WardrobeService.PieceForm simple(String brandName) {
        return form(null, true, "Camiseta", BigDecimal.TEN, null, null, null, brandName, null, null, null, null);
    }

    @Test
    void cadastroComImagemPadrao() {
        Views.PieceView v = service.create(ana, simple("Marca Livre"));
        assertThat(v.name()).isEqualTo("Camiseta");
        WardrobeItem w = service.owned(ana, v.id());
        assertThat(w.isDefaultImage()).isTrue();
        assertThat(w.getImageUrl()).isEqualTo("/assets_pecas/padrao.png");
        assertThat(w.getModerationStatus()).isEqualTo(ModerationStatus.APPROVED);
        assertThat(w.getVisibility()).isEqualTo(Visibility.PRIVATE);
        assertThat(w.getBrandSource()).isEqualTo("TEXTO_LIVRE");
        assertThat(w.isForSale()).isTrue();
        verify(events).publishEvent(any(DomainEvents.PieceCreated.class));
        verify(kit.dep(NotificationService.class)).notify(eq(world.me.getId()), any(), any(), eq("PIECE"), eq(w.getId()), any(), any(), any());
    }

    @Test
    void cadastroSemFotoNemImagemPadraoERecusado() {
        var f = form(null, false, "Camiseta", BigDecimal.TEN, null, null, null, null, null, null, Visibility.PUBLIC, null);
        assertThatThrownBy(() -> service.create(ana, f)).isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).code()).isEqualTo("FOTO_OBRIGATORIA"));
    }

    @Test
    void formularioInvalidoVoltaComTodosOsCampos() {
        var f = form(null, true, " ", new BigDecimal("-1"), List.of("a", "b", "c"), "lua_cheia", null, null, null, null, null, null);
        assertThatThrownBy(() -> service.create(ana, f)).isInstanceOf(ApiException.class).satisfies(e -> {
            ApiException a = (ApiException) e;
            assertThat(a.code()).isEqualTo("FORMULARIO_INVALIDO");
            assertThat(a.details()).containsKeys("name", "price", "seals", "market");
        });
        var semPreco = form(null, true, "Ok", null, null, null, null, null, null, null, null, null);
        assertThatThrownBy(() -> service.create(ana, semPreco)).isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).details()).containsKey("price"));
    }

    @Test
    void cadastroPeloCatalogoUsaAFotoOficial() {
        UUID product = UUID.randomUUID();
        var pick = new WardrobeService.CatalogPick(product, null, "/catalogo/p.jpg", "/catalogo/p-thumb.jpg", Map.of("crop", 1));
        Views.PieceView v = service.createFromCatalog(ana, simple(null), pick);
        WardrobeItem w = service.owned(ana, v.id());
        assertThat(w.getCatalogProductId()).isEqualTo(product);
        assertThat(w.getImageUrl()).isEqualTo("/catalogo/p.jpg");
        assertThat(w.getThumbnailUrl()).isEqualTo("/catalogo/p-thumb.jpg");
        assertThat(w.getImageOrigin()).isEqualTo(ImageOrigin.CATALOG);
        assertThat(w.getFlatLayMetadataJson()).contains("catalogImage");
        assertThat(w.getBrandName()).isNull();

        // produto sem foto: imagem padrão
        Views.PieceView semFoto = service.createFromCatalog(ana, simple(null), new WardrobeService.CatalogPick(product, null, " "));
        WardrobeItem w2 = service.owned(ana, semFoto.id());
        assertThat(w2.isDefaultImage()).isTrue();
        assertThat(w2.getImageOrigin()).isEqualTo(ImageOrigin.DEFAULT);
        assertThat(w2.getImageUrl()).isEqualTo("/assets_pecas/padrao.png");
        // foto sem miniatura: a própria foto
        Views.PieceView semThumb = service.createFromCatalog(ana, simple(null), new WardrobeService.CatalogPick(product, null, "/c.jpg"));
        assertThat(service.owned(ana, semThumb.id()).getThumbnailUrl()).isEqualTo("/c.jpg");
    }

    PipelineJob draft(String resultJson) {
        PipelineJob j = new PipelineJob();
        j.setUser(world.me);
        j.setResultJson(resultJson);
        j = kit.dep(PipelineJobRepository.class).save(j);
        PipelineJob saved = j;
        when(kit.dep(PipelineJobRepository.class).findByIdForUpdate(saved.getId())).thenReturn(Optional.of(saved));
        return saved;
    }

    @Test
    void cadastroPeloRascunhoPendenteVaiParaModeracaoEReprocessamento() {
        PipelineJob d = draft("""
                {"moderation":{"status":"PENDING","confidence":0.5,"reasons":["duvida"]},"backgroundRemoved":false,
                 "processedUrl":"/p.png","originalUrl":"/o.jpg","thumbnailUrl":"/t.png","originalKey":"k","mime":"image/jpeg",
                 "quality":{"overall":0.8,"accepted":true,"metrics":{}},"prefill":{"variation":"X"},"studioSourceUrl":"/ss.png",
                 "bytes":100,"width":10,"height":12,"hash":"h","flatLayMetadata":{"a":1}}""");
        when(media.read("/o.jpg")).thenReturn(Optional.of(new byte[]{1, 2, 3}));
        UUID session = UUID.randomUUID();
        Views.PieceView v = service.create(ana, form(d.getId(), false, "Camiseta", BigDecimal.TEN, null, null, null, null, null, null, null, session));
        WardrobeItem w = service.owned(ana, v.id());
        assertThat(w.getImageUrl()).isEqualTo("/o.jpg");
        assertThat(w.getPhotoProcessingStatus()).isEqualTo(PhotoProcessingStatus.PROCESSING);
        assertThat(w.getModerationStatus()).isEqualTo(ModerationStatus.PENDING);
        assertThat(w.getImageFileSize()).isEqualTo(100L);
        assertThat(w.getFlatLayMetadataJson()).contains("detected").contains("studio_source_url");
        assertThat(w.getCaptureSessionId()).isEqualTo(session);
        assertThat(MemoryRepository.<ModerationQueueItem>rows(kit.dep(ModerationQueueRepository.class))).hasSize(1);
        assertThat(MemoryRepository.<Object>rows(kit.dep(QualityScoreRepository.class))).hasSize(1);
        assertThat(MemoryRepository.<Object>rows(kit.dep(ProcessingJobLogRepository.class))).hasSize(1);
        verify(kit.dep(JobQueuePort.class)).enqueue(eq("flatlay-reprocess"), any());
        verify(media).register(any(), any(), eq(w.getId()), any(), eq("/o.jpg"), eq("/t.png"), any(), eq(10), eq(12), any(), any(), any());
        verify(events).publishEvent(any(DomainEvents.PieceCapturedFromSession.class));
        assertThat(d.getTargetType()).isEqualTo("PIECE");

        // segundo envio do mesmo rascunho devolve a mesma peça
        Views.PieceView again = service.create(ana, form(d.getId(), false, "Camiseta", BigDecimal.TEN, null, null, null, null, null, null, null, null));
        assertThat(again.id()).isEqualTo(v.id());
    }

    @Test
    void cadastroPeloRascunhoAprovadoComEstudio() {
        PipelineJob d = draft("""
                {"moderation":{"status":"APPROVED"},"backgroundRemoved":true,"processedUrl":"/p.png","originalUrl":"/o.jpg",
                 "thumbnailUrl":"/t.png","aiGenerated":true,"studio":{"url":"/s.jpg","backdrop":"white","detailUrl":"/d.jpg"}}""");
        Views.PieceView v = service.create(ana, form(d.getId(), false, "Camiseta", BigDecimal.TEN, null, null, null, null, null, null, Visibility.PUBLIC, null));
        WardrobeItem w = service.owned(ana, v.id());
        assertThat(w.getImageUrl()).isEqualTo("/p.png");
        assertThat(w.getStudioImageUrl()).isEqualTo("/s.jpg");
        assertThat(w.getStudioBackdrop()).isEqualTo("white");
        assertThat(w.getStudioDetailUrl()).isEqualTo("/d.jpg");
        assertThat(w.isAiGeneratedImage()).isTrue();
        assertThat(w.getPhotoProcessingStatus()).isEqualTo(PhotoProcessingStatus.COMPLETED);
        assertThat(w.getFlatLayMetadataJson()).contains("\"approved\":true");
        assertThat(w.getVisibility()).isEqualTo(Visibility.PUBLIC);
        verify(kit.dep(JobQueuePort.class), never()).enqueue(anyString(), any());
        assertThat(MemoryRepository.<ModerationQueueItem>rows(kit.dep(ModerationQueueRepository.class))).isEmpty();
    }

    @Test
    void recorteForcadoValeComoRecorteEEstudioRecusadoFicaDeFora() {
        PipelineJob d = draft("""
                {"moderation":{"status":"APPROVED"},"backgroundRemoved":false,"processedUrl":"/p.png","originalUrl":"/o.jpg",
                 "studio":{"url":"/s.jpg","forced":true}}""");
        var f = new WardrobeService.PieceForm(d.getId(), false, "Camiseta", "upper_piece", "t_shirt", "UNISSEX", null, null, "white", "COTTON",
                "m", null, List.of("casual"), List.of("basic"), null, BigDecimal.TEN, null, null, null, null, null, null, null, null,
                null, false, null, null, null, null);
        WardrobeItem w = service.owned(ana, service.create(ana, f).id());
        assertThat(w.getImageUrl()).isEqualTo("/o.jpg");
        assertThat(w.getStudioImageUrl()).isNull();
        verify(kit.dep(JobQueuePort.class)).enqueue(anyString(), any());

        PipelineJob forcado = draft("""
                {"moderation":{"status":"APPROVED"},"backgroundRemoved":false,"processedUrl":"/p.png","originalUrl":"/o.jpg",
                 "studio":{"url":"/s.jpg","forced":true}}""");
        WardrobeItem w2 = service.owned(ana, service.create(ana, form(forcado.getId(), false, "C", BigDecimal.ONE, null, null, null, null, null, null, null, null)).id());
        assertThat(w2.getImageUrl()).isEqualTo("/p.png");
        assertThat(w2.getStudioImageUrl()).isEqualTo("/s.jpg");
    }

    @Test
    void rascunhoBloqueadoOuDeOutraPessoa() {
        PipelineJob bloqueado = draft("{\"moderation\":{\"status\":\"REJECTED_POLICY\"}}");
        assertThatThrownBy(() -> service.create(ana, form(bloqueado.getId(), false, "C", BigDecimal.ONE, null, null, null, null, null, null, null, null)))
                .isInstanceOf(ApiException.class).satisfies(e -> assertThat(((ApiException) e).code()).isEqualTo("CONTEUDO_BLOQUEADO"));
        PipelineJob alheio = draft("{}");
        alheio.setUser(world.rival);
        assertThatThrownBy(() -> service.create(ana, form(alheio.getId(), false, "C", BigDecimal.ONE, null, null, null, null, null, null, null, null)))
                .isInstanceOf(ApiException.class).satisfies(e -> assertThat(((ApiException) e).status()).isEqualTo(403));
    }

    @Test
    void cadastroEmLote() {
        List<Views.PieceView> out = service.createBatch(ana, List.of(simple(null), simple("Sem marca")));
        assertThat(out).hasSize(2);
        assertThat(service.owned(ana, out.get(1).id()).getBrandName()).isNull();
    }

    @Test
    void marcaPeloCadastroDaPlataforma() {
        Brand b = new Brand();
        b.setName("Hering");
        b.setSlug("hering");
        b = kit.dep(BrandRepository.class).save(b);
        WardrobeItem w = world.piece(world.me, "t_shirt");
        service.update(ana, w.getId(), form(null, true, "Camiseta", BigDecimal.TEN, null, null, b.getId(), null, null, null, Visibility.PRIVATE, null));
        assertThat(w.getBrandName()).isEqualTo("Hering");
        assertThat(w.getBrandSource()).isEqualTo("PLATAFORMA");
        assertThat(w.getBrandRef()).isEqualTo(b.getId().toString());
        assertThat(w.getVisibility()).isEqualTo(Visibility.PRIVATE);
        verify(events).publishEvent(any(DomainEvents.PieceUpdated.class));
        UUID semMarca = UUID.randomUUID();
        assertThatThrownBy(() -> service.update(ana, w.getId(), form(null, true, "C", BigDecimal.TEN, null, null, semMarca, null, null, null, null, null)))
                .isInstanceOf(ApiException.class).satisfies(e -> assertThat(((ApiException) e).code()).isEqualTo("MARCA_INVALIDA"));
    }

    @Test
    void marcaComPerfilAprovadoLigaAoPerfil() {
        BrandProfile bp = new BrandProfile();
        bp.setBrandName("Osklen Oficial");
        bp.setNomeFantasia("Osklen");
        bp.setSlug("osklen");
        bp.setApprovalStatus(ApprovalStatus.APROVADO);
        kit.dep(BrandProfileRepository.class).save(bp);
        WardrobeItem w = world.piece(world.me, "t_shirt");
        service.update(ana, w.getId(), simple("osklen"));
        assertThat(w.getBrandProfile()).isSameAs(bp);
        assertThat(w.getBrandSource()).isEqualTo("PLATAFORMA");
        assertThat(w.getBrandRef()).isEqualTo("osklen");
    }

    @Test
    void marcaComLogoDaWeb() {
        OwnMedia own = kit.dep(OwnMedia.class);
        when(own.accepts(any(), eq("/media/logo.png"), anyBoolean())).thenReturn(true);
        when(media.read("/media/logo.png")).thenReturn(Optional.of(new byte[]{1}));
        WardrobeItem w = world.piece(world.me, "t_shirt");
        service.update(ana, w.getId(), form(null, true, "Camiseta", BigDecimal.TEN, null, null, null, "Farm", " /media/logo.png ", " wikidata ", null, null));
        assertThat(w.getBrandLogoUrl()).isEqualTo("/media/logo.png");
        assertThat(w.getBrandSource()).isEqualTo("WIKIDATA");
        assertThat(w.getBrandRef()).isEqualTo("ref");
        verify(kit.dep(BrandLogoService.class)).acceptWebLogo("Farm", "/media/logo.png", "WIKIDATA", null, "ref");

        // fonte desconhecida vira WEB
        service.update(ana, w.getId(), form(null, true, "Camiseta", BigDecimal.TEN, null, null, null, "Farm", "/media/logo.png", "outra", null, null));
        assertThat(w.getBrandSource()).isEqualTo("WEB");
        // edição sem mexer na marca mantém logo e fonte
        service.update(ana, w.getId(), form(null, true, "Camiseta", BigDecimal.TEN, null, null, null, "Farm", null, null, null, null));
        assertThat(w.getBrandLogoUrl()).isEqualTo("/media/logo.png");
        assertThat(w.getBrandSource()).isEqualTo("WEB");
        // tirar a marca limpa tudo
        service.update(ana, w.getId(), simple(" "));
        assertThat(w.getBrandLogoUrl()).isNull();
        assertThat(w.getBrandSource()).isNull();
    }

    @Test
    void estadosDaPeca() {
        WardrobeItem w = world.piece(world.me, "jeans");
        w.setDisponivel(true);
        service.toggles(ana, w.getId(), true, false, true);
        assertThat(w.isFavorite()).isTrue();
        assertThat(w.isDisponivel()).isFalse();
        assertThat(w.getAvailabilityStatus()).isEqualTo(AvailabilityStatus.UNAVAILABLE);
        assertThat(w.isForSale()).isTrue();
        verify(events).publishEvent(any(DomainEvents.AvailabilityChanged.class));
        service.toggles(ana, w.getId(), null, false, null, true);
        assertThat(w.isForDonation()).isTrue();
        assertThat(w.isForSale()).isFalse();
        verify(events).publishEvent(any(DomainEvents.AvailabilityChanged.class));
        service.toggles(ana, w.getId(), null, true, null, null);
        assertThat(w.getAvailabilityStatus()).isEqualTo(AvailabilityStatus.AVAILABLE);
    }

    @Test
    void marcarUsoEPublicarNoFeed() {
        WardrobeItem w = world.piece(world.me, "jeans");
        int antes = w.getWearCount();
        Views.PieceView v = service.markWorn(ana, w.getId());
        assertThat(v.wearCount()).isEqualTo(antes + 1);
        assertThat(w.getLastWornDate()).isNotNull();
        verify(events).publishEvent(any(DomainEvents.PieceWorn.class));
        w.setVisibility(Visibility.PRIVATE);
        service.publishForFeed(ana, w.getId());
        assertThat(w.getVisibility()).isEqualTo(Visibility.PUBLIC);
    }

    @Test
    void exclusaoGuardaORetratoNosLooksETiraAsFotos() {
        WardrobeItem jeans = world.piece(world.me, "jeans");
        Map<String, Object> impact = service.deletionImpact(ana, jeans.getId());
        assertThat(impact).containsEntry("schemesAffected", 1L).containsEntry("publishedSchemes", 1L);
        when(media.retire(any(), any(), any(), any())).thenReturn(2);
        Map<String, Object> out = service.delete(ana, jeans.getId());
        assertThat(out).containsEntry("photosRemoved", 2);
        assertThat(jeans.getAvailabilityStatus()).isEqualTo(AvailabilityStatus.ARCHIVED);
        assertThat(jeans.getVisibility()).isEqualTo(Visibility.PRIVATE);
        assertThat(kit.dep(SchemeItemRepository.class).findByWardrobeItemId(jeans.getId())).allMatch(si -> si.getSnapshotJson() != null);
        verify(kit.dep(ProjectionService.class)).removePiece(jeans.getId());
        verify(events).publishEvent(any(DomainEvents.PieceDeleted.class));

        WardrobeItem semLook = world.piece(world.me, "dress");
        kit.dep(SchemeItemRepository.class).findByWardrobeItemId(semLook.getId()).forEach(si -> si.setSnapshotJson("{}"));
        WardrobeItem cap = world.piece(world.me, "handbag");
        assertThat(service.deletionImpact(ana, cap.getId()).get("message")).isNotNull();
        WardrobeItem nunca = Kit.piece(world.me, "nova", "upper_piece", "t_shirt", "white");
        kit.dep(br.com.fashionai.domain.repository.WardrobeItemRepository.class).save(nunca);
        assertThat(service.deletionImpact(ana, nunca.getId())).containsEntry("schemesAffected", 0L);
        List<SchemeItem> none = kit.dep(SchemeItemRepository.class).findByWardrobeItemId(nunca.getId());
        assertThat(none).isEmpty();
    }

    @Test
    void imagemPadraoDepoisDeApagarAFoto() {
        WardrobeItem w = world.piece(world.me, "jeans");
        w.setStudioImageUrl("/s.jpg");
        service.useDefaultImageAfterPhotoDeletion(w);
        assertThat(w.getImageUrl()).isEqualTo("/assets_pecas/padrao.png");
        assertThat(w.getStudioImageUrl()).isNull();
        assertThat(w.isDefaultImage()).isTrue();
    }

    @Test
    void modelo3dETaxonomia() {
        WardrobeItem w = world.piece(world.me, "jeans");
        when(kit.dep(Model3dService.class).request(w)).thenReturn(Map.of("status", "QUEUED"));
        when(kit.dep(Model3dService.class).status(w)).thenReturn(Map.of("status", "DONE"));
        assertThat(service.request3d(ana, w.getId())).containsEntry("status", "QUEUED");
        assertThat(service.status3d(ana, w.getId())).containsEntry("status", "DONE");
        Brand b = new Brand();
        b.setName("Zara");
        b.setSlug("zara");
        kit.dep(BrandRepository.class).save(b);
        Map<String, Object> t = service.taxonomy();
        assertThat(t).containsKeys("subcategories", "defaultImages", "defaultImagesBySubcategory", "brands", "variations");
        assertThat((List<?>) t.get("brands")).hasSize(1);
        assertThat(service.studioBackdrops().get(0)).containsEntry("id", "auto");
        assertThat(service.studioBackdrops()).hasSizeGreaterThan(1);
    }

    @Test
    void loteDeFotosValidaQuantidade() {
        assertThatThrownBy(() -> service.analyzeBatch(ana, List.of())).isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).code()).isEqualTo("SEM_FOTOS"));
        assertThatThrownBy(() -> service.analyzeBatch(ana, null)).isInstanceOf(ApiException.class);
        List<byte[]> treze = java.util.Collections.nCopies(13, new byte[]{1});
        assertThatThrownBy(() -> service.analyzeBatch(ana, treze)).isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).code()).isEqualTo("LOTE_GRANDE"));
    }

    @Test
    void rascunhoRecusadoNoLote() {
        var e = new PhotoRejectedException("recusada", List.of(), "lower_piece");
        WardrobeService.Draft d = WardrobeService.Draft.rejected(e);
        assertThat(d.rejection()).containsEntry("message", "recusada").containsKey("code");
        assertThat(d.draftId()).isNull();
    }
}
