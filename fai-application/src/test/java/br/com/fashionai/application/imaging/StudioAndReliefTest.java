package br.com.fashionai.application.imaging;

import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.Polygon;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** RF4 · Estúdio e RF16 · relevo local: saídas válidas, escolhas automáticas e ganho medido. */
class StudioAndReliefTest {
    /** Jaqueta sintética em painéis (creme, rosa, azul, laranja) com costuras e um zíper — parecida com a referência. */
    static BufferedImage jacket() {
        BufferedImage img = new BufferedImage(600, 700, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        Polygon body = new Polygon(new int[]{220, 380, 500, 590, 540, 470, 470, 130, 130, 60, 10, 100}, new int[]{40, 40, 90, 520, 540, 300, 690, 690, 300, 540, 520, 90}, 12);
        g.setColor(new Color(0xEDE6D6));
        g.fill(body);
        g.setClip(body);
        g.setColor(new Color(0xE9B5BA));
        g.fillRect(300, 230, 200, 150);
        g.fillRect(0, 280, 130, 200);
        g.setColor(new Color(0x2446B5));
        g.fillRect(300, 380, 300, 320);
        g.setColor(new Color(0x151515));
        g.fillRect(130, 470, 170, 230);
        g.setColor(new Color(0xF26A1B));
        g.fillRect(0, 480, 600, 70);
        g.setClip(null);
        g.setColor(new Color(0xC7F02B));
        g.fillRoundRect(330, 250, 10, 110, 6, 6);
        g.setColor(new Color(0, 0, 0, 60));
        g.setStroke(new BasicStroke(2));
        g.drawLine(300, 60, 300, 690);
        g.draw(body);
        g.dispose();
        return img;
    }

    @Test
    void studioProducesA1600pxShotOnRoyalBlueForALightJacket() throws Exception {
        StudioPipeline studio = new StudioPipeline(List.of(), List.of());
        StudioPipeline.Result r = studio.run(jacket(), "auto", true);
        BufferedImage shot = ImageIO.read(new ByteArrayInputStream(r.studioJpeg()));
        // quadro adaptado à peça (lado maior 1600) + miniatura quadrada para grades
        assertThat(Math.max(shot.getWidth(), shot.getHeight())).isEqualTo(StudioPipeline.SIZE);
        assertThat(r.framing().get("aspect")).isIn("9:16", "2:3", "4:5", "1:1", "5:4");
        BufferedImage thumb = ImageIO.read(new ByteArrayInputStream(r.thumbJpeg()));
        assertThat(thumb.getWidth()).isEqualTo(StudioPipeline.THUMB);
        assertThat(thumb.getHeight()).isEqualTo(StudioPipeline.THUMB);
        assertThat(r.backdrop().id()).isEqualTo("royal");
        // canto do quadro = fundo de estúdio azul (não branco, não transparente)
        int corner = shot.getRGB(20, 20);
        assertThat(corner & 0xFF).isGreaterThan((corner >> 16) & 0xFF);
        // o recorte realçado continua sem fundo e maior (ampliado)
        BufferedImage cut = ImageIO.read(new ByteArrayInputStream(r.enhancedPng()));
        assertThat(cut.getRGB(0, 0) >>> 24).isZero();
        assertThat(Math.max(cut.getWidth(), cut.getHeight())).isGreaterThanOrEqualTo(StudioPipeline.WORK);
        assertThat(r.stages()).extracting(StudioPipeline.Stage::name).contains("LIMPEZA", "NITIDEZ", "MANEQUIM_INVISIVEL", "LOGO",
                "VOLUME_LUZ", "ENQUADRAMENTO", "FUNDO_ESTUDIO", "SOMBRA", "COMPOSICAO", "VALIDACAO");
        Map<String, Object> m = r.metrics();
        // limpeza + luz não podem lavar a foto (contraste mantido) e a nitidez, na mesma escala, não cai
        assertThat((double) m.get("contrastAfter")).isGreaterThanOrEqualTo((double) m.get("contrastBefore") * 0.97);
        assertThat((double) m.get("sharpnessAfter")).isGreaterThanOrEqualTo((double) m.get("sharpnessBefore") * 0.95);
        String sample = System.getProperty("studio.sample");
        if (sample != null) {       // execução manual: -Dstudio.sample=foto.png grava target/studio-sample-*.jpg
            for (String bd : List.of("auto", "areia", "grafite")) {
                StudioPipeline.Result s = studio.run(ImageOps.toArgb(ImageIO.read(new File(sample))), bd, false);
                Files.write(new File("target/studio-sample-" + bd + ".jpg").toPath(), s.studioJpeg());
            }
            Files.write(new File("target/studio-sample-jaqueta.jpg").toPath(), r.studioJpeg());
        }
    }

    @Test
    void localBackgroundRemovalKeepsALightPieceOnASimilarWall() {
        // peça creme (com contorno sutil) sobre parede bege em gradiente + sombra: o caso que vazava na versão 1
        BufferedImage photo = new BufferedImage(500, 500, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = photo.createGraphics();
        for (int y = 0; y < 500; y++) {
            int c = 214 - y * 24 / 500;
            g.setColor(new Color(c, c - 12, c - 32));
            g.drawLine(0, y, 500, y);
        }
        g.setColor(new Color(150, 138, 118));
        g.fillOval(118, 108, 280, 330);                                // sombra
        g.setColor(new Color(0xE8DDC8));
        g.fillOval(100, 90, 280, 330);                                 // peça creme
        g.setColor(new Color(0xB8AC96));
        g.setStroke(new BasicStroke(3));
        g.drawOval(100, 90, 280, 330);                                 // contorno/costura
        g.setColor(new Color(0xE9B5BA));
        g.fillRect(200, 200, 90, 70);
        g.dispose();
        ImageOps.Cutout cut = ImageOps.removeBackgroundLocal(photo);
        double expected = Math.PI * 140 * 165 / (500.0 * 500);
        assertThat(cut.coverage()).isBetween(expected * 0.9, expected * 1.12);
        assertThat(cut.image().getRGB(240, 255) >>> 24).isEqualTo(255);   // centro da peça continua opaco
        assertThat(cut.image().getRGB(10, 10) >>> 24).isZero();            // parede saiu
        assertThat(cut.image().getRGB(395, 430) >>> 24).isZero();          // sombra saiu
        assertThat(cut.warning()).isNull();
        assertThat(cut.confidence()).isGreaterThanOrEqualTo(0.45);
        String phones = System.getProperty("studio.phones");
        if (phones != null) {       // execução manual: grava o Flat Lay + estúdio de cada foto
            FlatLayPipeline flat = new FlatLayPipeline(List.of(), List.of());
            StudioPipeline studio = new StudioPipeline(List.of(), List.of());
            for (String path : phones.split(",")) {
                try {
                    ImageOps.Cutout c = ImageOps.removeBackgroundLocal(ImageOps.decode(Files.readAllBytes(new File(path).toPath())));
                    System.out.printf("%s -> confianca %.2f, aviso: %s, métricas %s%n", path, c.confidence(), c.warning(),
                            Arrays.toString(ImageOps.shapeStats(alphaMask(c.image()), c.image().getWidth(), c.image().getHeight())));
                    FlatLayPipeline.Result r = flat.run(Files.readAllBytes(new File(path).toPath()), false);
                    String base = "target/" + new File(path).getName().replace(".jpg", "");
                    Files.write(new File(base + "-flat.jpg").toPath(), r.processedWhiteJpeg());
                    System.out.printf("  cortes da foto: %s · fonte do estúdio %dx%d%n", r.truncated(), r.studioSource().getWidth(), r.studioSource().getHeight());
                    for (String bd : List.of("auto", "areia")) {
                        StudioPipeline.Result s = studio.run(r.studioSource(), bd, false,
                                new StudioPipeline.Hints(path.contains("camiseta") ? "TOP" : "OUTERWEAR", r.truncated(), null, null));
                        Files.write(new File(base + "-studio-" + bd + ".jpg").toPath(), s.studioJpeg());
                        Files.write(new File(base + "-thumb-" + bd + ".jpg").toPath(), s.thumbJpeg());
                        if (s.detailJpeg() != null) {
                            Files.write(new File(base + "-detail-" + bd + ".jpg").toPath(), s.detailJpeg());
                        }
                        System.out.printf("  %s: %s · logo %s%n", bd, s.framing(), s.logo());
                        s.stages().forEach(st -> System.out.printf("    %s [%s] %s%n", st.name(), st.provider(), st.note()));
                    }
                } catch (Exception e) {
                    throw new IllegalStateException(e);
                }
            }
        }
    }

    private static boolean[] alphaMask(BufferedImage img) {
        int w = img.getWidth(), h = img.getHeight();
        boolean[] bg = new boolean[w * h];
        for (int i = 0; i < bg.length; i++) {
            bg[i] = (img.getRGB(i % w, i / w) >>> 24) < 16;
        }
        return bg;
    }

    @Test
    void cutoutWithHolesInTheMiddleIsFlaggedAsUnreliable() {
        // a peça "partida ao meio" (miolo levado junto com o fundo) → baixa solidez e centro vazio
        int w = 400, h = 400;
        boolean[] bg = new boolean[w * h];
        for (int i = 0; i < bg.length; i++) {
            int x = i % w, y = i / w;
            boolean left = x >= 60 && x < 150 && y >= 80 && y < 340;
            boolean right = x >= 230 && x < 340 && y >= 150 && y < 340;
            boolean bar = x >= 60 && x < 340 && y >= 320 && y < 340;
            bg[i] = !(left || right || bar);
        }
        double[] broken = ImageOps.shapeStats(bg, w, h);
        assertThat(broken[1]).isGreaterThan(0.9);                     // centro vazio
        assertThat(ImageOps.looksBroken(broken)).isTrue();
        // par de sapatos: dois componentes sólidos separados → não é falha
        for (int i = 0; i < bg.length; i++) {
            int x = i % w, y = i / w;
            bg[i] = !((x >= 40 && x < 180 && y >= 200 && y < 300) || (x >= 220 && x < 360 && y >= 190 && y < 290));
        }
        double[] shoes = ImageOps.shapeStats(bg, w, h);
        assertThat(shoes[0]).isGreaterThan(0.9);
        assertThat(shoes[3]).isEqualTo(2);
        assertThat(ImageOps.looksBroken(shoes)).isFalse();
    }

    @Test
    void deskewOnlyStraightensPiecesWithADominantAxis() {
        // calça inclinada 12° → endireita; jaqueta com mangas (quase quadrada) → não gira
        BufferedImage pants = new BufferedImage(600, 600, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = pants.createGraphics();
        g.rotate(Math.toRadians(12), 300, 300);
        g.setColor(new Color(0x2A5FA8));
        g.fillRect(250, 100, 100, 400);
        g.dispose();
        double[] axis = ImageOps.principalAxis(pants);
        assertThat(axis[1]).isGreaterThan(ImageOps.DESKEW_MIN_ELONGATION);
        assertThat(Math.abs(ImageOps.deskewAngle(axis[0]))).isBetween(10.0, 14.0);
        BufferedImage jacket = new BufferedImage(600, 600, BufferedImage.TYPE_INT_ARGB);
        g = jacket.createGraphics();
        g.setColor(new Color(0xE8DFCF));
        g.fillPolygon(new Polygon(new int[]{200, 400, 520, 470, 410, 410, 190, 190, 130, 80}, new int[]{80, 80, 380, 400, 250, 520, 520, 250, 400, 380}, 10));
        g.dispose();
        assertThat(ImageOps.principalAxis(jacket)[1]).isLessThan(ImageOps.DESKEW_MIN_ELONGATION);
    }

    @Test
    void darkPiecesGoOnSandAndBackdropsCanBeChosen() {
        BufferedImage dark = new BufferedImage(200, 300, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = dark.createGraphics();
        g.setColor(new Color(0x1A1A1E));
        g.fillRect(40, 20, 120, 260);
        g.dispose();
        assertThat(StudioPipeline.autoBackdrop(dark).id()).isEqualTo("areia");
        // peça azul royal sumiria no fundo royal → areia; peça multicolorida média (color block) → royal
        BufferedImage blue = new BufferedImage(200, 300, BufferedImage.TYPE_INT_ARGB);
        g = blue.createGraphics();
        g.setColor(new Color(0x2449B8));
        g.fillRect(40, 20, 120, 260);
        g.dispose();
        assertThat(StudioPipeline.autoBackdrop(blue).id()).isEqualTo("areia");
        BufferedImage block = new BufferedImage(200, 300, BufferedImage.TYPE_INT_ARGB);
        g = block.createGraphics();
        g.setColor(new Color(0xE8DFCF));
        g.fillRect(40, 20, 120, 130);
        g.setColor(new Color(0xE3A9B0));
        g.fillRect(40, 150, 60, 130);
        g.setColor(new Color(0x2A48A8));
        g.fillRect(100, 150, 60, 130);
        g.dispose();
        assertThat(StudioPipeline.autoBackdrop(block).id()).isEqualTo("royal");
        assertThat(StudioPipeline.backdrop("GRAFITE")).isPresent();
        assertThat(StudioPipeline.backdrop("neon")).isEmpty();
    }

    @Test
    void reliefModelIsAValidGlbWithFrontBackAndWalls() {
        ReliefModelGenerator.Model m = ReliefModelGenerator.generate(jacket(), 0.78);
        assertThat(ReliefModelGenerator.isGlb(m.glb())).isTrue();
        assertThat(m.vertices()).isGreaterThan(2000);
        assertThat(m.triangles()).isGreaterThan(m.vertices());          // frente + verso + paredes
        assertThat(m.heightM()).isBetween(0.7, 0.9);
        assertThat(m.depthM()).isBetween(0.02, 0.2);
        ByteBuffer b = ByteBuffer.wrap(m.glb()).order(ByteOrder.LITTLE_ENDIAN);
        int jsonLen = b.getInt(12);
        String json = new String(m.glb(), 20, jsonLen, StandardCharsets.UTF_8);
        assertThat(json).contains("\"POSITION\"", "\"TEXCOORD_0\"", "\"baseColorTexture\"", "\"image/png\"");
        assertThat(b.getInt(8)).isEqualTo(m.glb().length);
    }
}
