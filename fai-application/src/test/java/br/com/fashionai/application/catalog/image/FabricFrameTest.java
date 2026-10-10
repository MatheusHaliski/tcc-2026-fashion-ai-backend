package br.com.fashionai.application.catalog.image;

import org.junit.jupiter.api.Test;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.util.Map;

import static br.com.fashionai.application.catalog.image.CatalogPhotos.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * Quadro só de tecido (lote de enquadramento por categoria): cada pixel do quadro, na foto original, é tecido da peça —
 * nada de fundo, pele, outra peça na abertura, sola ou detalhe estreito — e o lugar do quadro segue a categoria e a
 * subcategoria. Sem tecido suficiente, não há quadro (a foto não é reenquadrada).
 */
class FabricFrameTest {
    private final CatalogImagePipeline pipeline = new CatalogImagePipeline(SemanticRegionRegistry.get(), null);

    @SuppressWarnings("unchecked")
    private Map<String, Object> frame(BufferedImage img, String category, String sub) {
        CatalogImagePipeline.Analysis a = pipeline.run(new CatalogImagePipeline.Request(png(img), category, sub, "PACKSHOT", false));
        return (Map<String, Object>) a.debug().get("fabricFrame");
    }

    @SuppressWarnings("unchecked")
    private static NRect crop(Map<String, Object> f) {
        Map<String, Object> c = (Map<String, Object>) f.get("crop");
        return new NRect(((Number) c.get("x")).doubleValue(), ((Number) c.get("y")).doubleValue(), ((Number) c.get("w")).doubleValue(), ((Number) c.get("h")).doubleValue());
    }

    /** Todos os pixels do quadro na foto original têm a cor da peça (tolerância só para o antisserrilhado/JPEG). */
    private static void assertAllFabric(BufferedImage img, NRect c, Color fabric) {
        int x0 = (int) Math.ceil(c.x() * img.getWidth()), y0 = (int) Math.ceil(c.y() * img.getHeight());
        int x1 = (int) Math.floor((c.x() + c.w()) * img.getWidth()), y1 = (int) Math.floor((c.y() + c.h()) * img.getHeight());
        assertThat(x1 - x0).isGreaterThan(50);
        long off = 0;
        for (int y = y0; y < y1; y++) {
            for (int x = x0; x < x1; x++) {
                int p = img.getRGB(x, y), dr = ((p >> 16) & 0xFF) - fabric.getRed(), dg = ((p >> 8) & 0xFF) - fabric.getGreen(), db = (p & 0xFF) - fabric.getBlue();
                if (dr * dr + dg * dg + db * db > 30 * 30) off++;
            }
        }
        assertThat(off).as("pixels fora do tecido no quadro").isZero();
    }

    private static void assertPortrait34(BufferedImage img, NRect c) {
        assertThat(c.w() * img.getWidth() / (c.h() * img.getHeight())).isCloseTo(0.75, within(0.01));
    }

    @Test
    void camisetaNoPacoteQuadroNoPeitoSoComTecido() {
        BufferedImage img = tee(200, 200, 1.0);
        Map<String, Object> f = frame(img, "upper_piece", "t_shirt");
        assertThat(f).containsEntry("ok", true).containsEntry("target", "chest").containsEntry("fabricCoverage", 1.0);
        NRect c = crop(f);
        assertPortrait34(img, c);
        assertAllFabric(img, c, NAVY);
        // abaixo da gola (decote começa em y=200+40) e sem as mangas (tronco entre x=330 e x=670)
        assertThat(c.y() * 1000).isGreaterThan(240);
        assertThat(c.x() * 1000).isGreaterThanOrEqualTo(330 - 1);
        assertThat((c.x() + c.w()) * 1000).isLessThanOrEqualTo(670 + 1);
    }

    @Test
    void pessoaVestindoQuadroSemPeleSemRostoSemBracos() {
        BufferedImage img = teeOnPerson();
        Map<String, Object> f = frame(img, "upper_piece", "t_shirt");
        assertThat(f).containsEntry("ok", true);
        assertThat((Double) f.get("skinExcluded")).isGreaterThan(0.0);
        assertAllFabric(img, crop(f), NAVY);
    }

