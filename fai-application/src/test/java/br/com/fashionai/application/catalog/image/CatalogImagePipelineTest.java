package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.catalog.image.CatalogImageValidator.Outcome;
import org.junit.jupiter.api.Test;

import java.awt.image.BufferedImage;

import static br.com.fashionai.application.catalog.image.CatalogPhotos.*;
import static org.assertj.core.api.Assertions.assertThat;

class CatalogImagePipelineTest {
    private final CatalogImagePipeline pipeline = new CatalogImagePipeline(SemanticRegionRegistry.get(), null);

    private CatalogImagePipeline.Analysis run(BufferedImage img, String category, String sub, boolean persist) {
        return pipeline.run(new CatalogImagePipeline.Request(jpeg(img), category, sub, "PACKSHOT", persist));
    }

    /** O recorte tem a proporção exata do quadro em pixels: a peça nunca é esticada. */
    private static void assertNoStretch(CatalogImagePipeline.Analysis a) {
        NRect c = a.crop().best().crop();
        assertThat(c.w() * a.width() / (c.h() * a.height())).isCloseTo(a.pieceType() == PieceType.LOWER_PIECE ? 2.0 : 0.8, org.assertj.core.data.Offset.offset(1e-6));
    }

    private static java.util.Map<String, Object> compliance(CatalogImagePipeline.Analysis a) {
        return a.crop().compliance();
    }

    private static double focusY(CatalogImagePipeline.Analysis a) {
        NRect c = a.crop().best().crop();
        return (a.focus().rect().cy() - c.y()) / c.h();
    }

    @Test
    void packshotDeCamisetaPreencheOQuadroComTecidoSemFundo() {
        CatalogImagePipeline.Analysis a = run(tee(200, 200, 1.0), "upper_piece", "t_shirt", false);
        assertThat(a.outcome()).as(a.reasons().toString()).isEqualTo(Outcome.APPROVED);
        assertThat(a.pieceType()).isEqualTo(PieceType.UPPER_PIECE);
        assertNoStretch(a);
        assertThat(compliance(a)).containsEntry("ok", true).containsEntry("focusInTopHalf", true);
        assertThat((Double) compliance(a).get("frameFilledByProduct")).isGreaterThan(0.97);
        NRect c = a.crop().best().crop(), p = a.productBox();
        assertThat(c.y()).as("recorte interno não inclui fundo junto à gola").isGreaterThan(p.y());
        assertThat(compliance(a)).containsEntry("foregroundOnly", true);
        assertThat(focusY(a)).isLessThan(0.5);
        assertThat(a.cropJson()).containsKeys("rule", "ruleCompliant");
        assertThat(a.metrics()).containsKeys("segmentationConfidence", "productVisibility", "occupancyScore", "emptySpaceScore",
                "focusScore", "logoPreservationScore", "colorPreservationScore", "edgeQuality", "reconstructionConfidence", "sourceQuality");
        assertThat(a.phash()).hasSize(16);
        assertThat(a.sha256()).hasSize(64);
        assertThat(a.rendered()).as("nível A não gera master").isNull();
        assertThat(a.cropJson()).containsKeys("crop", "focus", "product", "background");
        assertThat(a.stages()).extracting(CatalogImagePipeline.Stage::name)
                .containsExactly("VALIDATION", "SEGMENTATION", "DISTRACTOR_REMOVAL", "ROI", "FABRIC_FRAME", "PRODUCT_RULE_FRAME", "REFRAMING", "VALIDATING");
    }

    @Test
    void pecaPequenaNoCantoEhReenquadradaNoCentro() {
        CatalogImagePipeline.Analysis a = run(tee(40, 40, 0.6), "upper_piece", "t_shirt", false);
        assertThat(a.outcome()).isNotEqualTo(Outcome.REJECTED);
        NRect c = a.crop().best().crop(), p = a.productBox();
        assertThat(Math.abs((p.cx() - c.x()) / c.w() - 0.5)).isLessThan(0.08);
        assertThat(compliance(a)).containsEntry("ok", true);
    }

