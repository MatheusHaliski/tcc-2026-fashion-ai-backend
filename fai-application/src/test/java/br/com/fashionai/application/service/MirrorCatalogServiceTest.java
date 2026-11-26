package br.com.fashionai.application.service;

import br.com.fashionai.application.catalog.CatalogService;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.imaging.SchemeCardRenderer;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.enums.CatalogIngestionStatus;
import br.com.fashionai.domain.repository.CatalogProductRepository;
import br.com.fashionai.domain.repository.MirrorStateRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * Espelho com o catálogo de marcas: o produto do catálogo paginado veste o reflexo ao lado das peças da pessoa, só para
 * provar. O servidor valida o produto (existe e está visível), põe no lugar dele com as regras do corpo e devolve a vista
 * com nome, marca e foto do catálogo; salvar e usar hoje seguem só com as peças do guarda-roupa.
 */
class MirrorCatalogServiceTest {
    private Kit kit;
    private World world;
    private MirrorService mirror;
    private MirrorCatalogService catalogMirror;
    private CurrentUser ana;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        world = new World(kit);
        when(kit.dep(MediaService.class).put(anyString(), any(), anyString()))
                .thenAnswer(i -> new MediaStoragePort.StoredObject(i.getArgument(0), "/media/" + i.getArgument(0), 10, "image/png"));
        when(kit.dep(Guard.class).canView(any(), any(), any())).thenReturn(true);
        kit.real(WardrobeService.class);
        kit.real(BackgroundStudioService.class);
        kit.real(SchemeCardRenderer.class);
        kit.real(br.com.fashionai.application.acervo.AcervoLugares.class);
        kit.real(SchemeService.class);
        mirror = kit.build(MirrorService.class);
        CatalogService catalog = Mockito.mock(CatalogService.class);
        when(catalog.product(any(UUID.class))).thenAnswer(i -> card(i.getArgument(0)));
        MirrorCatalogPieces pieces = new MirrorCatalogPieces(kit.dep(CatalogProductRepository.class), catalog);
        ReflectionTestUtils.setField(mirror, "catalogPieces", pieces);
        catalogMirror = new MirrorCatalogService(mirror, kit.dep(MirrorStateRepository.class), pieces);
        ana = Kit.as(world.me);
    }

    private CatalogProduct product(String name, String category, String subcategory, CatalogIngestionStatus status) {
        CatalogProduct p = new CatalogProduct();
        p.assignId(UUID.randomUUID());
        p.setBrandId(UUID.randomUUID());
        p.setProductName(name);
        p.setCategory(category);
        p.setSubcategory(subcategory);
        p.setIngestionStatus(status);
        return kit.save(CatalogProductRepository.class, p);
    }

    /** O card que o catálogo devolve (CatalogService.product): marca, foto escolhida pelo pipeline e a variante. */
    private Map<String, Object> card(UUID id) {
        CatalogProduct p = kit.dep(CatalogProductRepository.class).findById(id).orElseThrow();
        Map<String, Object> card = new HashMap<>();
        card.put("id", id);
        card.put("productName", p.getProductName());
        card.put("brand", Map.of("name", "Marca X", "slug", "marca-x", "logoUrl", "/media/x.png"));
        card.put("category", p.getCategory());
        card.put("subcategory", p.getSubcategory());
        card.put("colorHex", "#FFFFFF");
        card.put("imageUrl", "https://loja.example/" + p.getSubcategory() + ".jpg");
        card.put("catalogImage", Map.of("imageId", "img-1", "variantId", "var-1", "thumbnailUrl", "/media/thumb.webp",
                "whole", Map.of("url", "/media/whole.png", "processed", true)));
        card.put("selectedVariant", Map.of("id", "var-1"));
        card.put("source", Map.of("productUrl", "https://loja.example/p/1"));
        return card;
    }

    private UUID piece(String subcategory) {
        return world.piece(world.me, subcategory).getId();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> slot(Map<String, Object> state, String slot) {
        return (Map<String, Object>) ((Map<String, Object>) state.get("slots")).get(slot);
    }

    @Test
    @SuppressWarnings("unchecked")
    void vesteOProdutoNoLugarDeleComAVistaDoCatalogoESalvarSegueComAsPecasDaPessoa() {
        mirror.place(ana, piece("t_shirt"));
        mirror.place(ana, piece("jeans"));
        CatalogProduct sneaker = product("Tênis branco", "shoes_piece", "casual_sneakers", CatalogIngestionStatus.VALIDATED);

        Map<String, Object> r = catalogMirror.wear(ana, sneaker.getId());

        Map<String, Object> shoes = slot(r, "shoes");
        assertThat(shoes).containsEntry("id", "c:" + sneaker.getId()).containsEntry("source", "catalog").containsEntry("productId", sneaker.getId())
                .containsEntry("name", "Tênis branco").containsEntry("slot", "shoes").containsEntry("variantId", "var-1")
                .containsEntry("imageId", "img-1").containsEntry("studioImageUrl", "/media/whole.png").containsEntry("thumbnailUrl", "/media/thumb.webp")
                .containsEntry("officialUrl", "https://loja.example/p/1").containsEntry("available", true);
        assertThat((Map<String, Object>) shoes.get("brand")).containsEntry("name", "Marca X");
        // completo é com as peças da pessoa: o tênis do catálogo não libera "Usar hoje"
        assertThat(r.get("complete")).isEqualTo(false);
        assertThat(String.valueOf(r.get("missing"))).contains("shoes");
        assertThatThrownBy(() -> mirror.useLook(ana)).isInstanceOf(ApiException.class);
        // a peça do catálogo não entra na lista do espelho (só peças trazidas do guarda-roupa)
        assertThat((List<?>) r.get("rack")).hasSize(2);
        // salvar vira esquema só com as duas peças da pessoa
        UUID scheme = (UUID) mirror.save(ana, "Com tênis da loja", false).get("schemeId");
        assertThat(kit.dep(SchemeItemRepository.class).findBySchemeIdOrderBySortOrder(scheme)).hasSize(2);
        // o estado relido traz o produto de novo
        assertThat(slot(mirror.state(ana), "shoes")).containsEntry("source", "catalog");
    }

    @Test
    void pecaUnicaDoCatalogoTiraCimaEBaixoEAPecaDaPessoaTiraOProduto() {
        UUID tee = piece("t_shirt");
        mirror.place(ana, tee);
        mirror.place(ana, piece("jeans"));
        CatalogProduct dress = product("Vestido longo", "full_body_piece", "dress", CatalogIngestionStatus.PERSISTABLE);

        Map<String, Object> r = catalogMirror.wear(ana, dress.getId());
        assertThat(slot(r, "upper")).isNull();
        assertThat(slot(r, "lower")).isNull();
        assertThat(slot(r, "dress")).containsEntry("id", "c:" + dress.getId());

        r = mirror.place(ana, tee);
        assertThat(slot(r, "dress")).isNull();
        assertThat(slot(r, "upper")).containsEntry("id", tee);
        assertThat(kit.dep(MirrorStateRepository.class).findByUserId(ana.id()).orElseThrow().getSlotsJson()).doesNotContain(dress.getId().toString());
    }

    @Test
    void oServidorNaoConfiaNoCliente() {
        CatalogProduct discovered = product("Candidato", "upper_piece", "t_shirt", CatalogIngestionStatus.DISCOVERED);
        CatalogProduct rejected = product("Recusado", "upper_piece", "t_shirt", CatalogIngestionStatus.REJECTED);
        assertThatThrownBy(() -> catalogMirror.wear(ana, null)).isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).status()).isEqualTo(400));
        for (UUID id : List.of(UUID.randomUUID(), discovered.getId(), rejected.getId())) {
            assertThatThrownBy(() -> catalogMirror.wear(ana, id)).isInstanceOf(ApiException.class)
                    .satisfies(e -> assertThat(((ApiException) e).status()).isEqualTo(404));
        }
        assertThat(kit.dep(MirrorStateRepository.class).findByUserId(ana.id())).isEmpty();
    }

    @Test
    @SuppressWarnings("unchecked")
    void produtoQueSaiDoCatalogoSaiDoEspelhoETirarDevolveOLugar() {
        CatalogProduct bag = product("Bolsa", "accessory_piece", "handbag", CatalogIngestionStatus.REFERENCE_ONLY);
        CatalogProduct coat = product("Casaco", "upper_piece", "coat", CatalogIngestionStatus.VALIDATED);
        catalogMirror.wear(ana, bag.getId());
        Map<String, Object> r = catalogMirror.wear(ana, coat.getId());
        assertThat(slot(r, "outer_layer")).containsEntry("name", "Casaco");
        assertThat((List<Map<String, Object>>) ((Map<String, Object>) r.get("slots")).get("accessory")).extracting(m -> m.get("name")).containsExactly("Bolsa");

        coat.setIngestionStatus(CatalogIngestionStatus.REJECTED);
        r = mirror.state(ana);
        assertThat(slot(r, "outer_layer")).isNull();
        Map<String, Object> saved = Json.map(kit.dep(MirrorStateRepository.class).findByUserId(ana.id()).orElseThrow().getSlotsJson());
        assertThat(String.valueOf(saved.get(MirrorCatalogSlots.KEY))).doesNotContain(coat.getId().toString()).contains(bag.getId().toString());

        r = catalogMirror.takeOff(ana, bag.getId());
        assertThat((List<?>) ((Map<String, Object>) r.get("slots")).get("accessory")).isEmpty();
        assertThat(kit.dep(MirrorStateRepository.class).findByUserId(ana.id()).orElseThrow().getSlotsJson()).doesNotContain(MirrorCatalogSlots.KEY);
    }
}
