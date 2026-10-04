package br.com.fashionai.application.demo;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** As fixtures reais carregam (o bean sobe com a aplicação: fixture que não carrega derruba o boot). */
class DemoFixturesTest {
    @Test
    void fixturesCarregamECampoAusenteValeZero() {
        DemoFixtures f = new DemoFixtures();
        assertThat(f.saves()).isNotEmpty();
        // social_graph.json: um "save" traz só looks ou só pieces; o campo que falta vale 0
        assertThat(f.saves()).anySatisfy(s -> assertThat(s.pieces()).isZero())
                .anySatisfy(s -> assertThat(s.looks()).isZero());
    }
}
