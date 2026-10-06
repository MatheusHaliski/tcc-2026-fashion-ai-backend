package br.com.fashionai.application.catalog;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.domain.model.Brand;
import br.com.fashionai.domain.model.CatalogImage;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.CatalogSource;
import br.com.fashionai.domain.model.CatalogVariant;
import br.com.fashionai.domain.model.enums.BrandSource;
import br.com.fashionai.domain.model.enums.CatalogImageType;
import br.com.fashionai.domain.model.enums.CatalogImageUsage;
import br.com.fashionai.domain.model.enums.CatalogIngestionStatus;
import br.com.fashionai.domain.model.enums.CatalogSourceType;
import br.com.fashionai.domain.repository.BrandRepository;
import br.com.fashionai.domain.repository.CatalogImageRepository;
import br.com.fashionai.domain.repository.CatalogProductAliasRepository;
import br.com.fashionai.domain.repository.CatalogProductRepository;
import br.com.fashionai.domain.repository.CatalogSourceRepository;
import br.com.fashionai.domain.repository.CatalogVariantRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Ingestão do catálogo de marcas (RF47): o produto entra normalizado pela taxonomia (subcategoria → categoria, cor,
 * material, gênero), sem duplicar — GTIN, EAN, UPC, SKU, código, URL canônica ou o mesmo modelo em outra cor (variante)
 * —, com aliases para a busca e imagens só por HTTPS, guardadas apenas quando a fonte oficial permite.
 */
