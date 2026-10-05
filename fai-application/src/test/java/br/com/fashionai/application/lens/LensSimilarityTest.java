package br.com.fashionai.application.lens;

import br.com.fashionai.application.taxonomy.Taxonomy;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * RF54 §9.2 · Semelhança do Lens: pesos (0,45 visual · 0,35 atributos · 0,20 cor), renormalização quando falta uma
 * dimensão (peça sem embedding), atributos ponderados, cor por ΔE00 (CIEDE2000) e pisos por escopo.
 */
class LensSimilarityTest {
    static final float[] A = {1f, 0f};
    static final float[] SAME = {1f, 0f};
    static final float[] ORTHOGONAL = {0f, 1f};

    static LensSimilarity.Features f(String cat, String sub, String material, String pattern, List<String> styles, String color, float[] emb) {
        return new LensSimilarity.Features(cat, sub, material, pattern, styles, color == null ? null : Taxonomy.COLORS.get(color), emb);
    }

    @Test
    void configVersionadaComPesosDoContrato() {
        assertThat(LensConfig.ALGORITHM_VERSION).isEqualTo("LENS_V1");
        assertThat(LensConfig.W_VISUAL + LensConfig.W_ATTRIBUTES + LensConfig.W_COLOR).isCloseTo(1.0, within(1e-9));
        assertThat(LensConfig.A_SUBCATEGORY + LensConfig.A_CATEGORY + LensConfig.A_MATERIAL + LensConfig.A_PATTERN + LensConfig.A_STYLE)
                .isCloseTo(1.0, within(1e-9));
        LensConfig cfg = LensConfig.defaults();
        assertThat(cfg.floor(LensSimilarity.Scope.MY_CLOSET)).isEqualTo(55);
        assertThat(cfg.floor(LensSimilarity.Scope.COMMUNITY)).isEqualTo(65);
        assertThat(cfg.dailyScans()).isEqualTo(30);
        assertThat(cfg.retentionDays()).isEqualTo(30);
        assertThat(LensConfig.confidenceBand(0.75)).isEqualTo("HIGH");
        assertThat(LensConfig.confidenceBand(0.5)).isEqualTo("MEDIUM");
        assertThat(LensConfig.confidenceBand(0.49)).isEqualTo("LOW");
    }

    @Test
    void tresDimensoesComPesos045_035_020() {
        LensSimilarity.Features q = f("upper_piece", "jacket", "COTTON", "solid", List.of("casual"), "denim", A);
        // tudo igual: 100
        assertThat(LensSimilarity.score(q, f("upper_piece", "jacket", "COTTON", "solid", List.of("casual"), "denim", SAME)).similarity())
                .isEqualTo(100);
        // visual 0, atributos 1, cor 1: 0,35 + 0,20 = 55
        LensSimilarity.Score s = LensSimilarity.score(q, f("upper_piece", "jacket", "COTTON", "solid", List.of("casual"), "denim", ORTHOGONAL));
        assertThat(s.similarity()).isEqualTo(55);
        assertThat(s.visual()).isZero();
        assertThat(s.attributes()).isEqualTo(100);
        assertThat(s.color()).isEqualTo(100);
        assertThat(LensSimilarity.combine(0.0, 1.0, 1.0)).isCloseTo(0.55, within(1e-9));
    }

    @Test
    void semEmbeddingOVisualSaiDaContaERenormaliza() {
        LensSimilarity.Features q = f("upper_piece", "jacket", null, null, List.of(), "black", A);
        // peça do guarda-roupa sem embedding: só atributos e cor (0,35 + 0,20 → renormalizado por 0,55)
        LensSimilarity.Score s = LensSimilarity.score(q, f("upper_piece", "jacket", null, null, List.of(), "white", null));
        assertThat(s.visual()).isNull();
        assertThat(s.color()).isZero();                                   // preto × branco: ΔE00 ≫ 40
        assertThat(s.similarity()).isEqualTo((int) Math.round(100 * 0.35 / 0.55));   // 64
        // sem cor também: só atributos
        assertThat(LensSimilarity.combine(null, 0.8, null)).isCloseTo(0.8, within(1e-9));
        assertThat(LensSimilarity.score(q, f("upper_piece", "jacket", null, null, List.of(), null, null)).similarity()).isEqualTo(100);
    }

