package br.com.fashionai.application.catalog;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.CatalogPick;
import br.com.fashionai.application.service.WardrobeService;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Brand;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.CatalogProductModel3d;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.BrandSource;
import br.com.fashionai.domain.model.enums.CatalogIngestionStatus;
import br.com.fashionai.domain.model.enums.CatalogModelStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.BrandRepository;
import br.com.fashionai.domain.repository.CatalogProductModel3dRepository;
import br.com.fashionai.domain.repository.CatalogProductRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * Etapa 3 — o modelo 3D de vitrine PUBLISHED do produto chega ao card (lista, busca, detalhe) como {@code model3dUrl} e
 * vai junto quando a pessoa leva a peça do catálogo para o guarda-roupa; DRAFT e RETIRED nunca aparecem. O primeiro
 * teste caracteriza o card (chaves e ordem do JSON) para a extração de {@link CatalogCards} não mudar o contrato.
 */
class CatalogServiceModel3dTest {
    private static final List<String> CARD_KEYS = List.of("id", "brand", "productName", "modelName", "category",
            "subcategory", "color", "colorName", "colorHex", "material", "variation", "attributes", "collection",
            "description", "design", "gender", "productCode", "sku", "imageUrl", "imageProcessingStatus", "catalogImage",
            "imageSource", "source", "ingestionStatus", "ownersCount");

    private Kit kit;
    private CatalogService catalog;
    private Brand nike;
    private CurrentUser ana;
    private User user;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        CatalogIngestService ingest = kit.real(CatalogIngestService.class);
        CatalogProductRepository products = kit.dep(CatalogProductRepository.class);
        lenient().when(products.candidates(any(), any(), any(), any())).thenAnswer(i -> all());
        lenient().when(products.candidatesWithColor(any(), any(), any(), any(), any())).thenAnswer(i -> all());
        nike = kit.dep(BrandRepository.class).save(new Brand("Nike", CatalogNormalizer.get().brandSlug("Nike"), BrandSource.SEEDED));
        for (String[] p : new String[][]{{"Air Force 1", "casual_sneakers", "white", "AF1-W"}, {"Moletom Club", "hoodie", "gray", "CLUB-G"}}) {
            ingest.upsert(new CatalogIngestService.ProductInput("Nike", null, p[1], "Nike " + p[0], p[0], p[3], p[3], null, null, null,
                    p[2], p[2], "cotton", null, "unissex", "https://nike.com.br/p/" + p[3], null, List.of(), List.of(),
                    List.of(new CatalogIngestService.VariantInput(p[2], p[2], p[3] + "-V", null, null))), CatalogIngestionStatus.VALIDATED, false);
        }
        catalog = kit.build(CatalogService.class);
        user = kit.dep(UserRepository.class).save(Kit.user("ana"));
        ana = Kit.as(user);
    }

    private List<CatalogProduct> all() {
        return MemoryRepository.<CatalogProduct>rows(kit.dep(CatalogProductRepository.class));
    }

    private CatalogProduct named(String model) {
        return all().stream().filter(p -> model.equals(p.getModelName())).findFirst().orElseThrow();
    }

    private void model(CatalogProduct p, CatalogModelStatus status, String key, Instant publishedAt) {
        CatalogProductModel3d m = new CatalogProductModel3d();
        m.setCatalogProductId(p.getId());
        m.setStatus(status);
        m.setSource("GENERATED");
        m.setSha256("a".repeat(64));
        m.setRenditionsJson("{\"WEB\":{\"key\":\"" + key + "\",\"bytes\":10}}");
        m.setPublishedAt(publishedAt);
        kit.dep(CatalogProductModel3dRepository.class).save(m);
    }

    private void withModels() {
        catalog.setProductModels(new CatalogProductModels(kit.dep(CatalogProductModel3dRepository.class)));
    }

    @Test
    void cardKeepsItsKeysAndOrder() {
        assertThat(catalog.card(named("Air Force 1"), nike, null).keySet()).containsExactlyElementsOf(CARD_KEYS);
        assertThat(catalog.cards(List.of(named("Air Force 1"))).getFirst().keySet())
                .containsExactlyElementsOf(concat(CARD_KEYS, "variants"));
    }

    @Test
    void withoutTheModelServiceNothingChanges() {
        assertThat(catalog.cards(List.of(named("Air Force 1"))).getFirst()).doesNotContainKey("model3dUrl");
        assertThat(catalog.product(named("Air Force 1").getId())).doesNotContainKey("model3dUrl");
    }

    @Test
    void publishedModelReachesListDetailAndSearch() {
        CatalogProduct af1 = named("Air Force 1");
        CatalogProduct club = named("Moletom Club");
        model(af1, CatalogModelStatus.RETIRED, "catalog/model3d/old/a.glb", Instant.parse("2026-01-01T00:00:00Z"));
        model(af1, CatalogModelStatus.PUBLISHED, "catalog/model3d/new/b.glb", Instant.parse("2026-11-01T00:00:00Z"));
        model(club, CatalogModelStatus.DRAFT, "catalog/model3d/draft/c.glb", null);
        withModels();
        Map<UUID, Object> listed = byId(catalog.cards(all()));
        assertThat(listed.get(af1.getId())).isEqualTo("/media/catalog/model3d/new/b.glb");
        assertThat(listed).containsEntry(club.getId(), null);
        assertThat(catalog.product(af1.getId())).containsEntry("model3dUrl", "/media/catalog/model3d/new/b.glb");
        assertThat(catalog.product(club.getId())).containsEntry("model3dUrl", null);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> found = (List<Map<String, Object>>) catalog.search(
                new CatalogService.SearchRequest(null, null, null, "tênis nike air force branco", null, 10)).get("results");
        assertThat(byId(found).get(af1.getId())).isEqualTo("/media/catalog/model3d/new/b.glb");
    }

    @Test
    void pieceTakenFromTheCatalogCarriesTheProductModel() {
        CatalogProduct af1 = named("Air Force 1");
        model(af1, CatalogModelStatus.PUBLISHED, "catalog/model3d/x/af1.glb", Instant.now());
        withModels();
        ArgumentCaptor<CatalogPick> picked = ArgumentCaptor.forClass(CatalogPick.class);
        when(kit.dep(WardrobeService.class).createFromCatalog(any(), any(), picked.capture()))
                .thenReturn(Views.piece(Kit.piece(user, "AF1", af1.getCategory(), af1.getSubcategory(), "white"), null, null));
        catalog.addToWardrobe(ana, new CatalogService.AddRequest(af1.getId(), null, null, null, null, null, null, null, null, null,
                Visibility.PRIVATE, null, null, null, null, null, null, null));
        assertThat(picked.getValue().model3dUrl()).isEqualTo("/media/catalog/model3d/x/af1.glb");
        assertThat(picked.getValue().productId()).isEqualTo(af1.getId());

        CatalogProduct club = named("Moletom Club");
        catalog.addToWardrobe(ana, new CatalogService.AddRequest(club.getId(), null, null, null, null, null, null, null, null, null,
                Visibility.PRIVATE, null, null, null, null, null, null, null));
        assertThat(picked.getValue().model3dUrl()).isNull();
    }

    private static Map<UUID, Object> byId(List<Map<String, Object>> cards) {
        Map<UUID, Object> out = new java.util.HashMap<>();
        cards.forEach(c -> out.put((UUID) c.get("id"), c.get("model3dUrl")));
        return out;
    }

    private static List<String> concat(List<String> keys, String last) {
        List<String> out = new java.util.ArrayList<>(keys);
        out.add(last);
        return out;
    }
}
