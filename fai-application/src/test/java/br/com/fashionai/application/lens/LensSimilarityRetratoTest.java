package br.com.fashionai.application.lens;

import br.com.fashionai.application.taxonomy.Taxonomy;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Caracterização determinística da {@link LensSimilarity} (lote R91-lens): semelhanças, componentes, motivos e ΔE00 de
 * uma grade fixa de pares, comparados com o retrato exato gravado antes de separar o CIEDE2000 em arquivo próprio.
 */
class LensSimilarityRetratoTest {
    static final float[] E1 = {0.6f, 0.8f, 0f};
    static final float[] E2 = {0.8f, 0.6f, 0f};
    static final float[] E3 = {-1f, 0f, 0f};

    static LensSimilarity.Features f(String cat, String sub, String material, String pattern, List<String> styles, String color, float[] emb) {
        return new LensSimilarity.Features(cat, sub, material, pattern, styles, color == null ? null : Taxonomy.COLORS.get(color), emb);
    }

    static final List<LensSimilarity.Features> GRID = List.of(
            f("upper_piece", "jacket", "COTTON", "solid", List.of("casual"), "denim", E1),
            f("upper_piece", "jacket", "cotton", null, List.of("Casual", "urban"), "navy", E2),
            f("upper_piece", "blazer", "WOOL", "striped", List.of("classic"), "black", E3),
            f("lower_piece", "tailored_pants", null, "solid", List.of(), "white", null),
            f(null, null, null, null, null, null, null),
            f("upper_piece", "jacket", "COTTON", "solid", List.of("casual", "minimalist"), "red", E1));

    static final String EXPECTED = """
            0x0=100/100/100/100[SAME_SUBCATEGORY, COLOR_CLOSE, SAME_PATTERN, SAME_MATERIAL, STYLE_OVERLAP, VISUAL_CLOSE]
            0x1=87/96/100/46[SAME_SUBCATEGORY, SAME_MATERIAL, STYLE_OVERLAP, VISUAL_CLOSE]
            0x2=9/0/15/19[SAME_CATEGORY]
            0x3=14/null/21/0[SAME_PATTERN]
            0x4=0/null/0/null[]
            0x5=80/100/100/0[SAME_SUBCATEGORY, SAME_PATTERN, SAME_MATERIAL, STYLE_OVERLAP, VISUAL_CLOSE]
            1x0=87/96/100/46[SAME_SUBCATEGORY, SAME_MATERIAL, STYLE_OVERLAP, VISUAL_CLOSE]
            1x1=100/100/100/100[SAME_SUBCATEGORY, COLOR_CLOSE, SAME_MATERIAL, STYLE_OVERLAP, VISUAL_CLOSE]
            1x2=17/0/18/56[SAME_CATEGORY]
            1x3=0/null/0/0[]
            1x4=0/null/0/null[]
            1x5=75/96/91/0[SAME_SUBCATEGORY, SAME_MATERIAL, STYLE_OVERLAP, VISUAL_CLOSE]
            2x0=9/0/15/19[SAME_CATEGORY]
            2x1=17/0/18/56[SAME_CATEGORY]
            2x2=100/100/100/100[SAME_SUBCATEGORY, COLOR_CLOSE, SAME_PATTERN, SAME_MATERIAL, STYLE_OVERLAP, VISUAL_CLOSE]
            2x3=0/null/0/0[]
            2x4=0/null/0/null[]
            2x5=6/0/15/2[SAME_CATEGORY]
            3x0=14/null/21/0[SAME_PATTERN]
            3x1=0/null/0/0[]
            3x2=0/null/0/0[]
            3x3=100/null/100/100[SAME_SUBCATEGORY, COLOR_CLOSE, SAME_PATTERN]
            3x4=0/null/0/null[]
            3x5=14/null/21/0[SAME_PATTERN]
            4x0=0/null/0/null[]
            4x1=0/null/0/null[]
            4x2=0/null/0/null[]
            4x3=0/null/0/null[]
            4x4=0/null/0/null[]
            4x5=0/null/0/null[]
            5x0=80/100/100/0[SAME_SUBCATEGORY, SAME_PATTERN, SAME_MATERIAL, STYLE_OVERLAP, VISUAL_CLOSE]
            5x1=75/96/91/0[SAME_SUBCATEGORY, SAME_MATERIAL, STYLE_OVERLAP, VISUAL_CLOSE]
            5x2=6/0/15/2[SAME_CATEGORY]
            5x3=14/null/21/0[SAME_PATTERN]
            5x4=0/null/0/null[]
            5x5=100/100/100/100[SAME_SUBCATEGORY, COLOR_CLOSE, SAME_PATTERN, SAME_MATERIAL, STYLE_OVERLAP, VISUAL_CLOSE]
            rank=[0:100, 1:87, 5:80]
            dE(2A5FA8,2A5FA8)=0.0000000000
            dE(2A5FA8,1B2A4A)=20.1886789198
            dE(2A5FA8,FFFFFF)=51.2071396371
            dE(2A5FA8,000000)=35.9303226484
            dE(2A5FA8,C0392B)=43.0542562435
            dE(2A5FA8,27AE60)=51.5681141831
            dE(2A5FA8,7F7F7F)=25.7338458822
            dE(1B2A4A,2A5FA8)=20.1886789198
            dE(1B2A4A,1B2A4A)=0.0000000000
            dE(1B2A4A,FFFFFF)=75.5761877543
            dE(1B2A4A,000000)=18.6137817933
            dE(1B2A4A,C0392B)=41.9697238906
            dE(1B2A4A,27AE60)=56.0652752130
            dE(1B2A4A,7F7F7F)=33.2400988409
            dE(FFFFFF,2A5FA8)=51.2071396371
            dE(FFFFFF,1B2A4A)=75.5761877543
            dE(FFFFFF,FFFFFF)=0.0000000000
            dE(FFFFFF,000000)=100.0000008525
            dE(FFFFFF,C0392B)=49.5082440645
            dE(FFFFFF,27AE60)=36.3279165602
            dE(FFFFFF,7F7F7F)=33.5915435595
            dE(000000,2A5FA8)=35.9303226484
            dE(000000,1B2A4A)=18.6137817933
            dE(000000,FFFFFF)=100.0000008525
            dE(000000,000000)=0.0000000000
            dE(000000,C0392B)=41.4789162272
            dE(000000,27AE60)=56.0350283799
            dE(000000,7F7F7F)=39.5539673755
            dE(C0392B,2A5FA8)=43.0542562435
            dE(C0392B,1B2A4A)=41.9697238906
            dE(C0392B,FFFFFF)=49.5082440645
            dE(C0392B,000000)=41.4789162272
            dE(C0392B,C0392B)=0.0000000000
            dE(C0392B,27AE60)=68.0795322479
            dE(C0392B,7F7F7F)=28.0806541042
            dE(27AE60,2A5FA8)=51.5681141831
            dE(27AE60,1B2A4A)=56.0652752130
            dE(27AE60,FFFFFF)=36.3279165602
            dE(27AE60,000000)=56.0350283799
            dE(27AE60,C0392B)=68.0795322479
            dE(27AE60,27AE60)=0.0000000000
            dE(27AE60,7F7F7F)=27.5801868353
            dE(7F7F7F,2A5FA8)=25.7338458822
            dE(7F7F7F,1B2A4A)=33.2400988409
            dE(7F7F7F,FFFFFF)=33.5915435595
            dE(7F7F7F,000000)=39.5539673755
            dE(7F7F7F,C0392B)=28.0806541042
            dE(7F7F7F,27AE60)=27.5801868353
            dE(7F7F7F,7F7F7F)=0.0000000000
            combine=0.475000000000/0.581818181818/0.175000000000
            color=0.16000908328515617/null
            visual=0.9599999809265148/0.0/null""";