    @Test
    void atributosPonderadosSoComOQueOsDoisLadosTem() {
        // subtipo diferente, categoria, material, padrão e estilo iguais: (0 + 0,15·4) / 1 = 0,6
        double a = LensSimilarity.attributes(f("upper_piece", "jacket", "COTTON", "solid", List.of("casual"), null, null),
                f("upper_piece", "blazer", "COTTON", "solid", List.of("casual", "minimalist"), null, null));
        assertThat(a).isCloseTo(0.6, within(1e-9));
        // o guarda-roupa não tem padrão nem material: saem da conta (0,40·0 + 0,15·1) / 0,55
        double b = LensSimilarity.attributes(f("upper_piece", "jacket", "COTTON", "solid", List.of(), null, null),
                f("upper_piece", "blazer", null, null, List.of(), null, null));
        assertThat(b).isCloseTo(0.15 / 0.55, within(1e-9));
        // nada comparável: 0 (nunca inflado)
        assertThat(LensSimilarity.attributes(f(null, null, null, null, List.of(), null, null),
                f("upper_piece", "jacket", "COTTON", null, List.of("casual"), null, null))).isZero();
        // sobreposição de estilo = |A∩B| ÷ min(|A|,|B|)
        assertThat(LensSimilarity.overlap(java.util.Set.of("casual"), java.util.Set.of("casual", "urban"))).isEqualTo(1.0);
    }

    @Test
    void corPorDeltaE00ComTetoDe40() {
        assertThat(LensSimilarity.color("#2A5FA8", "#2A5FA8")).isEqualTo(1.0);
        assertThat(LensSimilarity.color("#12100F", "#FFFFFF")).isZero();
        assertThat(LensSimilarity.color(null, "#FFFFFF")).isNull();
        double de = LensSimilarity.deltaE00(0x2A5FA8, 0x1B2A4A);              // azul × marinho
        assertThat(LensSimilarity.color("#2A5FA8", "#1B2A4A")).isCloseTo(Math.max(0, 1 - de / 40), within(1e-9));
    }

    /** Pares de referência de Sharma, Wu e Dalal (2005), "The CIEDE2000 color-difference formula". */
    @Test
    void deltaE00ConfereComOsDadosDeReferencia() {
        assertThat(LensSimilarity.deltaE00(new double[]{50, 2.6772, -79.7751}, new double[]{50, 0, -82.7485})).isCloseTo(2.0425, within(1e-4));
        assertThat(LensSimilarity.deltaE00(new double[]{50, 3.1571, -77.2803}, new double[]{50, 0, -82.7485})).isCloseTo(2.8615, within(1e-4));
        assertThat(LensSimilarity.deltaE00(new double[]{50, 0, 0}, new double[]{50, -1, 2})).isCloseTo(2.3669, within(1e-4));
        assertThat(LensSimilarity.deltaE00(new double[]{50, 2.5, 0}, new double[]{73, 25, -18})).isCloseTo(27.1492, within(1e-4));
        assertThat(LensSimilarity.deltaE00(new double[]{60.2574, -34.0099, 36.2677}, new double[]{60.4626, -34.1751, 39.4387}))
                .isCloseTo(1.2644, within(1e-4));
        assertThat(LensSimilarity.deltaE00(0x123456, 0x123456)).isZero();
    }

    @Test
    void motivosDaExplicacao() {
        LensSimilarity.Score s = LensSimilarity.score(f("upper_piece", "jacket", "COTTON", "solid", List.of("casual"), "denim", A),
                f("upper_piece", "jacket", "COTTON", "solid", List.of("casual"), "denim", SAME));
        assertThat(s.reasons()).containsExactly("SAME_SUBCATEGORY", "COLOR_CLOSE", "SAME_PATTERN", "SAME_MATERIAL", "STYLE_OVERLAP", "VISUAL_CLOSE");
        LensSimilarity.Score other = LensSimilarity.score(f("upper_piece", "jacket", null, null, List.of(), "black", null),
                f("upper_piece", "blazer", null, null, List.of(), "white", null));
        assertThat(other.reasons()).containsExactly("SAME_CATEGORY");
    }

    @Test
    void pisosETopNPorEscopo() {
        LensSimilarity.Features q = f("upper_piece", "jacket", null, null, List.of(), "black", null);
        List<LensSimilarity.Features> targets = List.of(
                f("upper_piece", "jacket", null, null, List.of(), "black", null),      // 100
                f("upper_piece", "jacket", null, null, List.of(), "white", null),      // 64
                f("upper_piece", "blazer", null, null, List.of(), "black", null));     // (0,35·0,27 + 0,20) / 0,55 ≈ 54
        List<LensSimilarity.Ranked<LensSimilarity.Features>> closet = LensSimilarity.rank(q, targets, t -> t,
                LensConfig.FLOOR_MY_CLOSET, LensConfig.TOP_N);
        assertThat(closet).extracting(r -> r.score().similarity()).containsExactly(100, 64);
        List<LensSimilarity.Ranked<LensSimilarity.Features>> community = LensSimilarity.rank(q, targets, t -> t,
                LensConfig.FLOOR_COMMUNITY, LensConfig.TOP_N);
        assertThat(community).extracting(r -> r.score().similarity()).containsExactly(100);
        List<LensSimilarity.Features> many = java.util.Collections.nCopies(20, targets.get(0));
        assertThat(LensSimilarity.rank(q, many, t -> t, 55, LensConfig.TOP_N)).hasSize(12);
    }
}