    @Test
    void jeansEnquadraCosBolsosEQuadrilEmPaisagem() {
        CatalogImagePipeline.Analysis a = run(jeans(), "lower_piece", "jeans", false);
        assertThat(a.outcome()).as(a.reasons().toString()).isEqualTo(Outcome.APPROVED);
        assertThat(a.focus().name()).isEqualTo("waistband_pockets_fastening");
        NRect p = a.productBox(), f = a.focus().rect(), c = a.crop().best().crop();
        assertThat(f.y()).isLessThan(p.y() + 0.05 * p.h());
        assertThat(f.y2()).isLessThan(p.y() + 0.45 * p.h());
        assertThat(compliance(a)).containsEntry("view", "ANY").containsEntry("focusInTopHalf", true).containsEntry("ok", true);
        assertThat((Double) compliance(a).get("widthFilledByProduct")).isGreaterThan(0.97);
        assertThat(c.y()).isCloseTo(p.y(), org.assertj.core.data.Offset.offset(0.01));
        assertNoStretch(a);
    }

    @Test
    void modeloDeCorpoInteiroMostraQuadrilSemRostoCamisetaOuFundo() {
        var a = pipeline.run(new CatalogImagePipeline.Request(png(pantsOnModel(false)), "lower_piece", "jeans", "FRONT", false));
        assertThat(a.outcome()).as(a.reasons().toString()).isEqualTo(Outcome.APPROVED);
        assertThat(a.focus().source()).isEqualTo("ESTIMATED_PERSON_WAIST");
        assertThat(a.cropJson()).containsEntry("aspect", "2:1");
        NRect c = a.crop().best().crop();
        assertThat(c.y() * a.height()).isGreaterThan(650);
        assertThat(c.y2() * a.height()).isLessThan(900);
        assertThat(a.debug().get("cropHumanEvidence")).isEqualTo(0.0);
        assertNoStretch(a);
    }

    @Test
    void maoDentroDoQuadrilNaoEhTratadaComoTecido() {
        var a = pipeline.run(new CatalogImagePipeline.Request(png(pantsOnModel(true)), "lower_piece", "jeans", "FRONT", false));
        assertThat(a.outcome()).isEqualTo(Outcome.NEEDS_REPROCESSING);
        assertThat(a.reasons()).contains("HUMAN_PRESENT");
    }

    @Test
    void vistaDeclaradaDiferenteDaExigidaVaiParaRevisao() {
        CatalogImagePipeline.Analysis front = pipeline.run(new CatalogImagePipeline.Request(jpeg(tee(200, 200, 1.0)), "upper_piece", "t_shirt", "BACK", false));
        assertThat(front.outcome()).isEqualTo(Outcome.NEEDS_REPROCESSING);
        assertThat(front.reasons()).contains("VIEW_MISMATCH_FRONT");
        CatalogImagePipeline.Analysis back = pipeline.run(new CatalogImagePipeline.Request(jpeg(tee(200, 200, 1.0)), "upper_piece", "t_shirt", "FRONT", false));
        assertThat(back.outcome()).as(back.reasons().toString()).isEqualTo(Outcome.APPROVED);
    }

    @Test
    void tenisFocaNoCadarcoEMocassimNaGaspea() {
        CatalogImagePipeline.Analysis sneaker = run(sneakers(), "shoes_piece", "casual_sneakers", false);
        assertThat(sneaker.outcome()).as(sneaker.reasons().toString()).isNotEqualTo(Outcome.REJECTED);
        assertThat(sneaker.focus().name()).isEqualTo("laces_tongue_upper");
        CatalogImagePipeline.Analysis loafer = run(sneakers(), "shoes_piece", "loafers", false);
        assertThat(loafer.focus().name()).isEqualTo("vamp");
        assertNoStretch(sneaker);
        // vista lateral: o comprimento todo do calçado ocupa a largura do quadro
        assertThat(compliance(sneaker)).containsEntry("fit", "WIDTH").containsEntry("view", "SIDE");
        assertThat((Double) compliance(sneaker).get("widthFilledByProduct")).isGreaterThan(0.97);
        assertThat((Double) compliance(sneaker).get("productInsideFrame")).isGreaterThan(0.99);
    }

