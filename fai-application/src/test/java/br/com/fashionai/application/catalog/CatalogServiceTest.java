package br.com.fashionai.application.catalog;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.WardrobeService;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Brand;
import br.com.fashionai.domain.model.BrandAlias;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.CatalogSource;
import br.com.fashionai.domain.model.CatalogVariant;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.BrandSource;
import br.com.fashionai.domain.model.enums.CatalogIngestionStatus;
import br.com.fashionai.domain.model.enums.CatalogSourceType;
import br.com.fashionai.domain.repository.BrandAliasRepository;
import br.com.fashionai.domain.repository.BrandRepository;
import br.com.fashionai.domain.repository.CatalogProductRepository;
import br.com.fashionai.domain.repository.CatalogSourceRepository;
import br.com.fashionai.domain.repository.CatalogVariantRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.testkit.World.map;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * Catálogo de marcas (RF47): a busca entende marca, subtipo (pela frase mais longa), cor e design no texto livre e
 * ordena por aderência; sugestões de nome e de marca (com alias); ficha do produto com imagens e variantes; descoberta
 * nas lojas oficiais da marca; e "adicionar ao meu guarda-roupa" a partir do produto.
 */
class CatalogServiceTest {
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
        lenient().when(products.candidates(any(), any(), any(), any())).thenAnswer(i -> visible(i.getArgument(0)));
        lenient().when(products.candidatesWithColor(any(), any(), any(), any(), any())).thenAnswer(i -> visible(i.getArgument(0)));
        nike = kit.dep(BrandRepository.class).save(new Brand("Nike", CatalogNormalizer.get().brandSlug("Nike"), BrandSource.SEEDED));
        BrandAlias alias = new BrandAlias();
        alias.setBrandId(nike.getId());
        alias.setAlias("Swoosh");
        alias.setAliasNorm(CatalogNormalizer.key("Swoosh"));
        kit.dep(BrandAliasRepository.class).save(alias);
        CatalogSource src = new CatalogSource();
        src.setBrandId(nike.getId());
        src.setDomain("nike.com.br");
        src.setSourceType(CatalogSourceType.OFFICIAL_BRAND);
        kit.dep(CatalogSourceRepository.class).save(src);
        for (String[] p : new String[][]{{"Air Force 1", "casual_sneakers", "white", "AF1-W"}, {"Air Force 1", "casual_sneakers", "black", "AF1-B"},
                {"Moletom Club", "hoodie", "gray", "CLUB-G"}, {"Camiseta Dri-FIT", "t_shirt", "black", "DF-B"}}) {
            ingest.upsert(new CatalogIngestService.ProductInput("Nike", null, p[1], "Nike " + p[0], p[0], p[3], p[3], null, null, null, p[2], p[2],
                    "cotton", null, "unissex", "https://nike.com.br/p/" + p[3], null,
                    List.of(new CatalogIngestService.ImageInput("https://nike.com.br/img/" + p[3] + ".jpg", "packshot")), List.of(p[0].toLowerCase()),
                    List.of(new CatalogIngestService.VariantInput(p[2], p[2], p[3] + "-V", null, null))), CatalogIngestionStatus.VALIDATED, false);
        }
        catalog = kit.build(CatalogService.class);
        user = kit.dep(UserRepository.class).save(Kit.user("ana"));
        ana = Kit.as(user);
    }

    private List<CatalogProduct> visible(String brandId) {
        return MemoryRepository.<CatalogProduct>rows(kit.dep(CatalogProductRepository.class)).stream()
                .filter(p -> brandId == null || p.getBrandId().toString().equals(brandId)).toList();
    }

    @Test
    void buscaEntendeMarcaSubtipoECorNoTexto() {
        Map<String, Object> r = catalog.search(new CatalogService.SearchRequest(null, null, null, "tênis nike air force branco", null, 10));
        assertThat(r).containsEntry("enoughInput", true).containsEntry("canSearchOfficial", true);
        Map<String, Object> intent = map(r.get("intent"));
        assertThat(intent.toString()).contains("white");
        List<?> results = (List<?>) r.get("results");
        assertThat(results).isNotEmpty();
        assertThat(map(results.get(0)).get("productName")).isEqualTo("Nike Air Force 1");
        assertThat(catalog.search(new CatalogService.SearchRequest(null, null, null, null, null, null))).containsEntry("enoughInput", false);
        assertThat(catalog.search(new CatalogService.SearchRequest("upper_piece", "hoodie", "Nike", "moletom com capuz cinza", "gray", 100))).containsKey("results");
        assertThat(catalog.search(new CatalogService.SearchRequest(null, null, null, "camiseta preta estampa listrada", null, 5))).containsKey("results");
        assertThat(catalog.search(new CatalogService.SearchRequest(null, null, "Desconhecida", "jaqueta", null, 5))).containsEntry("canSearchOfficial", false);
    }

    @Test
    void sugestoesDeNomeEMarcaComAlias() {
        assertThat((List<?>) catalog.suggestions(new CatalogService.SearchRequest(null, null, "Nike", "air", null, null)).get("suggestions")).isNotEmpty();
        assertThat((List<?>) catalog.brandSuggestions("nik").get("brands")).hasSize(1);
        assertThat((List<?>) catalog.brandSuggestions("swo").get("brands")).hasSize(1);
        assertThat((List<?>) catalog.brandSuggestions(" ").get("brands")).isEmpty();
        assertThat(catalog.catalogBrands()).hasSize(1);
    }

    @Test
    void fichaDoProdutoComImagensEVariantes() {
        CatalogProduct p = MemoryRepository.<CatalogProduct>rows(kit.dep(CatalogProductRepository.class)).get(0);
        Map<String, Object> m = catalog.product(p.getId());
        assertThat((List<?>) m.get("images")).hasSize(1);
        assertThat((List<?>) m.get("variants")).isNotEmpty();
        assertThat((List<?>) m.get("aliases")).isNotEmpty();
        assertThatThrownBy(() -> catalog.product(UUID.randomUUID())).isInstanceOf(ApiException.class);
    }

    @Test
    void descobertaNasLojasOficiais() {
        when(kit.dep(OfficialCatalogDiscovery.class).discover(any(), anyString(), anyString(), any(), anyList())).thenReturn(List.of(
                new OfficialCatalogDiscovery.Found("Nike Dunk Low", "Dunk Low", "white", "DUNK-1", "DUNK-1", null, "https://nike.com.br/p/dunk",
                        "https://nike.com.br/img/dunk.jpg", null, "leather"),
                new OfficialCatalogDiscovery.Found("Algo sem tipo", null, null, null, null, null, null, null, null, null)));
        Map<String, Object> r = catalog.discover(ana, new CatalogService.SearchRequest(null, "casual_sneakers", "Nike", "dunk", null, null));
        assertThat(r).containsEntry("status", "FOUND");
        assertThat(catalog.discover(ana, new CatalogService.SearchRequest(null, null, null, "qualquer", null, null))).containsEntry("status", "BRAND_UNKNOWN");
        Brand semFonte = kit.dep(BrandRepository.class).save(new Brand("Sem Fonte", CatalogNormalizer.get().brandSlug("Sem Fonte"), BrandSource.SEEDED));
        assertThat(catalog.discover(ana, new CatalogService.SearchRequest(null, null, semFonte.getName(), null, null, null))).containsEntry("status", "NO_OFFICIAL_SOURCE");
    }

    @Test
    void adicionarAoGuardaRoupaAPartirDoProduto() {
        CatalogProduct p = MemoryRepository.<CatalogProduct>rows(kit.dep(CatalogProductRepository.class)).get(0);
        p.setIngestionStatus(CatalogIngestionStatus.DISCOVERED);
        CatalogVariant v = MemoryRepository.<CatalogVariant>rows(kit.dep(CatalogVariantRepository.class)).get(0);
        WardrobeItem w = Kit.piece(user, p.getProductName(), "shoes_piece", "casual_sneakers", "white");
        WardrobeService wardrobe = kit.dep(WardrobeService.class);
        when(wardrobe.createFromCatalog(any(), any(), any())).thenReturn(Views.piece(w, null, null));
        when(wardrobe.toggles(any(), any(), any(), any(), any())).thenReturn(Views.piece(w, null, null));
        Views.PieceView view = catalog.addToWardrobe(ana, new CatalogService.AddRequest(p.getId(), v.getId(), "40", null, new BigDecimal("599"), null, null,
                true, false, null, null, null, null, null, null, null, "Meu AF1", null));
        assertThat(view.name()).isEqualTo(p.getProductName());
        assertThat(p.getIngestionStatus()).isEqualTo(CatalogIngestionStatus.REFERENCE_ONLY);
        assertThat(p.getOwnersCount()).isEqualTo(1);
        catalog.addToWardrobe(ana, new CatalogService.AddRequest(p.getId(), null, null, null, null, null, null, null, null, null, null,
                List.of("casual"), List.of("streetwear"), "black", "LEATHER", "FEMININO", " ", null));
        p.setIngestionStatus(CatalogIngestionStatus.REJECTED);
        assertThatThrownBy(() -> catalog.addToWardrobe(ana, new CatalogService.AddRequest(p.getId(), null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null))).isInstanceOf(ApiException.class);
        assertThat(CatalogService.orderScore(Map.of("matchScore", Map.of("total", 0.8)))).isLessThan(0.8);
    }
}