class CatalogIngestServiceTest {
    private Kit kit;
    private CatalogIngestService ingest;
    private Brand brand;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        ingest = kit.build(CatalogIngestService.class);
        brand = kit.dep(BrandRepository.class).save(new Brand("Marca Azul", CatalogNormalizer.get().brandSlug("Marca Azul"), BrandSource.SEEDED));
        CatalogSource official = new CatalogSource();
        official.setBrandId(brand.getId());
        official.setDomain("marcaazul.com.br");
        official.setSourceType(CatalogSourceType.OFFICIAL_BRAND);
        official.setAllowsImagePersistence(true);
        kit.dep(CatalogSourceRepository.class).save(official);
    }

    private CatalogIngestService.ProductInput tee(String model, String color, String sku, String gtin, String url) {
        return new CatalogIngestService.ProductInput("Marca Azul", "lower_piece", "t_shirt", "Camiseta Básica " + model, model, null, sku, gtin, null, null,
                color, color, "algodão", "Verão 26", "feminino", url, null,
                List.of(new CatalogIngestService.ImageInput("https://marcaazul.com.br/img/" + model + ".jpg", "front"),
                        new CatalogIngestService.ImageInput("https://cdn.outro.com/" + model + ".jpg", "inventado"),
                        new CatalogIngestService.ImageInput("http://inseguro.com/x.jpg", null)),
                List.of("camiseta azul", " "), List.of(new CatalogIngestService.VariantInput("white", "Branco", "CB-01-BR", null, null)));
    }

    @Test
    void produtoNovoNormalizadoComImagensEAliases() {
        CatalogIngestService.Result r = ingest.upsert(tee("CB-01", "navy", "SKU-1", "7890000000001", "https://marcaazul.com.br/p/cb-01?utm=x"),
                CatalogIngestionStatus.VALIDATED, false);
        assertThat(r.outcome()).isEqualTo(CatalogIngestService.Outcome.CREATED);
        assertThat(r.warnings()).anyMatch(w -> w.contains("upper_piece"));   // categoria corrigida pela subcategoria
        CatalogProduct p = r.product();
        assertThat(p.getCategory()).isEqualTo("upper_piece");
        assertThat(p.getSourceType()).isEqualTo(CatalogSourceType.OFFICIAL_BRAND);
        assertThat(p.getSearchText()).contains("marca azul").contains("camiseta azul");
        List<CatalogImage> imgs = MemoryRepository.rows(kit.dep(CatalogImageRepository.class));
        assertThat(imgs).hasSize(2);   // a http fica de fora
        assertThat(imgs).filteredOn(CatalogImage::isPrimary).hasSize(1);
        assertThat(imgs).extracting(CatalogImage::getUsageStatus).containsExactlyInAnyOrder(CatalogImageUsage.PERSISTED, CatalogImageUsage.REFERENCE_ONLY);
        assertThat(MemoryRepository.<CatalogVariant>rows(kit.dep(CatalogVariantRepository.class))).hasSize(1);
        assertThat(MemoryRepository.rows(kit.dep(CatalogProductAliasRepository.class))).hasSize(1);
        assertThat(CatalogIngestService.provenance(imgs.get(0))).containsKeys("sourceType", "usage");
    }

    @Test
    void naoDuplicaPorCodigoEOutraCorViraVariante() {
        CatalogIngestService.Result first = ingest.upsert(tee("CB-02", "navy", "SKU-2", "7890000000002", null), CatalogIngestionStatus.VALIDATED, false);
        // mesmo GTIN: atualiza
        CatalogIngestService.Result again = ingest.upsert(tee("CB-02", "navy", "SKU-2", "7890000000002", null), CatalogIngestionStatus.VALIDATED, false);
        assertThat(again.outcome()).isEqualTo(CatalogIngestService.Outcome.UPDATED);
        assertThat(again.product().getId()).isEqualTo(first.product().getId());
        // mesmo SKU, sem GTIN
        assertThat(ingest.upsert(tee("CB-02", "navy", "SKU-2", null, null), CatalogIngestionStatus.VALIDATED, false).product().getId())
                .isEqualTo(first.product().getId());
        // mesmo modelo em outra cor: entra como variante do mesmo produto
        CatalogIngestService.Result red = ingest.upsert(tee("CB-02", "red", null, null, null), CatalogIngestionStatus.VALIDATED, false);
        assertThat(red.product().getId()).isEqualTo(first.product().getId());
        assertThat(MemoryRepository.<CatalogProduct>rows(kit.dep(CatalogProductRepository.class))).hasSize(1);
        // a busca externa não sobrescreve um produto já curado
        assertThat(ingest.upsert(tee("CB-02", "navy", "SKU-2", "7890000000002", null), CatalogIngestionStatus.DISCOVERED, false).outcome())
                .isEqualTo(CatalogIngestService.Outcome.DUPLICATE);
        // código de variante também encontra o produto
        assertThat(ingest.upsert(new CatalogIngestService.ProductInput("Marca Azul", null, "t_shirt", "Outra", null, "CB-01-BR", null, null, null, null,
                null, null, null, null, null, null, null, null, null, null), CatalogIngestionStatus.VALIDATED, false).product()).isNotNull();
    }

    @Test
    void outrosCodigosEUrlCanonica() {
        CatalogIngestService.ProductInput withEan = new CatalogIngestService.ProductInput("marca azul", null, "jeans", "Calça Reta", null, "COD-9", null, null,
                "123456", "654321", null, "Azul médio", "denim", null, "unissex", "https://marcaazul.com.br/p/reta", "partner_api", null, null, null,
                "Calça jeans reta lavagem média", Map.of());
        CatalogProduct p = ingest.upsert(withEan, CatalogIngestionStatus.DISCOVERED, false).product();
        assertThat(ingest.upsert(withEan, CatalogIngestionStatus.VALIDATED, false).product().getIngestionStatus()).isEqualTo(CatalogIngestionStatus.VALIDATED);
        for (CatalogIngestService.ProductInput in : List.of(
                new CatalogIngestService.ProductInput("Marca Azul", null, "jeans", "Calça", null, null, null, null, "123456", null, null, null, null, null, null,
                        null, null, null, null, null),
                new CatalogIngestService.ProductInput("Marca Azul", null, "jeans", "Calça", null, null, null, null, null, "654321", null, null, null, null, null,
                        null, null, null, null, null),
                new CatalogIngestService.ProductInput("Marca Azul", null, "jeans", "Calça", null, "COD-9", null, null, null, null, null, null, null, null, null,
                        null, null, null, null, null),
                new CatalogIngestService.ProductInput("Marca Azul", null, "jeans", "Calça", null, null, null, null, null, null, null, null, null, null, null,
                        "https://marcaazul.com.br/p/reta", null, null, null, null))) {
            ingest.upsert(withEan, CatalogIngestionStatus.VALIDATED, false);   // a atualização regrava os códigos: restaura antes de cada busca
            assertThat(ingest.upsert(in, CatalogIngestionStatus.VALIDATED, false).product().getId()).as(String.valueOf(in.ean()) + in.upc() + in.productCode() + in.officialProductUrl()).isEqualTo(p.getId());
        }
    }

    @Test
    void marcaSubcategoriaENomeObrigatorios() {
        assertThatThrownBy(() -> ingest.upsert(new CatalogIngestService.ProductInput("Desconhecida", null, "t_shirt", "X", null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null), CatalogIngestionStatus.VALIDATED, false)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> ingest.upsert(new CatalogIngestService.ProductInput("Marca Azul", null, "foguete", "X", null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null), CatalogIngestionStatus.VALIDATED, false)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> ingest.upsert(new CatalogIngestService.ProductInput("Marca Azul", null, "t_shirt", " ", null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null), CatalogIngestionStatus.VALIDATED, false)).isInstanceOf(ApiException.class);
        assertThat(ingest.upsert(new CatalogIngestService.ProductInput("Marca Nova", null, "t_shirt", "Camiseta", null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null), CatalogIngestionStatus.VALIDATED, true).outcome()).isEqualTo(CatalogIngestService.Outcome.CREATED);
        assertThat(ingest.resolveBrand(" ", true)).isEmpty();
        assertThat(ingest.resolveBrand("Marca Azul", false)).isPresent();
    }

    @Test
    void entradaVindaDeJson() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("brand", "Marca Azul");
        m.put("subcategory", "dress");
        m.put("product_name", "Vestido Midi");
        m.put("primary_image_url", "https://marcaazul.com.br/img/midi.jpg");
        m.put("images", List.of(Map.of("url", "https://marcaazul.com.br/img/midi-costas.jpg", "type", "back"), "lixo"));
        m.put("aliases", List.of("vestido midi"));
        m.put("design", Map.of("pattern", "liso"));
        CatalogIngestService.ProductInput in = CatalogIngestService.fromMap(m);
        assertThat(in.images()).hasSize(2);
        assertThat(in.images().get(0).type()).isEqualTo("PACKSHOT");
        assertThat(ingest.upsert(in, CatalogIngestionStatus.VALIDATED, false).product().getProductName()).isEqualTo("Vestido Midi");
        assertThat(CatalogIngestService.imageType(null)).isEqualTo(CatalogImageType.PACKSHOT);
        assertThat(CatalogIngestService.imageType("nada")).isEqualTo(CatalogImageType.OTHER);
        assertThat(ingest.sourceType("errado", brand.getId(), null)).isEqualTo(CatalogSourceType.MANUAL_ADMIN);
    }
}
