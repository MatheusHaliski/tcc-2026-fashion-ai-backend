package br.com.fashionai.application.atelier3d;

import java.io.IOException;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import tools.jackson.databind.ObjectMapper;
import static org.assertj.core.api.Assertions.assertThat;

/** Cross-language boundary: files generated/exported by the browser must pass the Java upload policy. */
class GeneratedGarmentCompatibilityTest {
    @ParameterizedTest
    @ValueSource(strings = {
        "fai-tee-prototype.glb", "fai-skirt-prototype.glb", "fai-trousers-prototype.glb",
        "export-tee.glb", "export-skirt.glb", "export-trousers.glb"
    })
    void acceptsEmbeddedStaticGarmentsCreatedByTheEditor(String filename) throws IOException {
        try (var input = getClass().getResourceAsStream("/atelier3d/prototypes/" + filename)) {
            assertThat(input).as(filename).isNotNull();
            var bytes = input.readAllBytes();
            var result = GlbInspector.inspect(bytes, new ObjectMapper());
            assertThat(bytes.length).isLessThan(8 * 1024 * 1024);
            assertThat(result.vertices()).isBetween(1L, 20_000L);
            assertThat(result.primitives()).isNotEmpty();
            assertThat(result.skinned()).isFalse();
            assertThat(result.morphs()).isFalse();
            assertThat(result.animated()).isFalse();
        }
    }
}
