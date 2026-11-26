package br.com.fashionai.application.catalog;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.WardrobeService;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.application.wardrobe.PieceForm;
import br.com.fashionai.domain.model.Brand;
import br.com.fashionai.domain.model.CatalogImage;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.CatalogVariant;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.BrandSource;
import br.com.fashionai.domain.model.enums.CatalogImageType;
import br.com.fashionai.domain.model.enums.CatalogImageUsage;
import br.com.fashionai.domain.model.enums.CatalogIngestionStatus;
import br.com.fashionai.domain.model.enums.CatalogSourceType;
import br.com.fashionai.domain.repository.BrandRepository;
import br.com.fashionai.domain.repository.CatalogImageRepository;
import br.com.fashionai.domain.repository.CatalogProductRepository;
import br.com.fashionai.domain.repository.CatalogVariantRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.testkit.World.map;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Exercício 20 — SKU e cor valem na MESMA variante. Um produto com SKU-A azul e SKU-B vermelho: a busca por código
 * pré-seleciona a variante do código (nunca a de outra cor), a peça criada guarda produto, variante, SKU e cor da
 * variante escolhida, e uma cor declarada que contradiz a variante é recusada.
 */
class CatalogVariantSkuColorTest {
    private Kit kit;
    private CatalogService catalog;
    private CatalogIngestService ingest;
    private CatalogProduct tee;
    private CatalogVariant blue;
    private CatalogVariant red;
    private CurrentUser ana;
    private User user;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        ingest = kit.real(CatalogIngestService.class);
        for (String brand : List.of("Nike", "Adidas")) {
            kit.dep(BrandRepository.class).save(new Brand(brand, CatalogNormalizer.get().brandSlug(brand), BrandSource.SEEDED));
        }
        tee = product("Nike", "Camiseta Essencial", "TEE-1");
        blue = variant(tee, "blue", "Azul", "SKU-A");
        red = variant(tee, "red", "Vermelho", "SKU-B");
        catalog = kit.build(CatalogService.class);
        user = kit.dep(UserRepository.class).save(Kit.user("ana"));
        ana = Kit.as(user);
    }

    private CatalogProduct product(String brand, String name, String code) {
        return ingest.upsert(new CatalogIngestService.ProductInput(brand, null, "t_shirt", brand + " " + name, name, code, code, null, null, null,
                "white", "Branca", "cotton", null, "unissex", "https://loja.example/p/" + code, null, List.of(), List.of(), List.of()),
                CatalogIngestionStatus.VALIDATED, false).product();
    }

    private CatalogVariant variant(CatalogProduct p, String color, String colorName, String sku) {
        CatalogVariant v = new CatalogVariant();
        v.setProductId(p.getId());
        v.setVariantKey(color);
        v.setColor(color);
        v.setColorName(colorName);
        v.setSku(sku);
        v.setVariantCode(sku + "-COD");
        return kit.dep(CatalogVariantRepository.class).save(v);
    }

    private CatalogImage photo(CatalogProduct p, CatalogVariant v, String url) {
        CatalogImage i = new CatalogImage();
        i.setProductId(p.getId());
        i.setVariantId(v.getId());
        i.setImageUrl(url);
        i.setImageType(CatalogImageType.PACKSHOT);
        i.setSourceType(CatalogSourceType.OFFICIAL_BRAND);
        i.setUsageStatus(CatalogImageUsage.PERSISTED);
        i.setPrimary(true);
        return kit.dep(CatalogImageRepository.class).save(i);
    }

    private static CatalogService.AddRequest add(CatalogProduct p, UUID variantId, String color) {
        return new CatalogService.AddRequest(p.getId(), variantId, null, null, null, null, null, null, null, null, null, null, null,
                color, null, null, null, null);
    }

    @Test
    void identificadorECorPrecisamEstarNaMesmaVariante() {
        List<CatalogVariant> vs = List.of(blue, red);
        assertThat(CatalogVariantIdentity.byIdentifier(vs, "SKU-A", null)).isSameAs(blue);
        assertThat(CatalogVariantIdentity.byIdentifier(vs, " sku-a ", "blue")).isSameAs(blue);
        assertThat(CatalogVariantIdentity.byIdentifier(vs, "sku-b-cod", "red")).isSameAs(red);
        assertThat(CatalogVariantIdentity.byIdentifier(vs, "red", null)).isSameAs(red);
        // SKU-A é azul: pedir SKU-A em vermelho não pode "emprestar" a cor da outra variante
        assertThat(CatalogVariantIdentity.byIdentifier(vs, "SKU-A", "red")).isNull();
        // o SKU do produto tem outra semântica: acha o produto, não escolhe variante
        assertThat(CatalogVariantIdentity.byIdentifier(vs, "TEE-1", null)).isNull();
        assertThat(CatalogVariantIdentity.byIdentifier(vs, " ", "blue")).isNull();
    }

    @Test
    void aConsultaPorIdentificadorTestaCodigoECorNoMesmoAliasEContaIgual() throws Exception {
        Query q = CatalogProductRepository.class.getMethod("browseByIdentifier", String.class, String.class, String.class, String.class,
                String.class, String.class, org.springframework.data.domain.Pageable.class).getAnnotation(Query.class);
        String sameVariant = "EXISTS (SELECT 1 FROM catalog_variants v WHERE v.product_id = p.id AND (LOWER(v.sku) = :code "
                + "OR LOWER(v.variant_code) = :code OR LOWER(v.variant_key) = :code) AND (:color IS NULL OR v.color = :color))";
        assertThat(q.value()).contains(sameVariant);
        assertThat(q.countQuery()).contains(sameVariant);
        // a contagem usa o mesmo filtro da página: sem isso o total e a paginação divergem dos itens
        String where = q.value().substring(q.value().indexOf(" WHERE "), q.value().indexOf(" ORDER BY "));
        assertThat(q.countQuery()).endsWith(where);
    }

    @Test
    void buscaPorSkuPreSelecionaAVarianteDoCodigoComACorEAFotoDela() {
        photo(tee, blue, "https://loja.example/img/azul.jpg");
        Map<String, Object> card = catalog.cards(List.of(tee), "sku-b", null).getFirst();
        assertThat(card).containsEntry("id", tee.getId()).containsEntry("color", "red").containsEntry("colorName", "Vermelho");
        assertThat(map(card.get("selectedVariant"))).containsEntry("id", red.getId()).containsEntry("sku", "SKU-B").containsEntry("color", "red");
        // a vermelha não tem foto aprovada: o card fica sem foto, nunca com a foto azul
        assertThat(card).containsEntry("imageUrl", null).containsEntry("catalogImage", null);
        assertThat(map(catalog.cards(List.of(tee), "SKU-A", "blue").getFirst().get("selectedVariant"))).containsEntry("id", blue.getId());
        // sem código, e com código que só o produto tem, nenhuma variante é forçada pela busca
        assertThat(CatalogVariantIdentity.byIdentifier(List.of(blue, red), "TEE-1", "red")).isNull();
        assertThat(catalog.cards(List.of(tee)).getFirst().get("variants")).asList().hasSize(2);
    }

    @Test
    void skuRepetidoEmOutraMarcaEscolheAVarianteDeCadaProduto() {
        CatalogProduct other = product("Adidas", "Camiseta Clube", "CLB-1");
        CatalogVariant otherGreen = variant(other, "green", "Verde", "SKU-A");
        List<Map<String, Object>> cards = catalog.cards(List.of(tee, other), "SKU-A", null);
        assertThat(map(cards.get(0).get("selectedVariant"))).containsEntry("id", blue.getId()).containsEntry("color", "blue");
        assertThat(map(cards.get(1).get("selectedVariant"))).containsEntry("id", otherGreen.getId()).containsEntry("color", "green");
        // variante de outro produto não entra na peça deste
        assertThatThrownBy(() -> catalog.addToWardrobe(ana, add(tee, otherGreen.getId(), null)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(404));
    }

    @Test
    void pecaCriadaGuardaProdutoVarianteSkuECorDaVarianteEscolhida() {
        ArgumentCaptor<PieceForm> form = ArgumentCaptor.forClass(PieceForm.class);
        ArgumentCaptor<CatalogPick> pick = ArgumentCaptor.forClass(CatalogPick.class);
        WardrobeItem saved = Kit.piece(user, "Camiseta", "upper_piece", "t_shirt", "blue");
        saved.setCatalogProductId(tee.getId());
        saved.setCatalogVariantId(blue.getId());
        saved.setSku("SKU-A");
        when(kit.dep(WardrobeService.class).createFromCatalog(any(), form.capture(), pick.capture())).thenReturn(Views.piece(saved, null, null));

        Views.PieceView view = catalog.addToWardrobe(ana, add(tee, blue.getId(), "blue"));

        assertThat(form.getValue().color()).isEqualTo("blue");
        assertThat(form.getValue().sku()).isEqualTo("SKU-A");
        assertThat(pick.getValue().productId()).isEqualTo(tee.getId());
        assertThat(pick.getValue().variantId()).isEqualTo(blue.getId());
        // a variante sem foto não herda a foto de outra cor
        assertThat(pick.getValue().imageUrl()).isNull();
        // recarregada, a peça devolve a origem (produto e variante), o SKU e a cor
        assertThat(view.catalogProductId()).isEqualTo(tee.getId());
        assertThat(view.catalogVariantId()).isEqualTo(blue.getId());
        assertThat(view.sku()).isEqualTo("SKU-A");
        assertThat(view.color()).isEqualTo("blue");
        // sem cor no payload vale a da variante; sem SKU na variante vale o do produto
        catalog.addToWardrobe(ana, add(tee, red.getId(), null));
        assertThat(form.getValue().color()).isEqualTo("red");
        red.setSku(null);
        catalog.addToWardrobe(ana, add(tee, red.getId(), " "));
        assertThat(form.getValue().sku()).isEqualTo("TEE-1");
    }

    @Test
    void corDeclaradaQueContradizAVarianteEscolhidaERecusada() {
        long owners = tee.getOwnersCount();
        assertThatThrownBy(() -> catalog.addToWardrobe(ana, add(tee, blue.getId(), "red")))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.status()).isEqualTo(400);
                    assertThat(e.code()).isEqualTo("COR_DIVERGE_DA_VARIANTE");
                });
        assertThat(MemoryRepository.<WardrobeItem>rows(kit.dep(br.com.fashionai.domain.repository.WardrobeItemRepository.class))).isEmpty();
        assertThat(tee.getOwnersCount()).isEqualTo(owners);
    }
}
