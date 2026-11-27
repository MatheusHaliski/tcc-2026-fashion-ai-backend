package br.com.fashionai.application.catalog;

import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.domain.model.CatalogProductModel3d;
import br.com.fashionai.domain.model.enums.CatalogModelStatus;
import br.com.fashionai.domain.repository.CatalogProductModel3dRepository;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Etapa 3 — URL do modelo de vitrine: só PUBLISHED, o publicado por último, perfil WEB antes do DESKTOP_HIGH e chave
 * do bucket público (nada de {@code ..}, barra inicial, {@code restricted/} ou arquivo que não seja .glb).
 */
class CatalogProductModelsTest {
    private final CatalogProductModel3dRepository repo = MemoryRepository.of(CatalogProductModel3dRepository.class);
    private final CatalogProductModels models = new CatalogProductModels(repo);

    private void save(UUID product, CatalogModelStatus status, String renditions, Instant at) {
        CatalogProductModel3d m = new CatalogProductModel3d();
        m.setCatalogProductId(product);
        m.setStatus(status);
        m.setSource("GENERATED");
        m.setSha256("b".repeat(64));
        m.setRenditionsJson(renditions);
        m.setPublishedAt(at);
        repo.save(m);
    }

    private static String web(String key) {
        return "{\"WEB\":{\"key\":\"" + key + "\"},\"DESKTOP_HIGH\":{\"key\":\"catalog/model3d/hi/" + key.hashCode() + ".glb\"}}";
    }

    @Test
    void newestPublishedWinsAndDraftsNeverShow() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        save(a, CatalogModelStatus.PUBLISHED, web("catalog/model3d/1/old.glb"), Instant.parse("2026-01-01T00:00:00Z"));
        save(a, CatalogModelStatus.PUBLISHED, web("catalog/model3d/2/new.glb"), Instant.parse("2026-06-01T00:00:00Z"));
        save(a, CatalogModelStatus.DRAFT, web("catalog/model3d/3/draft.glb"), null);
        save(b, CatalogModelStatus.RETIRED, web("catalog/model3d/4/retired.glb"), Instant.now());
        assertThat(models.urls(List.of(a, b))).isEqualTo(Map.of(a, "/media/catalog/model3d/2/new.glb"));
        assertThat(models.url(b)).isNull();
        assertThat(models.url(null)).isNull();
        assertThat(models.urls(new ArrayList<>(java.util.Arrays.asList(null, null)))).isEmpty();
    }

    @Test
    void webFirstThenDesktopAndUnsafeKeysRefused() {
        assertThat(CatalogProductModels.urlOf(web("catalog/model3d/w/a.glb"))).isEqualTo("/media/catalog/model3d/w/a.glb");
        assertThat(CatalogProductModels.urlOf("{\"DESKTOP_HIGH\":{\"key\":\"catalog/model3d/d/a.glb\"}}"))
                .isEqualTo("/media/catalog/model3d/d/a.glb");
        for (String bad : List.of("../x.glb", "/catalog/a.glb", "restricted/a.glb", "catalog/a.png", "a\\\\b.glb", "")) {
            assertThat(CatalogProductModels.urlOf("{\"WEB\":{\"key\":\"" + bad + "\"}}")).as(bad).isNull();
        }
        assertThat(CatalogProductModels.urlOf("{\"MOBILE_LOW\":{\"key\":\"catalog/model3d/m/a.glb\"}}")).isNull();
        assertThat(CatalogProductModels.urlOf(null)).isNull();
        assertThat(CatalogProductModels.urlOf("não é json")).isNull();
    }

    @Test
    void decoratePutsTheUrlOrNullOnEveryCard() {
        UUID a = UUID.randomUUID();
        save(a, CatalogModelStatus.PUBLISHED, web("catalog/model3d/5/a.glb"), Instant.now());
        Map<String, Object> withModel = new LinkedHashMap<>(Map.of("id", a));
        Map<String, Object> without = new LinkedHashMap<>(Map.of("id", UUID.randomUUID()));
        Map<String, Object> noId = new LinkedHashMap<>();
        models.decorate(List.of(withModel, without, noId));
        assertThat(withModel).containsEntry("model3dUrl", "/media/catalog/model3d/5/a.glb");
        assertThat(without).containsEntry("model3dUrl", null);
        assertThat(noId).containsEntry("model3dUrl", null);
    }
}
