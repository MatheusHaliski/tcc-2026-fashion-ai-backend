package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.imaging.FeedFraming;
import org.junit.jupiter.api.Test;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.util.Map;

import static br.com.fashionai.application.catalog.image.CatalogPhotos.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * Lote de enquadramento do acervo V3: o quadro 3:4 segue a Regra de Enquadramento do Produto do card
 * (catalog/semantic-regions.json) — parte de cima preenche o quadro com a gola no topo, parte de baixo com o cós no topo e
 * as pernas além da base, calçado inteiro na largura, bolsa inteira contida — e, em foto com modelo, sem rosto/pescoço acima
 * da gola e sem a camisa acima do cós. Quadro de cobertura com menos de 55% da largura da peça na faixa do topo (tronco no
 * decote, quadril no cós) é um zoom de tecido: recusado. Sem quadro possível, o motivo (a foto não é reenquadrada).
 */
class ProductRuleFrameTest {
    private final CatalogImagePipeline pipeline = new CatalogImagePipeline(SemanticRegionRegistry.get(), null);

    private ProductRuleFrame.Result frame(BufferedImage img, String category, String sub) {
        ProductSegmenter.Segmentation seg = new ProductSegmenter().segment(img, PieceType.of(category));
        return ProductRuleFrame.find(seg, PieceType.of(category), sub, SemanticRegionRegistry.get());
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> viaPipeline(BufferedImage img, String category, String sub) {
        CatalogImagePipeline.Analysis a = pipeline.run(new CatalogImagePipeline.Request(png(img), category, sub, "PACKSHOT", false));
        return (Map<String, Object>) a.debug().get("productFrame");
    }

    /** Pixels do quadro (na foto) com cor longe da cor da peça; tolerância só para antisserrilhado/ruído. */
    private static long offColor(BufferedImage img, NRect c, Color fabric, int y1Limit) {
        int x0 = (int) Math.ceil(c.x() * img.getWidth()), y0 = (int) Math.ceil(c.y() * img.getHeight());
        int x1 = (int) Math.floor(c.x2() * img.getWidth()), y1 = Math.min(y1Limit, (int) Math.floor(c.y2() * img.getHeight()));
        long off = 0;
        for (int y = y0; y < y1; y++) {
            for (int x = x0; x < x1; x++) {
                int p = img.getRGB(x, y), dr = ((p >> 16) & 0xFF) - fabric.getRed(), dg = ((p >> 8) & 0xFF) - fabric.getGreen(), db = (p & 0xFF) - fabric.getBlue();
                if (dr * dr + dg * dg + db * db > 30 * 30) off++;
            }
        }
        return off;
    }

    private static void assertAspect34(BufferedImage img, NRect c) {
        assertThat(c.w() * img.getWidth() / (c.h() * img.getHeight())).isCloseTo(0.75, within(0.01));
    }

    @Test
    void camisetaPackshotPreencheOQuadroComAGolaNoTopo() {
        BufferedImage img = tee(200, 200, 1.0);            // tronco x 330–670, gola no topo y=200, decote até y=240, barra y=800
        ProductRuleFrame.Result r = frame(img, "upper_piece", "t_shirt");
        assertThat(r.ok()).as(String.valueOf(r.reason())).isTrue();
        assertThat(r.rule().fit()).isEqualTo(SemanticRegionRegistry.FramingRule.Fit.COVER);
        assertThat(r.rule().align()).isEqualTo(SemanticRegionRegistry.FramingRule.Align.TOP);
        NRect c = r.crop();
        assertAspect34(img, c);
        // cover: 100% peça, nada de fundo
        assertThat(r.garmentCoverage()).isEqualTo(1.0);
        assertThat(offColor(img, c, NAVY, Integer.MAX_VALUE)).as("fundo no quadro").isZero();
        // gola/decote na borda de cima: o quadro começa no fundo do decote (y=240), a menos de 8% da altura da peça abaixo da gola
        assertThat(c.y() * 1000).isBetween(236.0, 250.0);
        // preenche a largura do tronco (mangas cortadas pelas laterais), centrado na peça
        assertThat(c.w() * 1000).isGreaterThan(0.92 * 340);
        assertThat(c.cx() * 1000).isCloseTo(500, within(8.0));
        // a gola (foco do registro) fica na metade de cima do quadro
        assertThat(r.compliance()).containsEntry("focusInTopHalf", true).containsEntry("ok", true);
        assertThat(r.ruleOrigin()).isEqualTo("pieceType");
        assertThat(r.target()).isEqualTo("neckline_top");
        // packshot: o quadro tem a largura do tronco — bem acima do mínimo de 55% da largura da peça
        assertThat(widthShare(r)).isGreaterThanOrEqualTo(ProductRuleFrame.MIN_COVER_WIDTH_SHARE);
    }

    private static double widthShare(ProductRuleFrame.Result r) {
        return ((Number) r.compliance().get("frameWidthShare")).doubleValue();
    }

    @Test
    void jeansPackshotCosNoTopoLarguraTodaEPernasAlemDaBase() {
        BufferedImage img = jeans();                        // cós y=120, quadril x 270–630, gancho y=440, barra y=1080
        ProductRuleFrame.Result r = frame(img, "lower_piece", "jeans");
        assertThat(r.ok()).as(String.valueOf(r.reason())).isTrue();
        NRect c = r.crop();
        assertAspect34(img, c);
        assertThat(c.y() * 1200).as("cós na borda de cima").isBetween(118.0, 128.0);
        assertThat(c.w() * 900).as("a calça preenche a largura do quadro").isGreaterThan(0.95 * 360);
        assertThat(c.cx() * 900).isCloseTo(450, within(8.0));
        assertThat(c.y2() * 1200).as("as pernas seguem além da base").isLessThan(1080).isGreaterThan(440);
        // do cós ao gancho, só calça; o vão entre as pernas abaixo do gancho é o da regra (pernas além da base)
        assertThat(r.coverageScope()).isEqualTo("WAIST_TO_CROTCH");
        assertThat(r.garmentCoverage()).isEqualTo(1.0);
        assertThat(offColor(img, c, DENIM, 440)).isZero();
        assertThat(r.observations()).contains("LEGS_CONTINUE_PAST_FRAME");
        assertThat(r.compliance()).containsEntry("focusInTopHalf", true);
    }

    @Test
    void tenisInteiroNaLarguraComFolgaENadaCortado() {
        BufferedImage img = sneakers();                     // tênis x 150–1020, y 300–680 (com a sola), fundo 245
        ProductRuleFrame.Result r = frame(img, "shoes_piece", "running_shoes");
        assertThat(r.ok()).as(String.valueOf(r.reason())).isTrue();
        assertThat(r.rule().fit()).isEqualTo(SemanticRegionRegistry.FramingRule.Fit.WIDTH);
        NRect c = r.crop(), p = r.product();
        assertAspect34(img, c);
        assertThat(r.objectInside()).isCloseTo(1.0, within(1e-9));
        assertThat(p.x() * 1200).isCloseTo(150, within(3.0));
        assertThat(p.x2() * 1200).isCloseTo(1020, within(3.0));
        // comprimento inteiro na largura, com a folga mínima de 2% de cada lado
        double left = (p.x() - c.x()) / c.w(), right = (c.x2() - p.x2()) / c.w();
        assertThat(left).isCloseTo(0.02, within(0.006));
        assertThat(right).isCloseTo(0.02, within(0.006));
        // centrado na vertical, fundo em cima e embaixo (a foto é mais larga que 3:4: o resto vem da cor do fundo)
        assertThat(c.cy()).isCloseTo(p.cy(), within(0.01));
        assertThat(r.padding()).isGreaterThan(0);
        assertThat(r.background()).isNotNull();
        assertThat(r.observations()).contains("PADDED_WITH_STUDIO_BACKGROUND");
        assertThat(r.sideView()).isTrue();
    }

    @Test
    void bolsaInteiraContidaECentrada() {
        BufferedImage img = studio(1000, 1000, 246);
        Graphics2D g = pen(img, new Color(0x5A, 0x3A, 0x22));
        g.fillRoundRect(300, 420, 400, 330, 30, 30);        // corpo
        g.setStroke(new java.awt.BasicStroke(18));
        g.drawArc(380, 260, 240, 320, 0, 180);              // alça (com fundo dentro)
        g.dispose();
        ProductRuleFrame.Result r = frame(img, "accessory_piece", "handbag");
        assertThat(r.ok()).as(String.valueOf(r.reason())).isTrue();
        assertThat(r.rule().fit()).isEqualTo(SemanticRegionRegistry.FramingRule.Fit.CONTAIN);
        NRect c = r.crop(), p = r.product();
        assertAspect34(img, c);
        assertThat(r.objectInside()).isCloseTo(1.0, within(1e-9));
        assertThat(p.y() * 1000).as("a alça faz parte da bolsa").isLessThan(262);
        // folga de fundo em volta, objeto no centro
        assertThat((p.x() - c.x()) / c.w()).isGreaterThanOrEqualTo(0.019);
        assertThat((c.x2() - p.x2()) / c.w()).isGreaterThanOrEqualTo(0.019);
        assertThat((p.y() - c.y()) / c.h()).isGreaterThanOrEqualTo(0.019);
        assertThat((c.y2() - p.y2()) / c.h()).isGreaterThanOrEqualTo(0.019);
        assertThat(c.cx()).isCloseTo(p.cx(), within(0.005));
        assertThat(c.cy()).isCloseTo(p.cy(), within(0.005));
    }

    /** Pessoa vestindo a camiseta: rosto e pescoço (pele) descendo até o fundo do decote em V (y=300), braços ao lado. */
    private static BufferedImage teeOnModel() {
        BufferedImage img = studio(1000, 1200, 240);
        Graphics2D g = pen(img, SKIN);
        g.fillOval(420, 20, 160, 200);
        g.fillRect(455, 200, 90, 110);                      // pescoço até abaixo do decote: a pele preenche o V
        g.fillRect(150, 470, 70, 380);
        g.fillRect(780, 470, 70, 380);
        g.dispose();
        drawTee(img, 200, 260, 1.0, NAVY);
        return img;
    }

    @Test
    void camisetaNaModeloSemPeleAcimaDaGola() {
        BufferedImage img = teeOnModel();
        ProductRuleFrame.Result r = frame(img, "upper_piece", "t_shirt");
        assertThat(r.ok()).as(String.valueOf(r.reason())).isTrue();
        assertThat(r.model()).isTrue();
        assertThat(r.observations()).contains("MODEL_PHOTO");
        NRect c = r.crop();
        assertAspect34(img, c);
        assertThat(offColor(img, c, NAVY, Integer.MAX_VALUE)).as("pele/fundo no quadro").isZero();
        // o quadro começa no decote: nada do pescoço (x 465–535 até y=290) e logo abaixo dele
        assertThat(c.y() * 1200).isBetween(296.0, 330.0);
        assertThat(c.w() * 1000).isGreaterThan(0.9 * 340);
        // quadro normal em foto com modelo: mantido, com a largura do tronco (≥ 55% da largura da peça nas linhas do quadro)
        assertThat(widthShare(r)).isGreaterThanOrEqualTo(ProductRuleFrame.MIN_COVER_WIDTH_SHARE);
        assertThat(r.compliance()).containsKey("garmentWidthPx");
    }

    @Test
    void quadroEstreitoNaModeloEZoomDeTecidoERecusado() {
        // polo de listras claras na modelo (como a polo_shirt 018 do acervo): a listra da cor do fundo sai da máscara e só
        // sobra, para o quadro de cobertura, a faixa escura à direita — um quadro de ~180 px num tronco de 340 px com mangas
        BufferedImage img = teeOnModel();
        Graphics2D g = pen(img, new Color(240, 240, 240));
        g.fillRect(380, 300, 90, 560);
        g.dispose();
        ProductRuleFrame.Result r = frame(img, "upper_piece", "polo_shirt");
        assertThat(r.ok()).isFalse();
        assertThat(r.reason()).isEqualTo("COVER_FRAME_TOO_NARROW");
        assertThat(r.model()).isTrue();
        // o quadro recusado fica registrado com a medida: menos de 55% da largura da peça na faixa do topo
        assertThat(r.crop()).isNotNull();
        assertThat(widthShare(r)).isLessThan(ProductRuleFrame.MIN_COVER_WIDTH_SHARE);
        assertThat(r.cropWidthPx()).isGreaterThanOrEqualTo(ProductRuleFrame.MIN_WIDTH_PX);
        // o lote recebe a recusa (a foto fica como está)
        Map<String, Object> f = viaPipeline(img, "upper_piece", "polo_shirt");
        assertThat(f).containsEntry("ok", false).containsEntry("reason", "COVER_FRAME_TOO_NARROW");
    }

    /** Modelo de camisa vermelha por fora da calça jeans: rosto, braços, camisa até y=640, calça até os pés. */
    private static BufferedImage jeansOnModel() {
        BufferedImage img = studio(1000, 1600, 240);
        Graphics2D g = pen(img, SKIN);
        g.fillOval(440, 60, 120, 170); g.fillRect(475, 220, 50, 60);
        g.fillRect(300, 330, 55, 330); g.fillRect(645, 330, 55, 330);   // braços
        g.setColor(RED); g.fillRect(355, 270, 290, 370);                 // camisa até y=640
        g.setColor(DENIM); g.fillRect(360, 640, 280, 300);               // calça: cós em y=640, gancho em y=940
        g.fillRect(360, 940, 130, 560); g.fillRect(510, 940, 130, 560);   // pernas
        g.setColor(new Color(0x1A, 0x1A, 0x1A)); g.fillRect(350, 1500, 150, 60); g.fillRect(500, 1500, 150, 60);
        g.dispose();
        return img;
    }

    @Test
    void jeansNaModeloComecaNoCosSemACamisa() {
        BufferedImage img = jeansOnModel();
        ProductRuleFrame.Result r = frame(img, "lower_piece", "jeans");
        assertThat(r.ok()).as(String.valueOf(r.reason())).isTrue();
        assertThat(r.model()).isTrue();
        NRect c = r.crop();
        assertAspect34(img, c);
        // a camisa acima do cós fica de fora: nenhum pixel vermelho no quadro; o topo é o cós
        assertThat(c.y() * 1600).isBetween(638.0, 660.0);
        assertThat(offColor(img, c, DENIM, 940)).as("camisa/pele/fundo entre o cós e o gancho").isZero();
        assertThat(c.w() * 1000).isGreaterThan(0.9 * 280);
        assertThat(c.y2() * 1600).as("pernas além da base").isGreaterThan(940).isLessThan(1500);
        // quadro normal: a largura do quadril
        assertThat(widthShare(r)).isGreaterThanOrEqualTo(ProductRuleFrame.MIN_COVER_WIDTH_SHARE);
    }

    @Test
    void jaquetaAbertaEstreitandoOCosDeixaQuadroEstreitoERecusado() {
        // jaqueta aberta caindo sobre o quadril dos dois lados (como a chino_pants 046 do acervo): do cós até a barra da
        // jaqueta só o vão do meio (140 px) é calça; o quadril mede 280 px — o quadro que cabe é um zoom da braguilha
        BufferedImage img = jeansOnModel();
        Graphics2D g = pen(img, new Color(0x2E, 0x4A, 0x2E));
        g.fillRect(355, 270, 75, 470);
        g.fillRect(570, 270, 75, 470);
        g.dispose();
        ProductRuleFrame.Result r = frame(img, "lower_piece", "chino_pants");
        assertThat(r.ok()).isFalse();
        assertThat(r.reason()).isEqualTo("COVER_FRAME_TOO_NARROW");
        assertThat(r.crop().w() * 1000).isLessThan(150);
        assertThat(((Number) r.compliance().get("garmentWidthPx")).intValue()).isBetween(260, 290);
        assertThat(widthShare(r)).isLessThan(ProductRuleFrame.MIN_COVER_WIDTH_SHARE);
    }

    @Test
    void objetoNaPessoaNaoEIsoladoESemQuadro() {
        // tênis "no pé": pernas (pele) coladas ao calçado — a caixa seria a pessoa
        BufferedImage img = studio(1000, 1200, 244);
        Graphics2D g = pen(img, SKIN);
        g.fillRect(400, 0, 90, 900); g.fillRect(540, 0, 90, 900);
        g.setColor(RED); g.fillRoundRect(330, 880, 190, 120, 40, 40); g.fillRoundRect(520, 880, 190, 120, 40, 40);
        g.dispose();
        ProductRuleFrame.Result r = frame(img, "shoes_piece", "running_shoes");
        assertThat(r.ok()).isFalse();
        assertThat(r.reason()).isEqualTo("PIECE_NOT_ISOLATED");
        assertThat(r.crop()).isNull();
        // bolsa no ombro de uma modelo de corpo inteiro: a caixa seria a pessoa
        BufferedImage carried = studio(1000, 1500, 242);
        g = pen(carried, SKIN);
        g.fillOval(440, 30, 120, 160); g.fillRect(475, 180, 50, 60);
        g.fillRect(300, 300, 60, 420); g.fillRect(640, 300, 60, 420);   // braços
        g.fillRect(400, 1000, 80, 470); g.fillRect(520, 1000, 80, 470);  // pernas
        g.setColor(NAVY); g.fillRect(360, 240, 280, 780);                 // vestido
        g.setColor(new Color(0x5A, 0x3A, 0x22)); g.fillRect(690, 600, 200, 180); g.fillRect(690, 300, 12, 300);  // bolsa e alça
        g.dispose();
        ProductRuleFrame.Result bag = frame(carried, "accessory_piece", "handbag");
        assertThat(bag.ok()).isFalse();
        assertThat(bag.reason()).isEqualTo("PIECE_NOT_ISOLATED");
    }

    @Test
    void acessorioSemTecidoAgoraEnquadradoInteiroPelaRegra() {
        // relógio: COVER com o mostrador no centro (sobrescrita do registro) — não é mais recusado
        ProductRuleFrame.Result watch = frame(watch(), "accessory_piece", "watch");
        assertThat(watch.ok()).as(String.valueOf(watch.reason())).isTrue();
        assertThat(watch.rule().fit()).isEqualTo(SemanticRegionRegistry.FramingRule.Fit.COVER);
        assertThat(watch.rule().align()).isEqualTo(SemanticRegionRegistry.FramingRule.Align.FOCUS);
        assertThat(watch.ruleOrigin()).isEqualTo("subcategory:watch");
        assertThat(watch.target()).isEqualTo("dial");
        assertThat(watch.crop().cx()).isCloseTo(watch.focus().cx(), within(0.01));
        assertThat(watch.crop().cy()).isCloseTo(watch.focus().cy(), within(0.01));
        // óculos: o par inteiro na largura
        BufferedImage img = studio(1200, 800, 246);
        Graphics2D g = pen(img, new Color(0x22, 0x22, 0x22));
        g.fillOval(240, 330, 300, 190); g.fillOval(660, 330, 300, 190); g.fillRect(520, 380, 160, 20);
        g.dispose();
        ProductRuleFrame.Result glasses = frame(img, "accessory_piece", "sunglasses");
        assertThat(glasses.ok()).as(String.valueOf(glasses.reason())).isTrue();
        assertThat(glasses.rule().fit()).isEqualTo(SemanticRegionRegistry.FramingRule.Fit.WIDTH);
        assertThat(glasses.objectInside()).isCloseTo(1.0, within(1e-9));
        assertThat(glasses.product().w() / glasses.crop().w()).isCloseTo(0.96, within(0.01));
    }

    @Test
    void cintoInteiroCentradoQuandoAFivelaNaoFoiAchada() {
        // cinto enrolado: a fivela não está na ponta esquerda que o registro supõe — centrar nela deixaria o cinto num canto
        BufferedImage img = studio(1200, 900, 246);
        Graphics2D g = pen(img, new Color(0x4A, 0x30, 0x20));
        g.fillRoundRect(250, 380, 700, 140, 60, 60);
        g.setColor(new Color(0xB0, 0xB0, 0xB8)); g.fillRect(560, 360, 90, 180);   // fivela no meio
        g.dispose();
        ProductRuleFrame.Result r = frame(img, "accessory_piece", "belt");
        assertThat(r.ok()).as(String.valueOf(r.reason())).isTrue();
        assertThat(r.rule().fit()).isEqualTo(SemanticRegionRegistry.FramingRule.Fit.CONTAIN);
        assertThat(r.observations()).contains("FOCUS_NOT_DETECTED_CENTERED");
        assertThat(r.objectInside()).isCloseTo(1.0, within(1e-9));
        assertThat(r.crop().cx()).isCloseTo(r.product().cx(), within(0.005));
        assertThat(r.crop().cy()).isCloseTo(r.product().cy(), within(0.005));
    }

    @Test
    void pecaPequenaDemaisNaoGanhaQuadro() {
        BufferedImage img = studio(1000, 1000, 246);
        drawTee(img, 470, 470, 0.12, NAVY);                 // camiseta de ~70 px de largura
        ProductRuleFrame.Result r = frame(img, "upper_piece", "t_shirt");
        assertThat(r.ok()).isFalse();
        assertThat(r.reason()).isIn("SEGMENTATION_FRAGMENT", "NO_COVER_WINDOW_AT_TOP", "FRAME_TOO_SMALL");
    }

    @Test
    void pipelineEOLoteDevolvemOQuadroDaRegraComAFonteDaRegra() {
        Map<String, Object> f = viaPipeline(tee(200, 200, 1.0), "upper_piece", "t_shirt");
        assertThat(f).containsEntry("version", ProductRuleFrame.VERSION).containsEntry("ok", true).containsEntry("aspect", "3:4");
        assertThat(f.get("rule")).isEqualTo(Map.of("fit", "COVER", "align", "TOP", "view", "FRONT", "focusTopHalf", true));
        @SuppressWarnings("unchecked") Map<String, Object> source = (Map<String, Object>) f.get("ruleSource");
        assertThat(source).containsEntry("registry", "catalog/semantic-regions.json").containsEntry("pieceType", "UPPER_PIECE")
                .containsEntry("subcategory", "t_shirt").containsEntry("origin", "pieceType");
        assertThat(source.get("registryVersion")).isEqualTo(SemanticRegionRegistry.get().version());
        // o lote anuncia a capacidade no ready
        String ready = new CatalogImageBatchCli(SemanticRegionRegistry.get(), null).ready();
        assertThat(ready).contains("\"productFrameVersion\":\"" + ProductRuleFrame.VERSION + "\"");
    }

    @Test
    void mesmaRegraDoCardDoFeedSoMudaAProporcao() {
        // a caixa da peça e o perfil do registro dão o mesmo recorte em 4:5 (card do feed) e o teto do quadro 3:4 do lote
        NRect product = new NRect(0.2, 0.1, 0.6, 0.8);
        SemanticRegionRegistry.Profile shoes = SemanticRegionRegistry.get().profile(PieceType.SHOES_PIECE, "running_shoes");
        NRect feed = SemanticCropper.registryRuleCrop(1000, 1000, 0.8, product, shoes, 0);
        NRect batch = SemanticCropper.registryRuleCrop(1000, 1000, 0.75, product, shoes, 0);
        assertThat(feed.w()).isCloseTo(batch.w(), within(1e-9));           // WIDTH: a largura do objeto nos dois
        assertThat(feed.cy()).isCloseTo(batch.cy(), within(1e-9));         // CENTER
        assertThat(batch.h() / feed.h()).isCloseTo(0.8 / 0.75, within(1e-9));
        // o lado do registro: calçado de lado (SIDE) — o par visto de frente fica marcado
        boolean[] pair = new boolean[100 * 60];
        for (int y = 10; y < 50; y++) for (int x = 5; x < 45; x++) { pair[y * 100 + x] = true; pair[y * 100 + x + 50] = true; }
        assertThat(FeedFraming.looksSideView(pair, 100, 5, 10, 94, 49)).isFalse();
    }
}
