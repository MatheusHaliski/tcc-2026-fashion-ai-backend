package br.com.fashionai.application.service;

import br.com.fashionai.application.flair.FlairEngine;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.Brand;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.FlairCardInstance;
import br.com.fashionai.domain.model.FlairChallenge;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.Model3dStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.repository.BrandRepository;
import br.com.fashionai.domain.repository.CatalogProductRepository;
import br.com.fashionai.domain.repository.FlairCardInstanceRepository;
import br.com.fashionai.domain.repository.FlairChallengeRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/** Cartas FLAIR: prévia do rascunho (marca, catálogo), prévia da peça, retrato do Hype, carta entregue e coleção. */
class FlairCollectionServicePreviaTest {
    private Kit kit;
    private World world;
    private FlairCollectionService service;
    private CurrentUser ana;
    private WardrobeItem piece;
    private HypeScoreCurrentRepository hype;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        kit = new Kit();
        hype = Kit.mock(HypeScoreCurrentRepository.class);
        kit.with(hype);
        world = new World(kit);
        ana = Kit.as(world.me);
        piece = world.piecesOf(world.me).get(0);
        piece.setModerationStatus(ModerationStatus.APPROVED);
        when(kit.dep(WardrobeService.class).owned(any(), eq(piece.getId()))).thenReturn(piece);
        when(kit.dep(FlairService.class).cardsOf(any())).thenAnswer(a -> ((List<WardrobeItem>) a.getArgument(0)).stream()
                .map(w -> FlairEngine.card(new FlairEngine.PieceInput(w.getId().toString(), w.getName(), w.getCategory(), w.getSubcategory(),
                        "/media/p.png", "#000000", w.getBrandName(), false, null, List.of("casual"), List.of("work"), "COTTON", 0.7,
                        false, false, false, false, false, FlairEngine.Hype.NONE, 0), "SPRING")).toList());
        service = kit.build(FlairCollectionService.class);
    }

    private Brand brand(String tier) {
        Brand b = new Brand();
        b.setName("Norte");
        b.setPriceTier(tier);
        return kit.save(BrandRepository.class, b);
    }

    private CatalogProduct product(Brand b, String min, String max, String list) {
        CatalogProduct p = new CatalogProduct();
        p.setBrandId(b.getId());
        p.setPriceMin(min == null ? null : new BigDecimal(min));
        p.setPriceMax(max == null ? null : new BigDecimal(max));
        p.setListPrice(list == null ? null : new BigDecimal(list));
        return kit.save(CatalogProductRepository.class, p);
    }

    @Test
    void previaDoRascunhoSemDadosEComMarcaOuProdutoDoCatalogo() {
        Map<String, Object> vazio = service.previewDraft(new FlairCollectionService.Draft("upper_piece", "t_shirt", null, null, null, null, null, null, null, null));
        assertThat(vazio).containsEntry("position", "SUP").containsEntry("priceVerified", false).containsKeys("ovr", "tier", "basis", "season");

        Brand b = brand("LUXURY");
        b.setBrandProfile(new BrandProfile());
        Map<String, Object> marca = service.previewDraft(new FlairCollectionService.Draft("shoes_piece", "casual_sneakers", new BigDecimal("900"), " ",
                b.getId(), null, List.of("street"), List.of("casual"), "black", "leather"));
        assertThat(marca).containsEntry("position", "CAL");
        assertThat((Integer) marca.get("ovr")).isGreaterThan((Integer) vazio.get("ovr"));

        CatalogProduct p = product(brand("PREMIUM"), "500", null, "800");
        Map<String, Object> catalogo = service.previewDraft(new FlairCollectionService.Draft("lower_piece", "jeans", new BigDecimal("700"), "Norte",
                null, p.getId(), List.of(), List.of(), " ", null));
        assertThat(catalogo).containsEntry("position", "INF");
        Map<String, Object> inexistentes = service.previewDraft(new FlairCollectionService.Draft("lower_piece", "jeans", null, null,
                UUID.randomUUID(), UUID.randomUUID(), null, null, null, null));
        assertThat(inexistentes).containsEntry("priceVerified", false);
    }

    @Test
    void previaDaPecaComProdutoMarcaEstudioE3dMostraACartaQueJaExiste() {
        CatalogProduct p = product(brand("PREMIUM"), null, "300", "250");
        piece.setCatalogProductId(p.getId());
        piece.setStudioImageUrl("/media/studio.png");
        piece.setModel3dStatus(Model3dStatus.COMPLETED);
        piece.setPrice(new BigDecimal("250"));

        Map<String, Object> antes = service.previewPiece(ana, piece.getId());
        assertThat(antes).doesNotContainKey("existing");
        service.convertPiece(ana, piece.getId());
        Map<String, Object> depois = service.previewPiece(ana, piece.getId());
        @SuppressWarnings("unchecked")
        Map<String, Object> existing = (Map<String, Object>) depois.get("existing");
        assertThat(existing).containsEntry("originId", piece.getId()).containsKey("tags");

        piece.setCatalogProductId(null);
        piece.setBrand(brand("BUDGET"));
        assertThat(service.tierOf(piece).ovr()).isPositive();
    }

    @Test
    void retratoDoHypePublicoComDimensoesOuNada() {
        HypeScoreCurrent h = new HypeScoreCurrent();
        h.setEntityType(HypeEntityType.PIECE);
        h.setEntityId(piece.getId());
        h.setScore(new BigDecimal("72.46"));
        h.setPublicEligible(true);
        h.getDimensions().setPopularity(new BigDecimal("50.04"));
        when(hype.findByEntityTypeAndEntityIdInAndAlgorithmVersion(eq(HypeEntityType.PIECE), any(), any())).thenReturn(List.of(h));

        Map<String, Object> card = service.convertPiece(ana, piece.getId());

        @SuppressWarnings("unchecked")
        Map<String, Object> snap = (Map<String, Object>) card.get("hype");
        assertThat(snap).containsEntry("HYP", 72.5).containsEntry("POP", 50.0).containsEntry("ENG", null);

        WardrobeItem outra = world.piecesOf(world.me).get(1);
        when(kit.dep(WardrobeService.class).owned(any(), eq(outra.getId()))).thenReturn(outra);
        h.setDimensions(null);
        assertThat(World.map(service.convertPiece(ana, outra.getId()).get("hype"))).containsEntry("HYP", 72.5).containsEntry("TRD", null);

        WardrobeItem terceira = world.piecesOf(world.me).get(2);
        when(kit.dep(WardrobeService.class).owned(any(), eq(terceira.getId()))).thenReturn(terceira);
        h.setPublicEligible(false);
        assertThat(service.convertPiece(ana, terceira.getId()).get("hype")).isNull();

        WardrobeItem quarta = world.piecesOf(world.me).get(3);
        when(kit.dep(WardrobeService.class).owned(any(), eq(quarta.getId()))).thenReturn(quarta);
        h.setPublicEligible(true);
        h.setScore(null);
        assertThat(service.convertPiece(ana, quarta.getId()).get("hype")).isNull();
    }

    @Test
    void cartaEntregueMostraODesafioEColecaoDeOutraPessoaEscondeCartasSemPeca() {
        service.convertPiece(ana, piece.getId());
        FlairCardInstance c = kit.dep(FlairCardInstanceRepository.class).findAll().get(0);
        FlairChallenge ch = new FlairChallenge();
        ch.setSlug("noite");
        ch.setName("Noite");
        kit.save(FlairChallengeRepository.class, ch);
        c.setLockedChallengeId(ch.getId());
        FlairCardInstance avulsa = new FlairCardInstance();
        avulsa.setOwnerId(world.me.getId());
        avulsa.setOriginType("DROP");
        avulsa.setOriginId(UUID.randomUUID());
        avulsa.setTier("OURO");
        avulsa.setOvr(80);
        avulsa.setLockedChallengeId(UUID.randomUUID());
        kit.save(FlairCardInstanceRepository.class, avulsa);
        FlairCardInstance semPeca = new FlairCardInstance();
        semPeca.setOwnerId(world.me.getId());
        semPeca.setOriginType("PIECE");
        semPeca.setOriginId(UUID.randomUUID());
        semPeca.setTier("BRONZE");
        kit.save(FlairCardInstanceRepository.class, semPeca);
        when(kit.dep(Guard.class).canView(any(), any(), any())).thenReturn(true);

        Map<String, Object> minha = service.ofUser(ana, world.me.getId());
        assertThat(minha.get("total")).isEqualTo(3);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> views = (List<Map<String, Object>>) minha.get("cards");
        assertThat(views.get(0)).containsEntry("tier", "OURO").containsEntry("lockedIn", null);
        assertThat(views.stream().filter(v -> v.get("lockedIn") != null).findFirst().orElseThrow().get("lockedIn"))
                .isEqualTo(Map.of("id", ch.getId(), "slug", "noite", "name", "Noite"));

        Map<String, Object> visita = service.ofUser(Kit.as(world.rival), world.me.getId());
        assertThat(visita.get("total")).isEqualTo(1);
        assertThat(service.ofUser(null, world.me.getId()).get("total")).isEqualTo(1);
        assertThat(service.mine(ana, piece.getId()).get("total")).isEqualTo(1);
    }

    @Test
    void tagsDaPecaAusenteOuSemCorEMaterial() {
        assertThat(FlairCollectionService.tagsOf(null)).containsEntry("styles", List.of()).containsEntry("colors", List.of());
        WardrobeItem w = Kit.piece(world.me, "x", "upper_piece", "shirt", " ");
        w.setMaterial(null);
        assertThat(FlairCollectionService.tagsOf(w)).containsEntry("colors", List.of()).containsEntry("materials", List.of());
        w.setMaterial("SILK");
        assertThat(FlairCollectionService.tagsOf(w)).containsEntry("materials", List.of("silk"));
    }
}
