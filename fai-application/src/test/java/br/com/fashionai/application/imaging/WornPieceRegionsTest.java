package br.com.fashionai.application.imaging;

import br.com.fashionai.application.moderation.ImageSafetyPorts.ClassMap;
import org.junit.jupiter.api.Test;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Roupa vestida separada em peças pelo mapa de classes do segmentador (sem IA remota): boné acima do rosto, peça de
 * cima × de baixo pelo salto de cor, bermuda pela pele das pernas, calçado como faixa de baixo, vestido como peça única;
 * sem pessoa, nada; uma vitrine ao fundo não entra.
 */
class WornPieceRegionsTest {
    static final int W = 64, H = 96;
    static final Color UPPER = new Color(245, 245, 245), LOWER = new Color(120, 160, 200), SHOES = new Color(60, 30, 30),
            CAP = new Color(20, 20, 20), SKIN = new Color(210, 170, 140), BG = new Color(180, 180, 160);

    /** pessoa centrada: boné, rosto, roupa de cima (clara), de baixo (azul), pernas de pele (bermuda) e tênis escuro */
    static Scene shortsScene() {
        Scene s = new Scene();
        s.fill(28, 36, 0, 3, ClassMap.CLOTHES, CAP);       // boné
        s.fill(29, 35, 4, 7, ClassMap.HAIR, new Color(90, 60, 30));
        s.fill(29, 35, 8, 14, ClassMap.FACE_SKIN, SKIN);
        s.fill(31, 33, 15, 16, ClassMap.BODY_SKIN, SKIN);  // pescoço
        s.fill(18, 46, 17, 44, ClassMap.CLOTHES, UPPER);   // camiseta com mangas
        s.fill(24, 40, 45, 62, ClassMap.CLOTHES, LOWER);   // bermuda
        s.fill(25, 30, 63, 82, ClassMap.BODY_SKIN, SKIN);  // pernas
        s.fill(34, 39, 63, 82, ClassMap.BODY_SKIN, SKIN);
        s.fill(23, 31, 83, 92, ClassMap.OTHER, SHOES);     // tênis
        s.fill(33, 41, 83, 92, ClassMap.OTHER, SHOES);
        return s;
    }

    @Test
    void boneCamisetaBermudaETenisViramQuatroPecasComACorDeCadaUma() {
        Scene s = shortsScene();
        List<WornPieceRegions.Worn> worn = WornPieceRegions.detect(s.photo, s.map());
        assertThat(worn).extracting(WornPieceRegions.Worn::kind)
                .containsExactly(WornPieceRegions.Kind.HEADWEAR, WornPieceRegions.Kind.UPPER, WornPieceRegions.Kind.LOWER, WornPieceRegions.Kind.SHOES);
        WornPieceRegions.Worn upper = worn.get(1), lower = worn.get(2), shoes = worn.get(3);
        assertThat(PixelStats.distance(upper.rgb(), UPPER.getRGB() & 0xFFFFFF)).isLessThan(12);
        assertThat(PixelStats.distance(lower.rgb(), LOWER.getRGB() & 0xFFFFFF)).isLessThan(12);
        assertThat(PixelStats.distance(shoes.rgb(), SHOES.getRGB() & 0xFFFFFF)).isLessThan(12);
        assertThat(PixelStats.distance(worn.get(0).rgb(), CAP.getRGB() & 0xFFFFFF)).isLessThan(12);
        // caixas em % da foto, justas em cada peça (com 1 % de folga)
        assertThat(upper.y()).isBetween(16.0, 18.5);
        assertThat(upper.y() + upper.height()).isBetween(46.0, 49.0);
        assertThat(lower.y()).isBetween(45.5, 48.0);
        assertThat(shoes.y()).isBetween(85.0, 88.0);
        assertThat(lower.bottomFrac()).isLessThan(0.8);                   // termina acima do joelho: bermuda
        assertThat(upper.x()).isLessThan(lower.x());                      // as mangas alargam a peça de cima
    }