    @Test
    void retratoDaGradeDeSemelhancas() {
        List<String> out = new ArrayList<>();
        for (int i = 0; i < GRID.size(); i++) {
            for (int j = 0; j < GRID.size(); j++) {
                LensSimilarity.Score s = LensSimilarity.score(GRID.get(i), GRID.get(j));
                out.add(i + "x" + j + "=" + s.similarity() + "/" + s.visual() + "/" + s.attributes() + "/" + s.color() + s.reasons());
            }
        }
        out.add("rank=" + LensSimilarity.rank(GRID.get(0), GRID, x -> x, 30, 3).stream()
                .map(r -> GRID.indexOf(r.target()) + ":" + r.score().similarity()).toList());
        int[] rgb = {0x2A5FA8, 0x1B2A4A, 0xFFFFFF, 0x000000, 0xC0392B, 0x27AE60, 0x7F7F7F};
        for (int a : rgb) {
            for (int b : rgb) {
                out.add(String.format(Locale.ROOT, "dE(%06X,%06X)=%.10f", a, b, LensSimilarity.deltaE00(a, b)));
            }
        }
        out.add(String.format(Locale.ROOT, "combine=%.12f/%.12f/%.12f", LensSimilarity.combine(0.3, 0.7, null),
                LensSimilarity.combine(null, 0.4, 0.9), LensSimilarity.combine(0.1, 0.2, 0.3)));
        out.add("color=" + LensSimilarity.color("#123456", "#654321") + "/" + LensSimilarity.color(null, "#000000"));
        out.add("visual=" + LensSimilarity.visual(E1, E2) + "/" + LensSimilarity.visual(E1, E3) + "/" + LensSimilarity.visual(E1, new float[]{1f}));
        String retrato = String.join("\n", out);
        assertThat(retrato).isEqualTo(EXPECTED);
    }
}
