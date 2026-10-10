package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.CelebrityProfile;
import br.com.fashionai.domain.model.RoomCatalogItem;
import br.com.fashionai.domain.model.RoomInventoryItem;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.Seal;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.RoomCatalogItemRepository;
import br.com.fashionai.domain.repository.RoomInventoryItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.SealBondRepository;
import br.com.fashionai.domain.repository.SealRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.testkit.World.map;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * Loja do quarto (RF35): o catálogo de fábrica (cada bloco × material × cor) e o "Criar guarda-roupa 3D" das marcas e
 * celebridades — componente avulso ou guarda-roupa inteiro, com logo, arte, selo exigido, estoque, limite por pessoa e
 * período de venda.
 */
class WardrobeCreatorServiceTest {
    private Kit kit;
    private WardrobeCreatorService creator;
    private User marca;
    private User estrela;
    private User cliente;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        when(kit.dep(Guard.class).deny(any(), any(), any())).thenAnswer(i -> new ApiException(403, "NEGADO", "negado"));
        when(kit.dep(MediaService.class).put(anyString(), any(), anyString()))
                .thenAnswer(i -> new MediaStoragePort.StoredObject(i.getArgument(0), "/media/" + i.getArgument(0), 10, "image/png"));
        creator = kit.build(WardrobeCreatorService.class);
        UserRepository users = kit.dep(UserRepository.class);
        marca = Kit.user("marcaxis");
        marca.setProfileType(ProfileType.MARCA);
        users.save(marca);
        BrandProfile bp = new BrandProfile();
        bp.setOwner(marca);
        bp.setBrandName("Marca Xis");
        bp.setSlug("marca-xis");
        bp.setLogoUrl("/media/logo-xis.png");
        kit.dep(BrandProfileRepository.class).save(bp);
        estrela = Kit.user("estrela");
        estrela.setProfileType(ProfileType.CELEBRIDADE);
        users.save(estrela);
        CelebrityProfile cp = new CelebrityProfile();
        cp.setOwner(estrela);
        cp.setStageName("Estrela");
        kit.dep(CelebrityProfileRepository.class).save(cp);
        cliente = users.save(Kit.user("cliente"));
    }

    private WardrobeCreatorService.ItemForm component(String slot, String mold, String material, String colorName, Integer stock, Integer perUser,
                                                       Boolean requiresSeal, UUID sealId) {
        return new WardrobeCreatorService.ItemForm("COMPONENT", "Porta assinada", "Porta da coleção", slot, mold, material, colorName, null,
                "https://cdn.example.com/logo.png", "/media/arte.png", "XIS", sealId, 500, "studio", stock, perUser, null, null, requiresSeal, true, null);
    }

    @Test
    void catalogoDeFabricaSemeadoUmaVezSo() {
        int created = creator.seedFactory();
        assertThat(created).isGreaterThan(100);
        assertThat(creator.seedFactory()).isZero();
        RoomCatalogItem any = MemoryRepository.<RoomCatalogItem>rows(kit.dep(RoomCatalogItemRepository.class)).get(0);
        assertThat(any.getRarity()).isIn("BASICO", "PREMIUM", "SIGNATURE");
        assertThat(creator.view(any, cliente.getId())).containsEntry("availability", "DISPONIVEL").containsEntry("blocker", null);
        // item antigo sem material/cor nomeados ganha os nomes na próxima semeadura
        RoomCatalogItem legacy = new RoomCatalogItem();
        legacy.setSku("FAI-LEGADO-1");
        legacy.setSlotType("LIGHT");
        legacy.setKind("COMPONENT");
        legacy.setFinishJson("{\"color\":\"#FFD9A0\"}");
        legacy.setActive(true);
        kit.dep(RoomCatalogItemRepository.class).save(legacy);
        creator.seedFactory();
        assertThat(legacy.getColorName()).isNotNull();
    }

    @Test
    void marcaCriaComponenteEGuardaRoupaInteiro() {
        CurrentUser m = Kit.as(marca);
        Map<String, Object> opts = creator.options(m);
        assertThat(map(opts.get("identity"))).containsEntry("name", "Marca Xis");
        Map<String, Object> door = creator.save(m, null, component("DOOR", "PRT-AB60", "madeira", "Nogueira", 10, 2, false, null));
        String sku = String.valueOf(door.get("sku"));
        assertThat(sku).startsWith("BRD-MARCAXIS-");
        assertThat(door).containsEntry("material", "MADEIRA").containsEntry("requiredLevel", "STUDIO").containsEntry("rarity", "MARCA");
        WardrobeCreatorService.ItemForm wardrobe = new WardrobeCreatorService.ItemForm("wardrobe", "Guarda-roupa Xis", null, null, null, null, null, null,
                null, null, null, null, 2000, "LOFT", null, null, null, null, false, true, List.of(
                new WardrobeCreatorService.BundlePart("DOOR", "PRT-AB60", "LACA", "Navy", null),
                new WardrobeCreatorService.BundlePart("DOOR", "PRT-AB90", "LACA", "Preto", null),
                new WardrobeCreatorService.BundlePart("DRAWER", null, "COURO", "Cognac", null),
                new WardrobeCreatorService.BundlePart("HANDLE", "PUX-BAR", "OURO", null, "#d4af37"),
                new WardrobeCreatorService.BundlePart("LOGO", null, null, null, null)));
        Map<String, Object> full = creator.save(m, null, wardrobe);
        assertThat((List<?>) full.get("bundle")).hasSize(4);
        assertThat(full.get("requiredLevel")).isEqualTo("PENTHOUSE");
        Map<String, Object> mine = creator.mine(m);
        assertThat((List<?>) mine.get("items")).hasSize(2);
        assertThat(creator.save(m, sku, component("HANDLE", "PUX-CRO", null, null, null, null, false, null))).containsEntry("material", "COURO");
    }

    @Test
    void regrasDoCriador() {
        CurrentUser m = Kit.as(marca);
        assertThatThrownBy(() -> creator.save(m, null, component("SOFA", null, null, null, null, null, false, null))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> creator.save(m, null, component("DOOR", "PRT-AB60", "LED", null, null, null, false, null))).isInstanceOf(ApiException.class);
        WardrobeCreatorService.ItemForm badUrl = new WardrobeCreatorService.ItemForm(null, "Porta", null, "DOOR", null, null, null, null,
                "javascript:alert(1)", null, null, null, null, null, null, null, null, null, null, null, null);
        assertThatThrownBy(() -> creator.save(m, null, badUrl)).isInstanceOf(ApiException.class);
        WardrobeCreatorService.ItemForm badPrice = new WardrobeCreatorService.ItemForm(null, "Porta", null, "DOOR", null, null, null, null,
                null, null, null, null, -5, null, null, null, null, null, null, null, null);
        assertThatThrownBy(() -> creator.save(m, null, badPrice)).isInstanceOf(ApiException.class);
        Instant now = Instant.now();
        WardrobeCreatorService.ItemForm badPeriod = new WardrobeCreatorService.ItemForm(null, "Porta", null, "DOOR", null, null, null, null,
                null, null, null, null, 100, null, null, null, now, now.minusSeconds(60), null, null, null);
        assertThatThrownBy(() -> creator.save(m, null, badPeriod)).isInstanceOf(ApiException.class);
        WardrobeCreatorService.ItemForm emptyBundle = new WardrobeCreatorService.ItemForm("WARDROBE", "Vazio", null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, null, null, List.of());
        assertThatThrownBy(() -> creator.save(m, null, emptyBundle)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> creator.save(m, "NAO-EXISTE", component("DOOR", null, null, null, null, null, false, null))).isInstanceOf(ApiException.class);
        String sku = String.valueOf(creator.save(m, null, component("RUG", null, "LA", null, null, null, false, null)).get("sku"));
        assertThatThrownBy(() -> creator.save(Kit.as(estrela), sku, component("RUG", null, null, null, null, null, false, null))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> creator.delete(Kit.as(estrela), sku)).isInstanceOf(ApiException.class);
        Seal alheio = new Seal();
        alheio.setOwner(estrela);
        alheio.setName("Selo da Estrela");
        kit.dep(SealRepository.class).save(alheio);
        assertThatThrownBy(() -> creator.save(m, null, component("DOOR", null, null, null, null, null, true, alheio.getId()))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> creator.save(m, null, component("DOOR", null, null, null, null, null, true, UUID.randomUUID()))).isInstanceOf(ApiException.class);
    }

    @Test
    void condicoesDeCompraEstoqueSeloEPeriodo() {
        CurrentUser e = Kit.as(estrela);
        Seal selo = new Seal();
        selo.setOwner(estrela);
        selo.setName("Look da Estrela");
        kit.dep(SealRepository.class).save(selo);
        Map<String, Object> item = creator.save(e, null, component("MIRROR", "ESP-ARC", "OURO", null, 1, 1, true, selo.getId()));
        String sku = String.valueOf(item.get("sku"));
        assertThat(item.get("rarity")).isEqualTo("CELEBRIDADE");
        assertThat(map(item.get("seal"))).containsEntry("name", "Look da Estrela");
        RoomCatalogItem c = kit.dep(RoomCatalogItemRepository.class).findById(sku).orElseThrow();
        assertThat(creator.blocker(cliente.getId(), c)).contains("Estrela");   // sem selo
        Scheme look = new Scheme();
        look.setUser(cliente);
        look.setTitle("Look com selo da Estrela");
        kit.dep(SchemeRepository.class).save(look);
        SealBond bond = new SealBond();
        bond.setScheme(look);
        bond.setRequestedBy(cliente);
        bond.setTargetOwner(estrela);
        bond.setSeal(selo);
        bond.setStatus(SealBondStatus.APPROVED);
        kit.dep(SealBondRepository.class).save(bond);
        assertThat(creator.hasSeal(cliente.getId(), c)).isTrue();
        assertThat(creator.blocker(cliente.getId(), c)).isNull();
        RoomInventoryItem owned = new RoomInventoryItem();
        owned.setId(UUID.randomUUID());
        owned.setUserId(cliente.getId());
        owned.setSku(sku);
        kit.dep(RoomInventoryItemRepository.class).save(owned);
        assertThat(creator.blocker(cliente.getId(), c)).isNotNull();   // limite de 1 por pessoa
        c.setSoldCount(1);
        assertThat(WardrobeCreatorService.availability(c, Instant.now())).isEqualTo("ESGOTADO");
        c.setAvailableUntil(Instant.now().minusSeconds(10));
        assertThat(creator.blocker(cliente.getId(), c)).isNotNull();
        c.setAvailableFrom(Instant.now().plusSeconds(3600));
        c.setAvailableUntil(null);
        assertThat(WardrobeCreatorService.availability(c, Instant.now())).isEqualTo("EM_BREVE");
        c.setActive(false);
        assertThat(creator.blocker(cliente.getId(), c)).isNotNull();
        // com venda feita, excluir só desativa; sem venda, apaga
        creator.delete(e, sku);
        assertThat(kit.dep(RoomCatalogItemRepository.class).findById(sku)).isPresent();
        String fresh = String.valueOf(creator.save(e, null, component("RUG", null, null, null, null, null, false, null)).get("sku"));
        creator.delete(e, fresh);
        assertThat(kit.dep(RoomCatalogItemRepository.class).findById(fresh)).isEmpty();
        estrela.setStatus(br.com.fashionai.domain.model.enums.AccountStatus.SUSPENDED);
        c.setActive(true);
        c.setAvailableFrom(null);
        c.setSoldCount(0);
        assertThat(creator.sellerActive(c)).isFalse();
    }

    @Test
    void uploadDeLogoEArte() throws Exception {
        BufferedImage img = new BufferedImage(200, 200, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        javax.imageio.ImageIO.write(img, "png", out);
        assertThat(String.valueOf(creator.uploadArt(Kit.as(marca), out.toByteArray(), "logo").get("url"))).endsWith(".png");
        assertThat(String.valueOf(creator.uploadArt(Kit.as(marca), out.toByteArray(), "art").get("url"))).endsWith(".jpg");
        assertThat(WardrobeCreatorService.slug("Água & Cia")).isEqualTo("AGUACIA");
        assertThat(WardrobeCreatorService.level("maison")).isEqualTo("MAISON");
        assertThat(WardrobeCreatorService.level("x")).isEqualTo("ESTREIA");
        assertThat(WardrobeCreatorService.finish("LED", "Quente 2700 K", "#FFD9A0", null, null, null, null, null)).containsEntry("kelvin", 2700);
    }
}