    @Test
    void jaquetaAbertaQuadroNoPainelDaFrenteForaDaAbertura() {
        BufferedImage img = tee(100, 60, 1.4);                         // tronco entre x=282 e x=758, centro em x=520
        Graphics2D g = pen(img, RED);                                 // camiseta vermelha aparecendo na abertura central
        g.fillRect(490, 120, 60, 780);
        g.dispose();
        Map<String, Object> f = frame(img, "upper_piece", "jacket");
        assertThat(f).containsEntry("ok", true).containsEntry("target", "front_panel");
        NRect c = crop(f);
        assertThat((c.x() + c.w()) * 1000).as("quadro termina antes da abertura").isLessThan(490);
        assertAllFabric(img, c, NAVY);
    }

    @Test
    void calcaQuadroNoGanchoComOZiperNuncaNumaPernaSo() {
        BufferedImage img = jeans();
        Map<String, Object> f = frame(img, "lower_piece", "jeans");
        assertThat(f).containsEntry("ok", true).containsEntry("target", "fly");
        NRect c = crop(f);
        assertPortrait34(img, c);
        assertAllFabric(img, c, DENIM);
        // o quadro começa no bloco da cintura/gancho (y 120–450), não abaixo do gancho, numa perna
        assertThat(c.y() * 1200).isLessThan(450);
        assertThat((c.x() + c.w() / 2) * 900).isCloseTo(450, within(60.0));
    }

    @Test
    void calcadoQuadroNoCabedalSemASola() {
        BufferedImage img = sneakers();
        Map<String, Object> f = frame(img, "shoes_piece", "casual_sneakers");
        if (Boolean.TRUE.equals(f.get("ok"))) {
            assertThat(f).containsEntry("target", "upper");
            assertAllFabric(img, crop(f), RED);
            assertThat((crop(f).y() + crop(f).h()) * 900).as("acima da sola (y=640)").isLessThanOrEqualTo(641);
        } else {
            assertThat(f.get("reason")).isIn("FABRIC_REGION_TOO_SMALL", "NO_FABRIC_REGION");
        }
    }

    @Test
    void joiasERelogioNaoTemQuadroDeTecido() {
        Map<String, Object> f = frame(watch(), "accessory_piece", "watch");
        assertThat(f).containsEntry("ok", false).containsEntry("reason", "NOT_TEXTILE_ACCESSORY");
        assertThat(f.get("crop")).isNull();
    }

    @Test
    void pecaEstreitaDemaisNaoGanhaQuadroComFundo() {
        // gravata/faixa de 160 px de altura numa foto de 1200 px — o maior 3:4 só de tecido teria ~110 px de largura
        int w = 1200, h = 900;
        BufferedImage cut = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        boolean[] mask = new boolean[w * h];
        for (int y = 370; y < 530; y++) for (int x = 100; x < 1100; x++) { mask[y * w + x] = true; cut.setRGB(x, y, 0xFF5A3A22); }
        var seg = new ProductSegmenter.Segmentation(cut, w, h, mask, new NRect(100.0 / w, 370.0 / h, 1000.0 / w, 160.0 / h), java.util.List.of(),
                0, 1000 * 160.0 / (w * h), 1, 0xF6F6F6, java.util.Set.of(), 1, false, 0, null);
        FabricFrame.Result r = FabricFrame.find(seg, PieceType.ACCESSORY_PIECE, "tie", null);
        assertThat(r.ok()).isFalse();
        assertThat(r.reason()).isEqualTo("FABRIC_REGION_TOO_SMALL");
        assertThat(r.fabricCoverage()).as("o que existe é só tecido, mas pequeno demais para o quadro").isEqualTo(1.0);
        // cinto: tira estreita com fivela de metal — sem quadro de tecido, pela subcategoria
        assertThat(FabricFrame.find(seg, PieceType.ACCESSORY_PIECE, "belt", null).reason()).isEqualTo("NOT_TEXTILE_ACCESSORY");
        // a mesma faixa com 600 px de altura (bolsa) tem quadro, e só de tecido
        boolean[] tall = new boolean[w * h];
        for (int y = 150; y < 750; y++) for (int x = 100; x < 1100; x++) { tall[y * w + x] = true; cut.setRGB(x, y, 0xFF5A3A22); }
        var bag = new ProductSegmenter.Segmentation(cut, w, h, tall, new NRect(100.0 / w, 150.0 / h, 1000.0 / w, 600.0 / h), java.util.List.of(),
                0, 1000 * 600.0 / (w * h), 1, 0xF6F6F6, java.util.Set.of(), 1, false, 0, null);
        FabricFrame.Result ok = FabricFrame.find(bag, PieceType.ACCESSORY_PIECE, "handbag", null);
        assertThat(ok.ok()).isTrue();
        assertThat(ok.target()).isEqualTo("body");
        assertThat(ok.fabricCoverage()).isEqualTo(1.0);
    }

