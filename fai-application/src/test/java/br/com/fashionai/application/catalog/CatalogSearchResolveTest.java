package br.com.fashionai.application.catalog;

import br.com.fashionai.application.service.WardrobeService;
import br.com.fashionai.domain.repository.BrandAliasRepository;
import br.com.fashionai.domain.repository.BrandRepository;
import br.com.fashionai.domain.repository.CatalogImageRepository;
import br.com.fashionai.domain.repository.CatalogProductAliasRepository;
import br.com.fashionai.domain.repository.CatalogProductRepository;
import br.com.fashionai.domain.repository.CatalogSourceRepository;
import br.com.fashionai.domain.repository.CatalogVariantRepository;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** RF47 · Leitura do texto da busca e o pool de candidatos com o catálogo grande (milhares de produtos). */
class CatalogSearchResolveTest {
    private final CatalogProductRepository products = mock(CatalogProductRepository.class);
    private final CatalogIngestService ingest = mock(CatalogIngestService.class);
    private final CatalogService service = new CatalogService(products, mock(CatalogVariantRepository.class), mock(CatalogImageRepository.class),
            mock(CatalogProductAliasRepository.class), mock(CatalogSourceRepository.class), mock(BrandRepository.class),
            mock(BrandAliasRepository.class), ingest, mock(OfficialCatalogDiscovery.class), mock(WardrobeService.class));

    {
        when(ingest.resolveBrand(anyString(), anyBoolean())).thenReturn(java.util.Optional.empty());
    }

    @Test
    void subtipoPelaFraseMaisLonga() {
        CatalogMatchScorer.Intent q = service.resolve(new CatalogService.SearchRequest("upper_piece", null, null, "moletom com capuz preto", null, null)).intent();
        assertThat(q.subcategory()).isEqualTo("hoodie");                 // não "moletom" (sweatshirt)
        assertThat(q.color()).isEqualTo("black");
        assertThat(q.keywords()).doesNotContain("capuz", "moletom");
    }

    @Test
    void palavraSoltaContinuaFuncionando() {
        CatalogMatchScorer.Intent q = service.resolve(new CatalogService.SearchRequest("upper_piece", null, null, "camiseta azul", null, null)).intent();
        assertThat(q.subcategory()).isEqualTo("t_shirt");
        assertThat(q.color()).isEqualTo("blue");
        assertThat(q.keywords()).isEmpty();
    }

    @Test
    void poolComecaPeloSubtipoComCorEPelaEstampa() {
        service.search(new CatalogService.SearchRequest("upper_piece", null, null, "camiseta azul", null, null));
        // subtipo lido do texto + cor pedida (no produto ou numa variante) entram no pool antes do pool geral
        verify(products).candidatesWithColor(isNull(), eq("upper_piece"), eq("t_shirt"), eq("blue"), isNull());
        verify(products).candidates(isNull(), eq("upper_piece"), eq("t_shirt"), isNull());
        verify(products, atLeastOnce()).candidates(isNull(), eq("upper_piece"), isNull(), isNull());   // pool geral (e o reforço com pool pequeno)

        service.search(new CatalogService.SearchRequest("upper_piece", null, null, "camiseta listrada", null, null));
        verify(products).candidates(isNull(), eq("upper_piece"), eq("t_shirt"), org.mockito.ArgumentMatchers.contains("stripe"));
    }

    @Test
    void comFotoPassaNaFrenteQuandoAsNotasSaoProximas() {
        java.util.Map<String, Object> semFoto = java.util.Map.of("matchScore", java.util.Map.of("total", 1.0));
        java.util.Map<String, Object> comFoto = new java.util.HashMap<>(java.util.Map.of("matchScore", java.util.Map.of("total", 0.93), "imageUrl", "https://x/a.jpg"));
        java.util.Map<String, Object> longe = new java.util.HashMap<>(java.util.Map.of("matchScore", java.util.Map.of("total", 0.80), "imageUrl", "https://x/b.jpg"));
        assertThat(CatalogService.orderScore(comFoto)).isGreaterThan(CatalogService.orderScore(semFoto));   // 93% com foto › 100% sem
        assertThat(CatalogService.orderScore(semFoto)).isGreaterThan(CatalogService.orderScore(longe));     // mas não passa 20 pontos
    }

    @Test
    void palavrasDaEstampaNoVocabulario() {
        assertThat(service.patternTerms("STRIPES")).contains("listrada", "stripe", "rayas");
        assertThat(service.patternTerms("PLAIN")).isNull();
        assertThat(service.patternTerms(null)).isNull();
    }
}
