package br.com.fashionai.application.imaging;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.awt.Graphics2D;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.nio.file.Files;
import java.nio.file.Path;

import static br.com.fashionai.application.imaging.PieceTestPhotos.art;
import static br.com.fashionai.application.imaging.PieceTestPhotos.canvas;
import static br.com.fashionai.application.imaging.PieceTestPhotos.evaluate;
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * RF4 — critérios de aceite da foto da peça, rodando o pipeline local de verdade (recorte, corte na borda, eixo) sobre
 * fotos montadas com as artes de referência: só entra a peça inteira, de frente (câmera a 90°), reta, sozinha, nítida.
 */
class PhotoAcceptanceTest {
    BufferedImage tee;
    BufferedImage jeans;

    @BeforeEach
    void load() throws Exception {
        assumeTrue(PieceTestPhotos.available(), "assets de peças fora do checkout");
        tee = art("01_Parte_superior/01_camiseta_referencia.png");
        jeans = art("02_Parte_inferior/01_jeans.png");
    }

    @Test
    void aceitaPecaInteiraDeFrenteSobreFundoLiso() throws Exception {
        assertThat(evaluate("upper_piece", canvas(tee, 1600, 1600, 0.7, 0.5, 0.5, null)).accepted()).isTrue();
        assertThat(evaluate("lower_piece", canvas(jeans, 1200, 1600, 0.85, 0.5, 0.5, null)).accepted()).isTrue();
        assertThat(evaluate("full_body_piece", canvas(art("05_Corpo_inteiro/01_vestido.png"), 1200, 1600, 0.85, 0.5, 0.5, null)).accepted()).isTrue();
        // a arte do tênis é um par: calçado pode vir em par
        assertThat(evaluate("shoes_piece", canvas(art("03_Calcados/01_tenis_casual.png"), 1600, 1200, 0.7, 0.5, 0.5, null)).accepted()).isTrue();
    }

    @Test
    void recusaPecaCortadaPelaBordaDaFoto() throws Exception {
        PhotoAcceptance.Report cutBottom = evaluate("lower_piece", canvas(jeans, 1200, 1600, 1.1, 0.5, 0.7, null));
        assertThat(cutBottom.accepted()).isFalse();
        assertThat(cutBottom.failed()).extracting(PhotoAcceptance.Check::id).contains("inteira");
        PhotoAcceptance.Report cutLeft = evaluate("upper_piece", canvas(tee, 1600, 1600, 0.9, 0.28, 0.5, null));
        assertThat(cutLeft.failed()).extracting(PhotoAcceptance.Check::id).contains("inteira");
        assertThat(cutLeft.failed().get(0).message()).contains("borda");
    }

    @Test
    void recusaPessoaComARoupaCortada() throws Exception {
        byte[] person = Files.readAllBytes(Path.of("../scripts/e2e/fixtures/p1.jpg"));
        FlatLayPipeline.Result r = new FlatLayPipeline(java.util.List.of(), java.util.List.of()).run(person, false);
        PhotoAcceptance.Report rep = PhotoAcceptance.evaluate("upper_piece", r.originalWidth(), r.originalHeight(), r.cutout(), r.truncated(), r.quality());
        assertThat(rep.failed()).extracting(PhotoAcceptance.Check::id).contains("inteira");
    }

    @Test
    void recusaPecaPequenaDemaisNoQuadro() throws Exception {
        PhotoAcceptance.Report rep = evaluate("upper_piece", canvas(tee, 2400, 2400, 0.12, 0.5, 0.5, null));
        assertThat(rep.accepted()).isFalse();
        assertThat(rep.failed()).extracting(PhotoAcceptance.Check::id).containsExactly("enquadramento");
    }

    @Test
    void inclinacaoCorrigivelPassaEInclinacaoGrandeNao() throws Exception {
        // calça tem eixo comprido: até 25° o pipeline endireita
        assertThat(evaluate("lower_piece", canvas(jeans, 1600, 1600, 0.6, 0.5, 0.5, rotate(15))).accepted()).isTrue();
        assertThat(evaluate("lower_piece", canvas(jeans, 1600, 1600, 0.6, 0.5, 0.5, rotate(40))).failed())
                .extracting(PhotoAcceptance.Check::id).contains("alinhamento");
        // camiseta não tem eixo comprido: vale o eixo de simetria — 6° passa, 16° não
        assertThat(evaluate("upper_piece", canvas(tee, 1600, 1600, 0.65, 0.5, 0.5, rotate(6))).accepted()).isTrue();
        assertThat(evaluate("upper_piece", canvas(tee, 1600, 1600, 0.65, 0.5, 0.5, rotate(16))).failed())
                .extracting(PhotoAcceptance.Check::id).containsExactly("alinhamento");
    }