    @Test
    void fundoCercadoPelaPecaNuncaEntraNoQuadro() {
        // bolsa com alça: o fundo dentro da alça não encosta na borda da foto, mas continua sendo fundo
        BufferedImage img = studio(1000, 1000, 246);
        Graphics2D g = pen(img, DENIM);
        g.fillRect(250, 150, 500, 650);
        g.dispose();
        g = pen(img, new Color(246, 246, 246));
        g.fillRect(400, 330, 200, 160);                                // "janela" de fundo no meio da peça
        g.dispose();
        Map<String, Object> f = frame(img, "accessory_piece", "tote_bag");
        assertThat(f).containsEntry("ok", true);
        assertAllFabric(img, crop(f), DENIM);
    }

    @Test
    void estampaComPontinhosClarosContinuaTecido() {
        BufferedImage img = tee(200, 200, 1.0);
        Graphics2D g = pen(img, new Color(246, 246, 246));             // poá da cor do fundo, 6 px
        for (int y = 300; y < 760; y += 40) for (int x = 340; x < 660; x += 40) g.fillOval(x, y, 6, 6);
        g.dispose();
        Map<String, Object> f = frame(img, "upper_piece", "t_shirt");
        assertThat(f).containsEntry("ok", true);
        assertThat(crop(f).w() * 1000).as("o poá não esburaca o quadro").isGreaterThan(200);
    }

    @Test
    void camisetaDaCorDoFundoSobreModeloNaoViraQuadroNoShort() {
        // camiseta branca num fundo branco some da máscara: sobra rosto, braços e o short — o quadro não pode cair no short
        BufferedImage img = studio(1000, 1400, 246);
        Graphics2D g = pen(img, SKIN);
        g.fillOval(430, 40, 140, 180); g.fillRect(470, 210, 60, 60);
        g.fillRect(260, 300, 70, 420); g.fillRect(670, 300, 70, 420);  // braços
        g.fillRect(350, 1000, 120, 380); g.fillRect(530, 1000, 120, 380); // pernas
        g.setColor(new Color(244, 244, 244)); g.fillRect(330, 270, 340, 470); // camiseta branca
        g.setColor(new Color(0x15, 0x15, 0x18)); g.fillRect(340, 740, 320, 280); // short preto
        g.dispose();
        Map<String, Object> f = frame(img, "upper_piece", "t_shirt");
        assertThat(f).containsEntry("ok", false);
        assertThat(f.get("reason")).isIn("GARMENT_NOT_ISOLATED", "SEGMENTATION_FRAGMENT", "NO_FABRIC_REGION", "FABRIC_REGION_TOO_SMALL");
    }

    @Test
    void erosaoTiraABordaDaMascara() {
        boolean[] in = new boolean[10 * 10];
        for (int y = 2; y < 8; y++) for (int x = 2; x < 8; x++) in[y * 10 + x] = true;
        boolean[] out = FabricFrame.erode(in, 10, 10, 1);
        int n = 0;
        for (boolean b : out) n += b ? 1 : 0;
        assertThat(n).isEqualTo(16);                                   // 6×6 → 4×4
        assertThat(out[3 * 10 + 3]).isTrue();
        assertThat(out[2 * 10 + 2]).isFalse();
    }
}