    @Test
    void relogioFocaNoMostrador() {
        CatalogImagePipeline.Analysis a = run(watch(), "accessory_piece", "watch", false);
        assertThat(a.outcome()).isNotEqualTo(Outcome.REJECTED);
        assertThat(a.focus().name()).isEqualTo("dial");
        assertThat(a.crop().best().parts().get("completeness")).isGreaterThan(0.999);
        // o centro do mostrador fica no centro do quadro
        java.util.Map<?, ?> fc = (java.util.Map<?, ?>) compliance(a).get("focusCenter");
        assertThat((Double) fc.get("x")).isCloseTo(0.5, org.assertj.core.data.Offset.offset(0.03));
        assertThat((Double) fc.get("y")).isCloseTo(0.5, org.assertj.core.data.Offset.offset(0.03));
    }

    @Test
    void fragmentoDaPecaNaoAprovaOCloseDoDetalhe() {
        // só um detalhe escuro (patch de 23% × 19% da foto, como o gorro cinza da Billabong) sobre fundo claro: a segmentação acha o patch, não a peça clara
        BufferedImage img = CatalogPhotos.studio(1920, 2400, 244);
        java.awt.Graphics2D g = img.createGraphics();
        g.setColor(new java.awt.Color(0x1A2340));
        g.fillOval(890, 720, 450, 450);
        g.dispose();
        CatalogImagePipeline.Analysis a = run(img, "accessory_piece", "beanie", false);
        assertThat(a.reasons()).contains("SEGMENTATION_FRAGMENT");
        assertThat(a.outcome()).isNotEqualTo(Outcome.APPROVED);
        // a mesma lasca declarada como foto de detalhe não é fragmento
        CatalogImagePipeline.Analysis d = pipeline.run(new CatalogImagePipeline.Request(jpeg(img), "accessory_piece", "beanie", "DETAIL", false));
        assertThat(d.reasons()).doesNotContain("SEGMENTATION_FRAGMENT");
    }

    @Test
    void ganchoDoCabideSaiDaMascara() {
        CatalogImagePipeline.Analysis a = run(teeOnHanger(), "upper_piece", "t_shirt", false);
        assertThat(a.debug().get("hangerTrimmed")).isEqualTo(true);
        assertThat(a.productBox().y() * a.height()).isGreaterThan(250);
    }

    @Test
    void aderecoSeparadoViraDistratorEFicaForaDoRecorte() {
        CatalogImagePipeline.Analysis a = run(teeWithProp(), "upper_piece", "t_shirt", false);
        assertThat((java.util.List<?>) a.debug().get("distractors")).isNotEmpty();
        assertThat(a.productBox().x2()).isLessThan(0.75);
        assertThat(a.crop().best().parts().get("distractor")).isGreaterThan(0.5);
    }

    @Test
    void pessoaVestindoVaiParaRevisaoNoNivelAEReprovaNoNivelB() {
        CatalogImagePipeline.Analysis tierA = run(teeOnPerson(), "upper_piece", "t_shirt", false);
        assertThat(tierA.reasons()).contains("HUMAN_PRESENT");
        assertThat(tierA.outcome()).isEqualTo(Outcome.NEEDS_REPROCESSING);
        CatalogImagePipeline.Analysis tierB = run(teeOnPerson(), "upper_piece", "t_shirt", true);
        assertThat(tierB.outcome()).isEqualTo(Outcome.REJECTED);
        assertThat(tierB.reasons()).contains("HUMAN_OCCLUSION_REJECT_IMAGE");
        assertThat(tierB.metrics().get("reconstructionConfidence")).isZero();
    }

    @Test
    void pecaCortadaNaOrigemNaoGanhaPaddingNoLadoCortado() {
        CatalogImagePipeline.Analysis a = run(teeCutAtBottom(), "upper_piece", "t_shirt", false);
        assertThat(a.debug().get("truncated").toString()).contains("bottom");
        assertThat(a.reasons()).contains("PRODUCT_TRUNCATED_IN_SOURCE");
        assertThat(a.crop().best().crop().y2()).isCloseTo(1.0, org.assertj.core.data.Offset.offset(1e-9));
    }