    @Test
    void recusaRoupaFotografadaComACameraForaDos90Graus() throws Exception {
        // câmera bem de lado: o lado distante da calça fica com 40% da altura do próximo — a silhueta perde a simetria
        PhotoAcceptance.Report angled = evaluate("lower_piece", PieceTestPhotos.yaw(canvas(jeans, 1600, 1600, 0.85, 0.5, 0.5, null), 1.5));
        assertThat(angled.failed()).extracting(PhotoAcceptance.Check::id).contains("frontal");
        assertThat(angled.failed().stream().filter(c -> c.id().equals("frontal")).findFirst().orElseThrow().message()).contains("90°");
        // desvio leve continua valendo (a IA ainda avalia o ângulo com "viewAngle")
        assertThat(evaluate("upper_piece", PieceTestPhotos.yaw(canvas(tee, 1600, 1600, 0.7, 0.5, 0.5, null), 0.3)).accepted()).isTrue();
    }

    @Test
    void recusaDuasPecasNaMesmaFoto() throws Exception {
        BufferedImage two = new BufferedImage(1700, 700, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = two.createGraphics();
        g.drawImage(tee, 0, 0, 780, 660, null);
        g.drawImage(tee, 900, 0, 780, 660, null);
        g.dispose();
        PhotoAcceptance.Report rep = evaluate("upper_piece", canvas(two, 1800, 1400, 0.85, 0.5, 0.5, null));
        assertThat(rep.failed()).extracting(PhotoAcceptance.Check::id).contains("peca_unica");
    }

    @Test
    void recusaFotoTremida() throws Exception {
        PhotoAcceptance.Report rep = evaluate("upper_piece", PieceTestPhotos.blur(canvas(tee, 1600, 1600, 0.7, 0.5, 0.5, null), 13));
        assertThat(rep.failed()).extracting(PhotoAcceptance.Check::id).contains("nitidez");
    }

    @Test
    void fundoEscuroNaoEhFotoEscura() throws Exception {
        // a exposição é medida na peça (detalhe perdido), não na foto inteira: camiseta clara sobre fundo preto passa
        BufferedImage dark = new BufferedImage(1600, 1600, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = dark.createGraphics();
        g.setColor(new java.awt.Color(28, 28, 28));
        g.fillRect(0, 0, 1600, 1600);
        double s = 0.7 * 1600 / Math.max(tee.getWidth(), tee.getHeight());
        g.drawImage(tee, (int) (800 - tee.getWidth() * s / 2), (int) (800 - tee.getHeight() * s / 2), (int) (tee.getWidth() * s), (int) (tee.getHeight() * s), null);
        g.dispose();
        assertThat(evaluate("upper_piece", dark).accepted()).isTrue();
    }

    @Test
    void formatoSemIaComparaComAsOutrasCategorias() {
        // sem IA: outra categoria muito mais parecida reprova; parecida o bastante com a escolhida passa
        assertThat(PhotoAcceptance.shapeCheck("Parte inferior", null, 0, "Parte superior", 0.74, 0.99).ok()).isFalse();
        assertThat(PhotoAcceptance.shapeCheck("Parte inferior", null, 0, "Parte superior", 0.93, 0.88).ok()).isTrue();
        assertThat(PhotoAcceptance.shapeCheck("Parte inferior", null, 0, null, 0.4, 0.3).ok()).isFalse();
        // com IA: vale a resposta dela quando confiante
        assertThat(PhotoAcceptance.shapeCheck("Parte inferior", false, 0.9, "Calçados", 0.99, 0.5).ok()).isFalse();
        assertThat(PhotoAcceptance.shapeCheck("Parte inferior", false, 0.4, "Calçados", 0.99, 0.5).ok()).isTrue();
    }

    @Test
    void avaliacaoDaIaSoReprovaComConfiancaAlta() {
        assertThat(PhotoAcceptance.aiPhotoChecks(false, "angulo", false, 0.5, "upper_piece")).isEmpty();
        assertThat(PhotoAcceptance.aiPhotoChecks(false, "angulo", true, 0.9, "upper_piece"))
                .extracting(PhotoAcceptance.Check::id).containsExactly("inteira_ia", "frontal_ia");
        // calçado de perfil é o padrão: "lateral" não reprova calçado
        assertThat(PhotoAcceptance.aiPhotoChecks(true, "lateral", true, 0.9, "shoes_piece")).isEmpty();
    }

    private static AffineTransform rotate(double degrees) {
        return AffineTransform.getRotateInstance(Math.toRadians(degrees));
    }
}
