package br.com.fashionai.application.service;

import br.com.fashionai.domain.model.enums.AiCallResult;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.ports.WebFetchPort;
import br.com.fashionai.domain.repository.BrandLogoRepository;
import br.com.fashionai.domain.repository.BrandRepository;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionTemplate;

import java.awt.image.BufferedImage;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Buscador de logos: Wikidata/Commons primeiro, IA com busca na web depois, ícone do site e, sem nada, monograma. */
class BrandLogoServiceTest {
    private static byte[] png(int w, int h) {
        return ImageOps.png(new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB));
    }

    private static WebFetchPort.Fetched json(String url, String body) {
        return new WebFetchPort.Fetched(url, "application/json; charset=utf-8", body.getBytes(StandardCharsets.UTF_8));
    }

    private static AiOutcome<Object> outcome(Object value) {
        return new AiOutcome<>(value, null, AiCallResult.FALLBACK_LOCAL, value == null, "local", "local", 0, BigDecimal.ZERO, null, null, null);
    }

    private record Env(BrandLogoService service, AiEngine ai, List<String> fetched) {
    }

    @SuppressWarnings("unchecked")
    private static Env env(java.util.function.Function<String, Optional<WebFetchPort.Fetched>> internet, Object aiValue) {
        List<String> fetched = new ArrayList<>();
        WebFetchPort web = (url, max, accept) -> {
            fetched.add(url);
            return internet.apply(url);
        };
        MediaService media = mock(MediaService.class);
        when(media.put(anyString(), any(), anyString())).thenAnswer(inv -> new MediaStoragePort.StoredObject(inv.getArgument(0),
                "http://localhost:8080/media/" + inv.getArgument(0), 1, inv.getArgument(2)));
        when(media.read(any())).thenReturn(Optional.empty());
        BrandRepository catalog = mock(BrandRepository.class);
        when(catalog.findAllByOrderByName()).thenReturn(List.of());
        AiEngine ai = mock(AiEngine.class);
        when(ai.text(any())).thenReturn((AiOutcome) outcome(aiValue));
        return new Env(new BrandLogoService(mock(BrandLogoRepository.class), catalog, web, media, ai, mock(TransactionTemplate.class)), ai, fetched);
    }

    @Test
    void findsOfficialLogoOnWikidataAndStoresItLocally() {
        Env e = env(url -> {
            if (url.contains("wbsearchentities")) {
                return Optional.of(json(url, "{\"search\":[{\"id\":\"Q1\",\"label\":\"Zara Home\",\"description\":\"home decor\"},"
                        + "{\"id\":\"Q147662\",\"label\":\"Zara\",\"description\":\"Spanish fashion retailer\"}]}"));
            }
            if (url.contains("EntityData/Q147662")) {
                return Optional.of(json(url, "{\"entities\":{\"Q147662\":{\"claims\":{"
                        + "\"P154\":[{\"mainsnak\":{\"datavalue\":{\"value\":\"Zara Logo.svg\"}}}],"
                        + "\"P856\":[{\"mainsnak\":{\"datavalue\":{\"value\":\"https://www.zara.com/\"}}}]}}}}"));
            }
            if (url.startsWith("https://commons.wikimedia.org/wiki/Special:FilePath/Zara_Logo.svg")) {
                return Optional.of(new WebFetchPort.Fetched(url, "image/png", png(200, 80)));
            }
            return Optional.empty();
        }, null);
        BrandLogoService.Found f = e.service().search("zara", "Zara");
        assertThat(f.source()).isEqualTo("WIKIDATA");
        assertThat(f.domain()).isEqualTo("zara.com");
        assertThat(f.url()).startsWith("http://localhost:8080/media/brands/logos/zara-wikidata.png");
        // "Zara Home" (decoração) não é a marca de moda procurada
        assertThat(e.fetched()).noneMatch(u -> u.contains("EntityData/Q1."));
        verify(e.ai(), never()).text(any());
    }

    @Test
    void asksTheAiWithWebSearchWhenWikidataHasNothing() {
        Env e = env(url -> url.equals("https://cdn.farmrio.com.br/logo.png")
                ? Optional.of(new WebFetchPort.Fetched(url, "image/png", png(300, 120))) : Optional.empty(),
                new BrandLogoService.AiHint("farmrio.com.br", "https://cdn.farmrio.com.br/logo.png", 0.9));
        BrandLogoService.Found f = e.service().search("farm", "Farm");
        assertThat(f.source()).isEqualTo("IA_BUSCA_WEB");
        assertThat(f.domain()).isEqualTo("farmrio.com.br");
        assertThat(f.originUrl()).isEqualTo("https://cdn.farmrio.com.br/logo.png");
        verify(e.ai()).text(any());
    }

    @Test
    void fallsBackToTheOfficialSiteIconThenToMonogram() {
        Env site = env(url -> url.equals("https://farmrio.com.br/apple-touch-icon.png")
                ? Optional.of(new WebFetchPort.Fetched(url, "image/png", png(180, 180))) : Optional.empty(),
                new BrandLogoService.AiHint("farmrio.com.br", "https://farmrio.com.br/nao-e-imagem", 0.8));
        assertThat(site.service().search("farm", "Farm").source()).isEqualTo("FAVICON_SITE");

        Env offline = env(url -> Optional.empty(), null);
        BrandLogoService.Found none = offline.service().search("marca inventada", "Marca Inventada");
        assertThat(none.url()).isNull();
        assertThat(none.source()).isEqualTo("MONOGRAMA");
        assertThat(none.error()).contains("Wikidata inacessível", "IA");
    }

    @Test
    void rejectsTinyImagesAndThirdPartySvg() {
        Env e = env(url -> url.endsWith("tiny.png") ? Optional.of(new WebFetchPort.Fetched(url, "image/png", png(8, 8)))
                : url.endsWith(".svg") ? Optional.of(new WebFetchPort.Fetched(url, "image/svg+xml", "<svg onload=alert(1)/>".getBytes()))
                : Optional.empty(), null);
        assertThat(e.service().download("x", "https://x.com/tiny.png", "ia")).isEmpty();
        assertThat(e.service().download("x", "https://x.com/logo.svg", "ia")).isEmpty();
    }

    @Test
    void namesDomainsAndMonogramsAreNormalized() {
        assertThat(BrandLogoService.keyOf("  Levi's® Strauss & Co. ")).isEqualTo("levi s strauss and co");
        assertThat(BrandLogoService.keyOf("Animale")).isEqualTo(BrandLogoService.keyOf("ANIMALE"));
        assertThat(BrandLogoService.keyOf("Hering Básicos")).isEqualTo("hering basicos");
        assertThat(BrandLogoService.domainOf("https://www.Zara.com/br/pt/")).isEqualTo("zara.com");
        assertThat(BrandLogoService.domainOf("nike.com")).isEqualTo("nike.com");
        assertThat(BrandLogoService.domainOf("não é url")).isNull();
        Map<String, Object> m = BrandLogoService.monogram("Maison Lune");
        assertThat(m.get("initials")).isEqualTo("ML");
        assertThat(BrandLogoService.monogram("maison lune").get("color")).isEqualTo(m.get("color"));
    }
}