    @Test
    void fotoPequenaEFormatoInvalidoSaoRejeitadosSemUpscale() {
        CatalogImagePipeline.Analysis small = run(studio(200, 260, 245), "upper_piece", "t_shirt", false);
        assertThat(small.outcome()).isEqualTo(Outcome.REJECTED);
        assertThat(small.reasons()).containsExactly("IMAGE_TOO_SMALL");
        byte[] gif = "GIF89a\u0001\u0000\u0001\u0000\u0000\u0000\u0000".getBytes(java.nio.charset.StandardCharsets.ISO_8859_1);
        CatalogImagePipeline.Analysis bad = pipeline.run(new CatalogImagePipeline.Request(gif, "upper_piece", "t_shirt", "FRONT", false));
        assertThat(bad.reasons()).containsExactly("UNSUPPORTED_MIME");
    }

    @Test
    void fundoVazioNaoTemProduto() {
        CatalogImagePipeline.Analysis a = run(studio(900, 900, 246), "upper_piece", "t_shirt", false);
        assertThat(a.outcome()).isEqualTo(Outcome.REJECTED);
    }

    @Test
    void nivelBGeraMasterPreenchidoComTecidoSemAlterarACor() {
        CatalogImagePipeline.Analysis a = run(br.com.fashionai.application.imaging.ImageOps.scale(tee(200, 200, 1.0), 2000, 2000), "upper_piece", "t_shirt", true);
        assertThat(a.outcome()).as(a.reasons().toString()).isEqualTo(Outcome.APPROVED);
        BackgroundNormalizer.Rendered r = a.rendered();
        assertThat(r).isNotNull();
        assertThat((double) r.width() / r.height()).isCloseTo(a.pieceType() == PieceType.LOWER_PIECE ? 2.0 : 0.8, org.assertj.core.data.Offset.offset(0.01));
        assertThat(r.width()).isLessThanOrEqualTo(DetailPreserver.MASTER_MAX_WIDTH);
        assertThat(r.transparent().getColorModel().hasAlpha()).isTrue();
        assertThat(r.transparent().getRGB(2, 2) >>> 24).as("canto do master mostra tecido opaco").isEqualTo(255);
        assertThat(r.white().getRGB(2, 2) & 0xFFFFFF).isNotEqualTo(0xFFFFFF);
        assertThat(r.colorPreservation()).isGreaterThan(0.9);
        assertThat(r.thumbnail().getWidth()).isEqualTo(BackgroundNormalizer.THUMB_WIDTH);
    }

    @Test
    void pngOficialJaRecortadoUsaOAlfaDaMarca() {
        BufferedImage cut = new BufferedImage(900, 900, BufferedImage.TYPE_INT_ARGB);
        drawTee(cut, 150, 150, 1.0, NAVY);
        CatalogImagePipeline.Analysis a = pipeline.run(new CatalogImagePipeline.Request(png(cut), "upper_piece", "t_shirt", "PACKSHOT", false));
        assertThat(a.metrics().get("segmentationConfidence")).isGreaterThanOrEqualTo(0.95);
        assertThat(a.outcome()).as(a.reasons().toString()).isEqualTo(Outcome.APPROVED);
    }

    @Test
    void mesmaFotoEmOutroTamanhoTemPhashProximo() {
        BufferedImage a = tee(200, 200, 1.0);
        BufferedImage b = br.com.fashionai.application.imaging.ImageOps.scale(a, 640, 640);
        assertThat(PerceptualHash.distance(PerceptualHash.dHash(a), PerceptualHash.dHash(b))).isLessThanOrEqualTo(PerceptualHash.DUPLICATE_DISTANCE);
        assertThat(PerceptualHash.distance(PerceptualHash.dHash(a), PerceptualHash.dHash(jeans()))).isGreaterThan(PerceptualHash.DUPLICATE_DISTANCE);
    }
}
