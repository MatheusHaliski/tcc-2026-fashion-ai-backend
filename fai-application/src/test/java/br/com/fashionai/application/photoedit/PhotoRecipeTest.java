package br.com.fashionai.application.photoedit;

import org.junit.jupiter.api.Test;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.data.Offset.offset;

class PhotoRecipeTest {
    static Map<String, Object> crop45() {
        return Map.of("op", "crop", "rect", Map.of("x", 0.1, "y", 0.0, "w", 0.6, "h", 0.75), "aspect", "4:5");
    }

    static PhotoRecipe recipe(String target, Object... ops) {
        return PhotoRecipe.parse(Map.of("version", 1, "target", target, "ops", List.of(ops)));
    }

    /** Foto de teste 1000×1000: fundo cinza claro com dominante amarela e uma camiseta azul no centro. */
    static BufferedImage photo() {
        BufferedImage img = new BufferedImage(1000, 1000, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(new Color(230, 222, 190));
        g.fillRect(0, 0, 1000, 1000);
        g.setColor(new Color(40, 70, 150));
        g.fillRect(300, 250, 400, 500);
        g.dispose();
        return img;
    }

    @Test
    void canonicaAceitaSoOperacoesFieisDentroDosLimites() {
        PhotoRecipe ok = recipe("CANONICAL", Map.of("op", "straighten", "deg", 3), crop45(),
                Map.of("op", "background", "kind", "WHITE", "shadow", "SOFT"), Map.of("op", "whiteBalance", "sample", List.of(0.05, 0.05)),
                Map.of("op", "tone", "exposureEv", 0.5, "saturation", 10), Map.of("op", "sharpen", "amount", 0.2),
                Map.of("op", "heal", "spots", List.of(Map.of("x", 0.5, "y", 0.5, "r", 0.01))));
        assertThat(RecipePolicy.violations(ok, 1)).isEmpty();

        PhotoRecipe bad = recipe("CANONICAL", Map.of("op", "straighten", "deg", 30), Map.of("op", "crop", "rect", Map.of("x", 0, "y", 0, "w", 1, "h", 1)),
                Map.of("op", "tone", "saturation", 60), Map.of("op", "filter", "style", "MONO", "strength", 1), Map.of("op", "sharpen", "amount", 0.8),
                Map.of("op", "heal", "spots", List.of(Map.of("x", 0.5, "y", 0.5, "r", 0.1))));
        assertThat(RecipePolicy.violations(bad, 1)).contains("ENDIREITAR_ALEM_DE_15_GRAUS", "CANONICA_EXIGE_QUADRO_4_5",
                "SATURACAO_ALTERA_A_COR_DA_PECA", "OPERACAO_SO_NA_APRESENTACAO:filter", "NITIDEZ_FORTE_DEMAIS", "RETOQUE_ALEM_DE_1_PORCENTO");
    }

    @Test
    void canonicaAceitaAJanelaLivreDoRecorte() {
        PhotoRecipe free = recipe("CANONICAL", Map.of("op", "crop", "rect", Map.of("x", 0.2, "y", 0.1, "w", 0.5, "h", 0.3), "aspect", "FREE"));
        assertThat(RecipePolicy.violations(free, 1)).isEmpty();
        BufferedImage out = PhotoRecipeRenderer.crop(PhotoRecipeRendererAccess.argb(photo()), (PhotoRecipe.Crop) free.ops().get(0));
        assertThat((double) out.getWidth() / out.getHeight()).as("a janela não é forçada a 4:5").isCloseTo(0.5 * photo().getWidth() / (0.3 * photo().getHeight()), offset(0.02));
    }

    @Test
    void apresentacaoAceitaFiltroESaturacaoMasNuncaOperacaoGenerativa() {
        PhotoRecipe pres = recipe("PRESENTATION", Map.of("op", "tone", "saturation", 60), Map.of("op", "filter", "style", "VINTAGE", "strength", 0.6));
        assertThat(RecipePolicy.violations(pres, 1)).isEmpty();
        assertThatThrownBy(() -> recipe("PRESENTATION", Map.of("op", "inpaint"))).hasMessageContaining("OPERACAO_DESCONHECIDA");
        assertThatThrownBy(() -> recipe("CANONICAL", Map.of("op", "tone", "exposureEv", "muito"))).hasMessageContaining("NUMERO_INVALIDO");
    }

    @Test
    void mesmaReceitaMesmosPixelsEReceitaVaziaDevolveAOriginal() {
        PhotoRecipeRenderer r = PhotoRecipeRenderer.withMask(img -> img);
        PhotoRecipe rec = recipe("CANONICAL", Map.of("op", "straighten", "deg", 4), crop45(), Map.of("op", "tone", "exposureEv", 0.3, "contrast", 10));
        BufferedImage a = r.render(photo(), rec).image(), b = r.render(photo(), rec).image();
        assertThat(a.getRGB(0, 0, a.getWidth(), a.getHeight(), null, 0, a.getWidth()))
                .isEqualTo(b.getRGB(0, 0, b.getWidth(), b.getHeight(), null, 0, b.getWidth()));
        BufferedImage empty = r.render(photo(), recipe("CANONICAL")).image();
        assertThat(empty.getRGB(500, 500) & 0xFFFFFF).isEqualTo(photo().getRGB(500, 500) & 0xFFFFFF);
    }

    @Test
    void recorte45NuncaEstica() {
        BufferedImage out = PhotoRecipeRenderer.crop(PhotoRecipeRendererAccess.argb(photo()), new PhotoRecipe.Crop(0.1, 0, 0.61, 0.74, "4:5"));
        assertThat(out.getWidth() * 5).isEqualTo(out.getHeight() * 4);
    }

    @Test
    void endireitarNaoDeixaCantosVazios() {
        BufferedImage out = PhotoRecipeRenderer.straighten(PhotoRecipeRendererAccess.argb(photo()), 10);
        for (int[] c : new int[][]{{0, 0}, {out.getWidth() - 1, 0}, {0, out.getHeight() - 1}, {out.getWidth() - 1, out.getHeight() - 1}}) {
            assertThat(out.getRGB(c[0], c[1]) >>> 24).as("canto opaco").isGreaterThan(200);
        }
        assertThat(PhotoRecipeRenderer.rotate90(PhotoRecipeRendererAccess.argb(new BufferedImage(40, 20, BufferedImage.TYPE_INT_RGB)), 1).getWidth()).isEqualTo(20);
    }

    @Test
    void balancoDeBrancoNeutralizaADominanteDaAmostra() {
        BufferedImage out = PhotoRecipeRenderer.whiteBalance(PhotoRecipeRendererAccess.argb(photo()), 0.05, 0.05);
        int p = out.getRGB(50, 50);
        int r = (p >> 16) & 0xFF, g = (p >> 8) & 0xFF, b = p & 0xFF;
        assertThat(Math.max(r, Math.max(g, b)) - Math.min(r, Math.min(g, b))).isLessThanOrEqualTo(3);
    }

    @Test
    void exposicaoPositivaClareiaERetoqueApagaAMancha() {
        BufferedImage base = PhotoRecipeRendererAccess.argb(photo());
        BufferedImage bright = PhotoRecipeRenderer.tone(base, new PhotoRecipe.Tone(1, 0, 0, 0, 0));
        assertThat((bright.getRGB(500, 500) & 0xFF)).isGreaterThan(base.getRGB(500, 500) & 0xFF);
        base.setRGB(500, 500, 0xFFFF0000);                                  // fiapo vermelho na camiseta azul
        BufferedImage healed = PhotoRecipeRenderer.heal(base, List.of(new double[]{0.5, 0.5, 0.003}));
        assertThat((healed.getRGB(500, 500) >> 16) & 0xFF).isLessThan(80);
    }

    @Test
    void perspectivaComOsCantosDaFotoEhIdentidade() {
        BufferedImage base = PhotoRecipeRendererAccess.argb(photo());
        BufferedImage out = PhotoRecipeRenderer.perspective(base, new double[][]{{0, 0}, {1, 0}, {1, 1}, {0, 1}});
        assertThat(out.getWidth()).isEqualTo(1000);
        assertThat(out.getRGB(500, 500)).isEqualTo(base.getRGB(500, 500));
    }

    @Test
    void fundoBrancoComPinceladaDevolvePixelsAPeca() {
        // recorte "ruim": só metade esquerda da camiseta é peça; a pincelada ADD devolve a metade direita
        PhotoRecipeRenderer r = PhotoRecipeRenderer.withMask(img -> {
            BufferedImage m = new BufferedImage(img.getWidth(), img.getHeight(), BufferedImage.TYPE_INT_ARGB);
            for (int y = 250; y < 750; y++) {
                for (int x = 300; x < 500; x++) {
                    m.setRGB(x, y, 0xFF000000);
                }
            }
            return m;
        });
        PhotoRecipe rec = recipe("CANONICAL", Map.of("op", "background", "kind", "WHITE", "shadow", "NONE",
                "strokes", List.of(Map.of("mode", "add", "r", 0.05, "pts", List.of(List.of(0.6, 0.4), List.of(0.6, 0.7))))));
        BufferedImage out = r.render(photo(), rec).image();
        assertThat(out.getRGB(50, 50) & 0xFFFFFF).isEqualTo(0xFFFFFF);
        assertThat(out.getRGB(400, 500) & 0xFF).isGreaterThan(120);      // azul mantido
        assertThat(out.getRGB(600, 500) & 0xFF).isGreaterThan(120);      // devolvido pela pincelada
        assertThat(out.getRGB(680, 300) & 0xFFFFFF).isEqualTo(0xFFFFFF); // fora da pincelada continua fundo
    }

    @Test
    void ciede2000BateComOParDeReferenciaDeSharma() {
        assertThat(ColorFidelity.ciede2000(new double[]{50, 2.6772, -79.7751}, new double[]{50, 0, -82.7485})).isCloseTo(2.0425, offset(1e-4));
        assertThat(ColorFidelity.ciede2000(new double[]{50, -1.3802, -84.2814}, new double[]{50, 0, -82.7485})).isCloseTo(1.0, offset(1e-4));
    }

    @Test
    void espelharInverteAFotoEExigePecaSemTextoNaCanonica() {
        BufferedImage base = PhotoRecipeTest.photo();
        base.setRGB(100, 100, 0xFFFF0000);                                  // marca assimétrica
        BufferedImage h = PhotoRecipeRenderer.flip(PhotoRecipeRendererAccess.argb(base), false);
        assertThat(h.getRGB(899, 100) & 0xFFFFFF).isEqualTo(0xFF0000);
        assertThat(h.getRGB(100, 100) & 0xFFFFFF).isNotEqualTo(0xFF0000);
        BufferedImage v = PhotoRecipeRenderer.flip(PhotoRecipeRendererAccess.argb(base), true);
        assertThat(v.getRGB(100, 899) & 0xFFFFFF).isEqualTo(0xFF0000);
        PhotoRecipe flip = recipe("CANONICAL", Map.of("op", "flip", "axis", "H"), crop45());
        assertThat(RecipePolicy.violations(flip, 1, false)).isEmpty();
        assertThat(RecipePolicy.violations(flip, 1, true)).containsExactly("ESPELHAR_INVERTE_TEXTO_OU_LOGO");
        assertThat(RecipePolicy.violations(recipe("PRESENTATION", Map.of("op", "flip", "axis", "H")), 1, true)).as("apresentação aceita, com aviso na prévia").isEmpty();
        assertThatThrownBy(() -> recipe("CANONICAL", Map.of("op", "flip", "axis", "D"))).hasMessageContaining("EIXO_INVALIDO");
    }

    @Test
    void niveisSaoReaisPorTabelaEComLimiteNaCanonica() {
        BufferedImage base = PhotoRecipeRendererAccess.argb(photo());
        BufferedImage out = PhotoRecipeRenderer.levels(base, 0.2, 0.9, 1);
        // cinza-amarelado do fundo (230,222,190): cada canal c → (c/255 − 0,2)/0,7
        assertThat((out.getRGB(50, 50) >> 16) & 0xFF).isCloseTo((int) Math.round(((230 / 255.0) - 0.2) / 0.7 * 255), offset(2));
        assertThat(out.getRGB(50, 50) >>> 24).isEqualTo(255);
        BufferedImage dark = PhotoRecipeRenderer.levels(base, 0.5, 1, 1);
        assertThat((dark.getRGB(500, 500) >> 16) & 0xFF).as("vermelho 40/255 abaixo do ponto preto 0,5 vai a zero").isEqualTo(0);
        assertThat(dark.getRGB(500, 500) & 0xFF).as("azul 150/255 → (0,588 − 0,5)/0,5").isCloseTo(45, offset(2));
        assertThat(RecipePolicy.violations(recipe("CANONICAL", crop45(), Map.of("op", "levels", "black", 0.05, "white", 0.95, "gamma", 1.1)), 1)).isEmpty();
        assertThat(RecipePolicy.violations(recipe("CANONICAL", crop45(), Map.of("op", "levels", "black", 0.3, "white", 1, "gamma", 1)), 1)).contains("NIVEIS_FORTE_DEMAIS");
        assertThat(RecipePolicy.violations(recipe("PRESENTATION", Map.of("op", "levels", "black", 0.3, "white", 0.8, "gamma", 2)), 1)).isEmpty();
        assertThat(RecipePolicy.violations(recipe("PRESENTATION", Map.of("op", "levels", "black", 0.9, "white", 0.8, "gamma", 1)), 1)).contains("NIVEIS_INVALIDOS");
    }

    @Test
    void bordaDaMascaraSuavizadaEComLimite() {
        int w = 40, h = 10;
        int[] alpha = new int[w * h];
        for (int y = 0; y < h; y++) {
            for (int x = 20; x < w; x++) {
                alpha[y * w + x] = 255;                                     // borda dura em x = 20
            }
        }
        int[] soft = PhotoRecipeRenderer.featherAlpha(alpha, w, h, 4);
        assertThat(soft[5 * w + 18]).isGreaterThan(0).isLessThan(255);
        assertThat(soft[5 * w + 22]).isGreaterThan(0).isLessThan(255);
        assertThat(soft[5 * w + 2]).isEqualTo(0);
        assertThat(soft[5 * w + 37]).isEqualTo(255);
        assertThat(PhotoRecipe.parse(Map.of("target", "CANONICAL", "ops", List.of(Map.of("op", "background", "kind", "WHITE", "feather", 8))))
                .ops().get(0)).isEqualTo(new PhotoRecipe.Background(PhotoRecipe.BackgroundKind.WHITE, "NONE", List.of(), 8));
        assertThat(RecipePolicy.violations(recipe("CANONICAL", crop45(), Map.of("op", "background", "kind", "WHITE", "feather", 40)), 1)).contains("BORDA_INVALIDA");
    }
}
