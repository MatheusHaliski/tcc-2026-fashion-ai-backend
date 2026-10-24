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
import br.com.fashionai.domain.model.CatalogImage;
import br.com.fashionai.domain.model.CatalogSource;
import br.com.fashionai.domain.model.CatalogVariant;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.BrandSource;
import br.com.fashionai.domain.model.enums.CatalogIngestionStatus;
import br.com.fashionai.domain.model.enums.CatalogImageUsage;
import br.com.fashionai.domain.model.enums.CatalogImageType;
import br.com.fashionai.domain.model.enums.CatalogSourceType;
import br.com.fashionai.domain.repository.BrandAliasRepository;
import br.com.fashionai.domain.repository.BrandRepository;
import br.com.fashionai.domain.repository.CatalogProductRepository;
import br.com.fashionai.domain.repository.CatalogImageRepository;
import br.com.fashionai.domain.repository.CatalogSourceRepository;
import br.com.fashionai.domain.repository.CatalogVariantRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
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
        // a consulta agrupada da grade de marcas é nativa: o repositório em memória devolve o que o banco agruparia
        lenient().when(products.visibleCountsByBrandAndCategory()).thenAnswer(i -> visible(null).stream()
                .collect(java.util.stream.Collectors.groupingBy(p -> List.of(p.getBrandId().toString(), p.getCategory()), java.util.stream.Collectors.counting()))
                .entrySet().stream().map(e -> new Object[]{e.getKey().get(0), e.getKey().get(1), e.getValue()}).toList());
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
    void productCardPreservesFittingAttributesAlreadyStoredInTheCatalogue() {
        CatalogProduct p = visible(null).getFirst();
        p.setVariationCode("SLIM");
        br.com.fashionai.domain.model.TaxonomyAttribute.replace(p.getAttributes(), "RISE", List.of("HIGH_RISE"), "CATALOG", null);
        br.com.fashionai.domain.model.TaxonomyAttribute.replace(p.getAttributes(), "CLOSURE", List.of("ZIPPER"), "CATALOG", null);
        br.com.fashionai.domain.model.TaxonomyAttribute.replace(p.getAttributes(), "SLEEVE_LENGTH", List.of("SHORT_SLEEVE"), "CATALOG", null);
        Map<String, Object> card = catalog.card(p, nike, null);
        assertThat(card).containsEntry("variation", "SLIM");
        assertThat(map(card.get("attributes"))).containsEntry("RISE", List.of("HIGH_RISE"))
                .containsEntry("CLOSURE", List.of("ZIPPER")).containsEntry("SLEEVE_LENGTH", List.of("SHORT_SLEEVE"));
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
    void fotoRecusadaPelaRevisaoNaoApareceMesmoSePrincipalOuCanonica() {
        UUID productId = UUID.randomUUID();
        CatalogImage rejected = new CatalogImage();
        rejected.setProductId(productId);
        rejected.setImageUrl("https://nike.com.br/rejected.jpg");
        rejected.setReviewStatus("REJECTED");
        CatalogImage valid = new CatalogImage();
        valid.setProductId(productId);
        valid.setImageUrl("https://nike.com.br/valid.jpg");
        CatalogImageRepository images = kit.dep(CatalogImageRepository.class);
        when(images.findByProductIdInAndPrimaryTrue(anyList())).thenReturn(List.of(rejected));
        when(images.findByProductIdInAndCanonicalTrue(anyList())).thenReturn(List.of(rejected));
        when(images.findByProductIdIn(anyList())).thenReturn(List.of(rejected, valid));
        assertThat(catalog.mainImages(List.of(productId))).containsEntry(productId, valid);
    }

    @Test
    void validAlternativeWinsOverSmallCanonicalWithoutExcludingTheProduct() {
        CatalogProduct p=visible(null).getFirst();
        CatalogImage small=new CatalogImage(); small.assignId(UUID.randomUUID()); small.setProductId(p.getId());
        small.setImageUrl("https://nike.com.br/small.jpg"); small.setSourceSha256("a".repeat(64)); small.setCanonical(true);
        CatalogImage valid=new CatalogImage(); valid.assignId(UUID.randomUUID()); valid.setProductId(p.getId());
        valid.setImageUrl("https://nike.com.br/valid.jpg"); valid.setSourceSha256("b".repeat(64));
        for (CatalogImage image : List.of(small,valid)) {
            image.setSourceType(CatalogSourceType.OFFICIAL_BRAND);
            image.setSourceDomain("nike.com.br"); image.setSourceUrl(p.getOfficialProductUrl());
            image.setImageType(CatalogImageType.PACKSHOT); image.setUsageStatus(CatalogImageUsage.PERSISTED);
            image.setImageUrlHash(br.com.fashionai.application.catalog.image.CatalogImagePipeline.sha256(image.getImageUrl()));
            image.setRetrievedAt(Instant.parse("2026-10-23T00:00:00Z")); image.setLastVerifiedAt(image.getRetrievedAt());
            Map<String,Object> state=new java.util.LinkedHashMap<>();
            state.put("version","CATALOG_PHOTO_SET_V2"); state.put("sourceUrl",image.getImageUrl());
            state.put("sourceSha256",image.getSourceSha256()); state.put("category",p.getCategory());
            state.put("subcategory",p.getSubcategory()); state.put("color",p.getColor());
            state.put("status",image==valid ? "READY" : "INELIGIBLE");
            state.put("defaultAssetUrl","/api/catalog/default-asset?category="+p.getCategory());
            state.put("wholeUrl","https://media.example/whole.png");state.put("fabricUrl","https://media.example/fabric.png");
            state.put("metrics",Map.of("preflight",Map.of("version","CATALOG_SOURCE_PREFLIGHT_V1","status","PASS",
                    "sourceGarmentHeightFraction",.25,"measurementReliable",true,"complete",true,"occluded",false,
                    "isolationVerified",true,"humanAssessmentComplete",true)));
            image.setAssetsJson(br.com.fashionai.application.common.Json.write(Map.of("photoSet",state)));
        }
        CatalogImageRepository images=kit.dep(CatalogImageRepository.class);
        when(images.findByProductIdInAndPrimaryTrue(anyList())).thenReturn(List.of(small));
        when(images.findByProductIdInAndCanonicalTrue(anyList())).thenReturn(List.of(small));
        when(images.findByProductIdIn(anyList())).thenReturn(List.of(small,valid));
        assertThat(catalog.mainImagesFor(List.of(p))).containsEntry(p.getId(),valid);
        assertThat(CatalogPhotoEligibility.excluded(p)).isFalse();
        assertThat(catalog.product(p.getId())).containsEntry("id",p.getId());
    }

    @Test
    void legacyProductStillOpensWhileAnAuditedProductExclusionBlocksItsDetail() {
        CatalogProduct p=visible(null).getFirst();
        assertThat(catalog.product(p.getId())).containsEntry("id",p.getId());
        p.setMetadataJson(br.com.fashionai.application.common.Json.write(Map.of("catalogPhotoEligibility",Map.of("state","REVIEW"))));
        assertThat(catalog.product(p.getId())).containsEntry("id",p.getId());
        p.setMetadataJson(br.com.fashionai.application.common.Json.write(Map.of("catalogPhotoEligibility",Map.of("state","INELIGIBLE"))));
        assertThat(catalog.product(p.getId())).containsEntry("id",p.getId());
        p.setMetadataJson(br.com.fashionai.application.common.Json.write(Map.of("catalogPhotoEligibility",Map.of(
                "state","INELIGIBLE","version","CATALOG_UNSAFE_QUARANTINE_V2","algorithmVersion","CATALOG_SOURCE_PREFLIGHT_V1",
                "reason","SOURCE_GARMENT_BELOW_MIN_HEIGHT","reportSha256","a".repeat(64),"evidenceSha256","b".repeat(64)))));
        assertThatThrownBy(() -> catalog.product(p.getId())).isInstanceOf(ApiException.class);
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
    void gradeDeMarcasContaTodasAsPecasEmUmaConsultaAgrupada() {
        Brand adidas = kit.dep(BrandRepository.class).save(new Brand("Adidas", CatalogNormalizer.get().brandSlug("Adidas"), BrandSource.SEEDED));
        kit.dep(BrandRepository.class).save(new Brand("Sem Peças", CatalogNormalizer.get().brandSlug("Sem Peças"), BrandSource.SEEDED));
        CatalogProductRepository products = kit.dep(CatalogProductRepository.class);
        when(products.visibleCountsByBrandAndCategory()).thenReturn(List.of(
                new Object[]{nike.getId().toString(), "shoes_piece", 2L}, new Object[]{nike.getId().toString(), "upper_piece", 2L},
                new Object[]{adidas.getId().toString(), "upper_piece", 7000L}));
        List<Map<String, Object>> grid = catalog.catalogBrands();
        assertThat(grid).extracting(m -> m.get("name")).containsExactly("Adidas", "Nike");
        assertThat(grid.get(0)).containsEntry("catalogProducts", 7000L).containsEntry("categories", List.of("upper_piece"));
        assertThat(grid.get(1)).containsEntry("catalogProducts", 4L).containsEntry("categories", List.of("shoes_piece", "upper_piece"));
        assertThat(map(grid.get(1).get("categoryCounts"))).containsEntry("shoes_piece", 2L).containsEntry("upper_piece", 2L);
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

    @Test
    void pecaGuardadaPeloProvadorSemTamanhoPassaNaValidacao() {
        // o Provador manda só produto e variante: o tamanho tem de sair válido, senão "Corrija os campos destacados"
        assertThat(CatalogService.sizeOf(null, "upper_piece")).isEqualTo("m");
        assertThat(CatalogService.sizeOf(" ", "shoes_piece")).isEqualTo("one_size");
        assertThat(CatalogService.sizeOf(null, "accessory_piece")).isEqualTo("one_size");
        assertThat(CatalogService.sizeOf("M", "upper_piece")).isEqualTo("m");
        assertThat(CatalogService.sizeOf("40", "shoes_piece")).isEqualTo("shoe_40");
        assertThat(CatalogService.sizeOf("40", "lower_piece")).isEqualTo("br_40");
        assertThat(CatalogService.sizeOf("br_38", "lower_piece")).isEqualTo("br_38");
        assertThat(CatalogService.sizeOf("gigante", "lower_piece")).isEqualTo("m");
        org.mockito.ArgumentCaptor<WardrobeService.PieceForm> form = org.mockito.ArgumentCaptor.forClass(WardrobeService.PieceForm.class);
        CatalogProduct p = MemoryRepository.<CatalogProduct>rows(kit.dep(CatalogProductRepository.class)).get(0);
        WardrobeService wardrobe = kit.dep(WardrobeService.class);
        when(wardrobe.createFromCatalog(any(), form.capture(), any())).thenReturn(Views.piece(Kit.piece(user, "x", "shoes_piece", "casual_sneakers", "white"), null, null));
        catalog.addToWardrobe(ana, new CatalogService.AddRequest(p.getId(), null, null, null, null, null, null, null, null, null,
                br.com.fashionai.domain.model.enums.Visibility.PRIVATE, null, null, null, null, null, null, null));
        WardrobeService.PieceForm f = form.getValue();
        assertThat(br.com.fashionai.application.taxonomy.Taxonomy.pieceErrors(f.category(), f.subcategory(), f.sex(), f.color(),
                f.material(), f.size(), f.occasion(), f.style())).doesNotContainKey("size");
    }

    @Test
    void acervoInteiroPaginadoComTotalRealEResumo() {
        CatalogProductRepository products = kit.dep(CatalogProductRepository.class);
        List<CatalogProduct> all = MemoryRepository.rows(products);
        // o repositório em memória não executa a consulta nativa: a página vem estubada como o banco devolveria
        java.util.List<String> lastWords = new java.util.ArrayList<>();
        when(products.browse(any(), any(), any(), any(), any(), any(), any(), any(), any())).thenAnswer(inv -> {
            org.springframework.data.domain.Pageable pg = inv.getArgument(8);
            lastWords.clear();
            for (int i = 3; i <= 5; i++) {
                if (inv.getArgument(i) != null) {
                    lastWords.add(inv.getArgument(i));
                }
            }
            String brandId = inv.getArgument(0);
            List<CatalogProduct> rows = all.stream().filter(p -> brandId == null || p.getBrandId().toString().equals(brandId)).toList();
            int from = (int) Math.min(pg.getOffset(), rows.size()), to = Math.min(from + pg.getPageSize(), rows.size());
            return new org.springframework.data.domain.PageImpl<>(rows.subList(from, to), pg, rows.size());
        });
        when(products.countVisible()).thenReturn((long) all.size());
        when(products.countVisibleWithImage()).thenReturn((long) all.size());
        Map<String, Object> page = catalog.browse(new CatalogService.BrowseRequest("Nike", null, null, null, 0, 1));
        assertThat(page).containsEntry("total", (long) all.size()).containsEntry("page", 0).containsEntry("size", 1).containsEntry("brandKnown", true);
        assertThat((List<?>) page.get("items")).hasSize(1);
        assertThat(map(((List<?>) page.get("items")).get(0))).containsKeys("productName", "variants", "source");
        assertThat(page.get("hasMore")).isEqualTo(all.size() > 1);
        Map<String, Object> last = catalog.browse(new CatalogService.BrowseRequest("Nike", null, null, null, all.size(), 1));
        assertThat((List<?>) last.get("items")).isEmpty();
        assertThat(last).containsEntry("hasMore", false);
        assertThat(catalog.browse(new CatalogService.BrowseRequest("Marca Inexistente", null, null, null, 0, 48))).containsEntry("brandKnown", false).containsEntry("total", 0L);
        assertThat(catalog.browse(new CatalogService.BrowseRequest(null, null, null, null, 0, 500))).containsEntry("size", CatalogService.BROWSE_MAX_SIZE);
        // a grade manda o id da marca; id inexistente não cai em outra marca
        assertThat(catalog.browse(new CatalogService.BrowseRequest(null, null, null, null, 0, 48, nike.getId().toString()))).containsEntry("brandKnown", true)
                .containsEntry("total", (long) all.size());
        assertThat(catalog.browse(new CatalogService.BrowseRequest("Nike", null, null, null, 0, 48, UUID.randomUUID().toString())))
                .containsEntry("brandKnown", false).containsEntry("total", 0L);
        // "ver todas" com texto: até três palavras, normalizadas, todas exigidas
        catalog.browse(new CatalogService.BrowseRequest(null, null, null, "Calça  jeans azul escura", 0, 48));
        assertThat(lastWords).containsExactly("%calca%", "%jeans%", "%azul%");
        Map<String, Object> summary = catalog.summary();
        assertThat(summary).containsEntry("products", (long) all.size()).containsEntry("brands", 1).containsEntry("withImage", (long) all.size());
    }
    @Test
    @SuppressWarnings("unchecked")
    void productResponseAndSavedPieceUseTheSelectedVariantPhotoNotGlobalCanonical() {
        CatalogProduct p=visible(null).getFirst();p.setColor("white");
        CatalogVariant base=kit.dep(CatalogVariantRepository.class).findByProductIdOrderByVariantKey(p.getId()).getFirst();
        base.setColor("white");
        // Ingestion seeds both the product code and explicit SKU as variants; this scenario
        // deliberately has one proven base color and one alternate color.
        kit.dep(CatalogVariantRepository.class).findByProductIdOrderByVariantKey(p.getId()).stream()
                .filter(v->!base.getId().equals(v.getId())).forEach(kit.dep(CatalogVariantRepository.class)::delete);
        CatalogVariant alternate=new CatalogVariant();alternate.setProductId(p.getId());alternate.setVariantKey("red");alternate.setColor("red");
        alternate=kit.dep(CatalogVariantRepository.class).save(alternate);
        CatalogImage canonical=kit.dep(CatalogImageRepository.class).findByProductIdOrderByPrimaryDescCreatedAtAsc(p.getId()).getFirst();
        canonical.setVariantId(null);canonical.setPrimary(true);canonical.setCanonical(true);canonical.setSourceSha256("a".repeat(64));
        CatalogImage selected=new CatalogImage();selected.assignId(UUID.randomUUID());selected.setProductId(p.getId());selected.setVariantId(alternate.getId());
        selected.setImageUrl("https://nike.com.br/red.png");selected.setSourceSha256("b".repeat(64));selected.setSourceType(CatalogSourceType.OFFICIAL_BRAND);
        selected.setSourceDomain("nike.com.br");selected.setSourceUrl(p.getOfficialProductUrl());selected.setImageType(CatalogImageType.FRONT);
        selected.setUsageStatus(CatalogImageUsage.PERSISTED);selected.setRetrievedAt(Instant.parse("2026-10-23T00:00:00Z"));
        for(CatalogImage image:List.of(canonical,selected)) {
            String name=image==canonical?"white":"red";
            Map<String,Object> proof=new java.util.LinkedHashMap<>();proof.put("version","CATALOG_PHOTO_SET_V2");proof.put("status","READY");
            proof.put("sourceUrl",image.getImageUrl());proof.put("sourceSha256",image.getSourceSha256());proof.put("category",p.getCategory());
            proof.put("subcategory",p.getSubcategory());proof.put("color",name);proof.put("variantId",image.getVariantId());
            proof.put("defaultAssetUrl","/api/catalog/default-asset?category="+p.getCategory());
            proof.put("wholeUrl","https://media.example/"+name+"-whole.png");proof.put("fabricUrl","https://media.example/"+name+"-fabric.png");
            proof.put("metrics",Map.of("preflight",Map.of("version","CATALOG_SOURCE_PREFLIGHT_V1","status","PASS",
                    "sourceGarmentHeightFraction",.5,"measurementReliable",true,"complete",true,"occluded",false,
                    "isolationVerified",true,"humanAssessmentComplete",true)));
            image.setAssetsJson(br.com.fashionai.application.common.Json.write(Map.of("photoSet",proof)));
        }
        kit.dep(CatalogImageRepository.class).save(selected);
        Map<String,Object> response=catalog.product(p.getId(),alternate.getId(),selected.getId());
        assertThat(response).containsEntry("color","red").containsEntry("colorHex",br.com.fashionai.application.taxonomy.Taxonomy.hex("red"));
        assertThat((Map<String,Object>)response.get("selectedVariant")).containsEntry("id",alternate.getId());
        assertThat((Map<String,Object>)response.get("catalogImage")).containsEntry("variantId",alternate.getId())
                .containsEntry("imageId",selected.getId()).containsEntry("url","https://media.example/red-fabric.png");
        assertThat((Map<String,Object>)((List<?>)response.get("images")).stream().map(Map.class::cast)
                .filter(i->canonical.getId().equals(i.get("id"))).findFirst().orElseThrow()).containsEntry("variantId",base.getId());
        Map<String,Object> found=searchResult(p,"red");
        assertThat(found).containsEntry("color","red").containsEntry("imageUrl","https://media.example/red-fabric.png");
        assertThat(map(found.get("selectedVariant"))).containsEntry("id",alternate.getId());
        assertThat(map(found.get("catalogImage"))).containsEntry("variantId",alternate.getId()).containsEntry("imageId",selected.getId());
        UUID alternateId=alternate.getId();
        assertThatThrownBy(()->catalog.product(p.getId(),alternateId,canonical.getId())).isInstanceOf(ApiException.class);
        assertThat(canonical.isCanonical()).isTrue();assertThat(selected.isCanonical()).isFalse();
        org.mockito.ArgumentCaptor<WardrobeService.CatalogPick> picked=org.mockito.ArgumentCaptor.forClass(WardrobeService.CatalogPick.class);
        when(kit.dep(WardrobeService.class).createFromCatalog(any(),any(),picked.capture()))
                .thenReturn(Views.piece(Kit.piece(user,"Red product",p.getCategory(),p.getSubcategory(),"red"),null,null));
        catalog.addToWardrobe(ana,new CatalogService.AddRequest(p.getId(),alternateId,null,null,null,null,null,null,null,null,
                br.com.fashionai.domain.model.enums.Visibility.PRIVATE,null,null,null,null,null,null,null));
        assertThat(picked.getValue().variantId()).isEqualTo(alternateId);
        assertThat(picked.getValue().imageUrl()).isEqualTo("https://media.example/red-fabric.png");
        assertThat(picked.getValue().catalogImage()).containsEntry("variantId",alternateId).containsEntry("sourceUrl",selected.getImageUrl());

        canonical.setCanonical(false);selected.setCanonical(true);
        Map<String,Object> defaultSelection=catalog.product(p.getId());
        assertThat(defaultSelection).containsEntry("color","red").containsEntry("imageUrl","https://media.example/red-fabric.png");
        assertThat(map(defaultSelection.get("selectedVariant"))).containsEntry("id",alternateId);
        assertThat(map(catalog.cards(List.of(p)).getFirst().get("catalogImage"))).containsEntry("variantId",alternateId);
        catalog.addToWardrobe(ana,new CatalogService.AddRequest(p.getId(),null,null,null,null,null,null,null,null,null,
                br.com.fashionai.domain.model.enums.Visibility.PRIVATE,null,null,null,null,null,null,null));
        assertThat(picked.getValue().variantId()).isEqualTo(alternateId);
        assertThat(picked.getValue().imageUrl()).isEqualTo("https://media.example/red-fabric.png");
        canonical.setCanonical(true);selected.setCanonical(false);

        kit.dep(CatalogImageRepository.class).delete(selected);
        assertThat(catalog.product(p.getId(),alternateId,null)).containsEntry("color","red").containsEntry("imageUrl",null).containsEntry("catalogImage",null);
        Map<String,Object> withoutRedPhoto=searchResult(p,"red");
        assertThat(withoutRedPhoto).containsEntry("color","red").containsEntry("imageUrl",null).containsEntry("catalogImage",null);
        assertThat(map(withoutRedPhoto.get("selectedVariant"))).containsEntry("id",alternateId);
        catalog.addToWardrobe(ana,new CatalogService.AddRequest(p.getId(),alternateId,null,null,null,null,null,null,null,null,
                br.com.fashionai.domain.model.enums.Visibility.PRIVATE,null,null,null,null,null,null,null));
        assertThat(picked.getValue().variantId()).isEqualTo(alternateId);
        assertThat(picked.getValue().imageUrl()).isNull();
    }

    @Test
    void orphanVariantCanonicalNeverBecomesTheProductPhotoOrAnAvailableImage() {
        CatalogProduct p=visible(null).getFirst();
        CatalogImage primary=kit.dep(CatalogImageRepository.class).findByProductIdOrderByPrimaryDescCreatedAtAsc(p.getId()).getFirst();
        CatalogImage orphan=new CatalogImage();orphan.setProductId(p.getId());orphan.setVariantId(UUID.randomUUID());
        orphan.setImageUrl("https://nike.com.br/orphan.png");orphan.setImageType(CatalogImageType.FRONT);
        orphan.setUsageStatus(CatalogImageUsage.PERSISTED);orphan.setCanonical(true);orphan.setSourceType(CatalogSourceType.OFFICIAL_BRAND);
        orphan.setProcessingStatus("APPROVED");orphan.setSourceSha256("c".repeat(64));
        kit.dep(CatalogImageRepository.class).save(orphan);
        assertThat(catalog.mainImagesFor(List.of(p))).containsEntry(p.getId(),primary);
        Map<String,Object> response=catalog.product(p.getId());
        assertThat(((List<?>)response.get("images")).stream().map(CatalogServiceTest::imageId)).doesNotContain(orphan.getId());
        assertThatThrownBy(()->catalog.product(p.getId(),null,orphan.getId())).isInstanceOf(ApiException.class);
    }

    @Test
    void pendingVariantPhotoStillCarriesItsVariantAndColorBeforePreviewIsReady() {
        CatalogProduct p=visible(null).getFirst();p.setColor("white");
        CatalogVariant red=new CatalogVariant();red.setProductId(p.getId());red.setVariantKey("red");red.setColor("red");
        kit.dep(CatalogVariantRepository.class).save(red);
        CatalogImage image=kit.dep(CatalogImageRepository.class).findByProductIdOrderByPrimaryDescCreatedAtAsc(p.getId()).getFirst();
        image.setCanonical(true);image.setVariantId(red.getId());image.setProcessingStatus("PENDING");
        Map<String,Object> response=catalog.product(p.getId());
        assertThat(response).containsEntry("color","red").containsEntry("catalogImage",null);
        assertThat(map(response.get("selectedVariant"))).containsEntry("id",red.getId());
        red.setColor(null);
        assertThat(catalog.product(p.getId())).containsEntry("color","white");
        red.setColor("");
        assertThat(catalog.product(p.getId())).containsEntry("color","");
    }

    private Map<String,Object> searchResult(CatalogProduct product,String color) {
        Map<String,Object> response=catalog.search(new CatalogService.SearchRequest(product.getCategory(),product.getSubcategory(),"Nike",product.getModelName(),color,24));
        return ((List<?>)response.get("results")).stream().map(br.com.fashionai.application.testkit.World::map)
                .filter(item->product.getId().equals(item.get("id"))).findFirst().orElseThrow();
    }

    private static Object imageId(Object image) { return map(image).get("id"); }

}
