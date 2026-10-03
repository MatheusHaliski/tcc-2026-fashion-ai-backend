package br.com.fashionai.application.catalog;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class OfficialCatalogDiscoveryTest {
    @Test
    void soAceitaProdutosDeDominiosOficiais() {
        String json = """
                {"products":[
                 {"productName":"Polo L.12.12","productUrl":"https://www.lacoste.com/br/polo-l1212.html","imageUrl":"https://image1.lacoste.com/p.jpg"},
                 {"productName":"Polo verde","productUrl":"https://www.pinterest.com/pin/123","imageUrl":"https://i.pinimg.com/x.jpg"},
                 {"productName":"Polo","productUrl":"http://www.lacoste.com/insecure"},
                 {"productName":"","productUrl":"https://www.lacoste.com/sem-nome"}]}""";
        List<OfficialCatalogDiscovery.Found> found = OfficialCatalogDiscovery.parse(json, List.of("lacoste.com"));
        assertThat(found).extracting(OfficialCatalogDiscovery.Found::productName).containsExactly("Polo L.12.12");
    }

    @Test
    void imagemSoDeDominioOuCdnDaMarca() {
        assertThat(OfficialCatalogDiscovery.imageAllowed("https://static.nike.com/a.png", List.of("nike.com.br"))).isTrue();
        assertThat(OfficialCatalogDiscovery.imageAllowed("https://i.pinimg.com/a.png", List.of("nike.com"))).isFalse();
        assertThat(OfficialCatalogDiscovery.imageAllowed("http://static.nike.com/a.png", List.of("nike.com"))).isFalse();
        assertThat(OfficialCatalogDiscovery.brandLabel("lojasrenner.com.br")).isEqualTo("lojasrenner");
    }

    @Test
    void respostaInvalidaNaoInventaResultado() {
        assertThat(OfficialCatalogDiscovery.parse("sem json", List.of("nike.com"))).isNull();
        assertThat(OfficialCatalogDiscovery.parse("{\"products\":[]}", List.of("nike.com"))).isEmpty();
    }
}
