package br.com.fashionai.application.assets;

import br.com.fashionai.domain.repository.AssetPresetRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.File;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Variantes AURA: ids atuais e ids de coleções substituídas (Aura Geometry antiga → 6 vídeos). */
class AssetCatalogServiceTest {
    private AssetCatalogService assets;

    @BeforeEach
    void setUp() throws Exception {
        assets = new AssetCatalogService(Mockito.mock(AssetPresetRepository.class), "public");
        Map<?, ?> manifest = new ObjectMapper().readValue(new File("../fai-web/src/main/resources/catalog/asset-manifest.json"), Map.class);
        ReflectionTestUtils.setField(assets, "manifest", manifest);
    }

    @Test
    void varianteAtualResolveComOPreset() {
        Map<String, Object> v = assets.auraVariant("aura_geometry__geometry_01").orElseThrow();
        assertThat(v.get("id")).isEqualTo("aura_geometry__geometry_01");
        assertThat(((Map<?, ?>) v.get("preset")).get("id")).isEqualTo("aura_geometry");
    }

    @Test
    void idAntigoDeAuraGeometryCaiNumaDasSeisVariantesNovasComOMesmoCalculoDoFrontend() {
        // lib/card-art.ts auraVariantId: o mesmo hash → "aura_geometry__geometry_05"
        Map<String, Object> v = assets.auraVariant("aura_geometry__gradientes_a001_coins").orElseThrow();
        assertThat(v.get("id")).isEqualTo("aura_geometry__geometry_05");
        assertThat(((Map<?, ?>) v.get("static")).get("previewUrl")).isEqualTo("/aura/geometry/geometry_05/imagem.png");
        assertThat(assets.auraVariant("aura_geometry__gradientes_a001_coins")).contains(v);
    }

    @Test
    void presetDesconhecidoContinuaInvalido() {
        assertThat(assets.auraVariant("preset_que_nao_existe__x")).isEmpty();
        assertThat(assets.auraVariant(null)).isEmpty();
    }
}