    @Test
    void calcaCompridaAteOSapatoSeparaOCalcadoPeloSaltoDeCor() {
        Scene s = new Scene();
        s.fill(29, 35, 4, 7, ClassMap.HAIR, new Color(90, 60, 30));
        s.fill(29, 35, 8, 14, ClassMap.FACE_SKIN, SKIN);
        s.fill(18, 46, 15, 44, ClassMap.CLOTHES, UPPER);
        s.fill(24, 40, 45, 84, ClassMap.CLOTHES, LOWER);   // calça até o sapato
        s.fill(22, 42, 85, 93, ClassMap.CLOTHES, SHOES);   // sapato lido como "roupa", colado na calça
        List<WornPieceRegions.Worn> worn = WornPieceRegions.detect(s.photo, s.map());
        assertThat(worn).extracting(WornPieceRegions.Worn::kind)
                .containsExactly(WornPieceRegions.Kind.UPPER, WornPieceRegions.Kind.LOWER, WornPieceRegions.Kind.SHOES);
        assertThat(worn.get(1).bottomFrac()).isGreaterThan(0.8);         // calça comprida
        assertThat(worn.get(2).y()).isBetween(85.0, 89.0);
    }

    @Test
    void umaCorSoDoPescocoAosPesEPecaUnica() {
        Scene s = new Scene();
        s.fill(29, 35, 4, 7, ClassMap.HAIR, new Color(90, 60, 30));
        s.fill(29, 35, 8, 14, ClassMap.FACE_SKIN, SKIN);
        s.fill(20, 44, 15, 88, ClassMap.CLOTHES, new Color(160, 40, 60));
        List<WornPieceRegions.Worn> worn = WornPieceRegions.detect(s.photo, s.map());
        assertThat(worn).extracting(WornPieceRegions.Worn::kind).containsExactly(WornPieceRegions.Kind.FULL);
    }

    @Test
    void semPessoaNadaEVitrineAoFundoNaoEntra() {
        Scene empty = new Scene();
        empty.fill(5, 30, 10, 40, ClassMap.CLOTHES, UPPER);               // peça sobre a mesa, ninguém na foto
        assertThat(WornPieceRegions.detect(empty.photo, empty.map())).isEmpty();

        Scene s = shortsScene();
        s.fill(2, 12, 20, 40, ClassMap.OTHER, new Color(200, 30, 30));    // bolsa na prateleira, separada da pessoa
        s.fill(52, 62, 60, 80, ClassMap.CLOTHES, new Color(30, 200, 30));
        List<WornPieceRegions.Worn> worn = WornPieceRegions.detect(s.photo, s.map());
        assertThat(worn).hasSize(4);
        assertThat(worn).allSatisfy(r -> { assertThat(r.x()).isGreaterThan(15); assertThat(r.x() + r.width()).isLessThan(78); });
    }

    @Test
    void saltoDeCorExigeDoisLadosDiferentesESuficientes() {
        int[] clothes = new int[20];
        long[] r = new long[20], g = new long[20], b = new long[20];
        for (int y = 0; y < 20; y++) {
            clothes[y] = 5;
            int c = y < 10 ? 240 : 40;
            r[y] = g[y] = b[y] = c * 5L;
        }
        assertThat(WornPieceRegions.colourCut(clothes, r, g, b, 0, 19, 3)).isEqualTo(10);
        for (int y = 0; y < 20; y++) { r[y] = g[y] = b[y] = (y < 10 ? 120 : 130) * 5L; }   // só sombra: mesma peça
        assertThat(WornPieceRegions.colourCut(clothes, r, g, b, 0, 19, 3)).isEqualTo(-1);
    }

    /** foto e mapa na mesma grade: cada retângulo tem classe e cor */
    static final class Scene {
        final BufferedImage photo = new BufferedImage(W, H, BufferedImage.TYPE_INT_RGB);
        final byte[] classes = new byte[W * H];

        Scene() {
            Graphics2D g = photo.createGraphics();
            g.setColor(BG);
            g.fillRect(0, 0, W, H);
            g.dispose();
        }

        void fill(int x0, int x1, int y0, int y1, int cls, Color color) {
            for (int y = y0; y <= y1; y++) {
                for (int x = x0; x <= x1; x++) {
                    classes[y * W + x] = (byte) cls;
                    photo.setRGB(x, y, color.getRGB());
                }
            }
        }

        ClassMap map() {
            return new ClassMap(W, H, classes);
        }
    }
}
