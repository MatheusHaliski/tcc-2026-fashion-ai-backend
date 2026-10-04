package br.com.fashionai.application.demo;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** As fixtures versionadas carregam e passam na validação contra a taxonomia (antes, um campo omitido derrubava a API). */
class DemoFixturesTest {

    @Test
    void fixturesCarregamEValidam() {
        DemoFixtures f = new DemoFixtures();
        assertThat(f.personas("frontend")).hasSize(12);
        assertThat(f.personas("full")).hasSize(12 + 24);
        assertThat(f.fixtureKeys("full")).doesNotHaveDuplicates().contains("USER_PUBLIC", "FOLLOWER_24");
        assertThat(f.personas("full")).allSatisfy(p -> {
            assertThat(p.username()).startsWith("demo_");
            assertThat(p.email()).endsWith("@example.test");
        });
        assertThat(f.saves()).anySatisfy(s -> assertThat(s.pieces()).isZero());   // campo omitido = 0
        assertThat(f.pieces()).isNotEmpty();
        assertThat(f.looks()).isNotEmpty();
        assertThat(f.brands()).extracting(DemoFixtures.CatalogBrand::fixtureKey)
                .containsExactlyInAnyOrder("BRAND_CATALOG_MAISON_DEMO", "BRAND_CATALOG_ATELIER_EXEMPLO");
    }
}
