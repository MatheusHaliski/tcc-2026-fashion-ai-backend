package br.com.fashionai.application.imaging;

import br.com.fashionai.application.moderation.ImageSafetyPorts.ClassMap;
import org.junit.jupiter.api.Test;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.geom.Path2D;
import java.awt.geom.PathIterator;
import java.awt.image.BufferedImage;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Caracterização do lote R03-imaging: resultados numéricos e hash dos pixels/bytes de BrandRegions, PhotoAcceptance,
 * StudioFraming, SvgPathRenderer, WornPieceRegions, FlatLayPipeline e ReliefModelGenerator sobre imagens sintéticas
 * pequenas geradas em memória. Os valores esperados foram capturados no código ANTES da extração de colaboradores; o
 * teste prova que a divisão dos arquivos não mudou nenhum pixel, byte ou número.
 */
class ImagingSplitCharacterizationTest {

    /*
     * EXPECTED guarda o SHA-256 (16 hex) do texto de cada resultado: as mensagens i18n têm acentos e os pixels já são
     * resumidos por hash; o texto completo capturado no código original está no relatório do lote.
     */

    /** Camiseta sintética: tronco + mangas, logo escuro no peito esquerdo, fundo transparente. */
    static BufferedImage tee(int w, int h) {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        g.setColor(new Color(200, 60, 50));
        g.fillRect(w / 4, h / 8, w / 2, h * 3 / 4);
        g.fillPolygon(new int[]{w / 4, 2, w / 8, w / 4}, new int[]{h / 8, h / 3, h / 2, h / 3}, 4);
        g.fillPolygon(new int[]{w * 3 / 4, w - 3, w * 7 / 8, w * 3 / 4}, new int[]{h / 8, h / 3, h / 2, h / 3}, 4);
        g.setColor(new Color(20, 20, 30));
        g.fillRect(w / 2 + w / 16, h / 4, w / 10, h / 14);
        g.setColor(new Color(240, 230, 210));
        g.fillOval(w / 2 - w / 12, h / 2, w / 6, h / 10);
        g.dispose();
        return img;
    }

    /** Conjunto com ordem fixa: {@code Set.of} com 2+ itens muda a ordem de iteração a cada JVM. */
    static Set<String> sorted(String... sides) {
        return new java.util.TreeSet<>(List.of(sides));
    }

    static Object canonical(Object o) {
        if (o instanceof Map<?, ?> m) {
            java.util.TreeMap<String, Object> t = new java.util.TreeMap<>();
            m.forEach((k, v) -> t.put(String.valueOf(k), canonical(v)));
            return t;
        }
        if (o instanceof List<?> l) {
            return l.stream().map(ImagingSplitCharacterizationTest::canonical).toList();
        }
        return o;
    }

    static String sha(byte[] b) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(b)).substring(0, 16);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    static String px(BufferedImage img) {
        int[] p = img.getRGB(0, 0, img.getWidth(), img.getHeight(), null, 0, img.getWidth());
        StringBuilder sb = new StringBuilder(img.getWidth() + "x" + img.getHeight() + ":");
        for (int v : p) {
            sb.append(Integer.toHexString(v)).append(',');
        }
        return img.getWidth() + "x" + img.getHeight() + "#" + sha(sb.toString().getBytes(StandardCharsets.UTF_8));
    }

    static String zones(List<BrandRegions.Zone> zs) {
        StringBuilder sb = new StringBuilder();
        for (BrandRegions.Zone z : zs) {
            sb.append(z.id()).append(java.util.Arrays.toString(z.box())).append(';');
        }
        return sb.toString();
    }

    static String path(Path2D p) {
        StringBuilder sb = new StringBuilder("rule=" + p.getWindingRule() + ";");
        double[] c = new double[6];
        for (PathIterator it = p.getPathIterator(null); !it.isDone(); it.next()) {
            int t = it.currentSegment(c);
            sb.append(t).append(java.util.Arrays.toString(c)).append(';');
            java.util.Arrays.fill(c, 0);
        }
        return sha(sb.toString().getBytes(StandardCharsets.UTF_8));
    }

    Map<String, String> brandRegions() {
        Map<String, String> r = new LinkedHashMap<>();
        BufferedImage piece = tee(80, 96);
        for (String cat : new String[]{"upper_piece", "full_body_piece", "lower_piece", "shoes_piece", "bag", null}) {
            r.put("brand.zones." + cat, zones(BrandRegions.zones(piece, cat)));
        }
        r.put("brand.zones.tiny", zones(BrandRegions.zones(new BufferedImage(5, 5, BufferedImage.TYPE_INT_ARGB), "upper_piece")));
        r.put("brand.tiles.logo3", zones(BrandRegions.tiles(piece, new double[]{0.55, 0.2, 0.7, 0.3}, 3)));
        r.put("brand.tiles.none9", zones(BrandRegions.tiles(piece, null, 9)));
        r.put("brand.tiles.none1", zones(BrandRegions.tiles(piece, new double[]{0.1}, 1)));
        List<BrandRegions.Zone> top = BrandRegions.zones(piece, "upper_piece");
        r.put("brand.crop.default", px(BrandRegions.crop(piece, top.get(1))));
        r.put("brand.crop.64", px(BrandRegions.crop(piece, top.get(0), 64)));
        r.put("brand.zoneOf", BrandRegions.zoneOf(top, new double[]{0.55, 0.2, 0.7, 0.3}) + "|"
                + BrandRegions.zoneOf(top, new double[]{0.0, 0.95, 0.01, 1.0}) + "|" + BrandRegions.zoneOf(top, null));
        double[] logo = BrandRegions.detectLogo(tee(160, 192));
        r.put("brand.detectLogo", java.util.Arrays.toString(logo));
        return r;
    }

    Map<String, String> photoAcceptance() {
        Map<String, String> r = new LinkedHashMap<>();
        BufferedImage frame = new BufferedImage(200, 240, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = frame.createGraphics();
        g.drawImage(tee(120, 150), 40, 40, null);
        g.drawImage(tee(30, 36), 2, 190, null);
        g.dispose();
        ImageOps.Cutout good = new ImageOps.Cutout(frame, 0.3, 0.9, 0xFFFFFF, null);
        QualityMetrics.Report q = new QualityMetrics.Report(Map.of("sharpness", 0.02), 0.8, true, List.of(), List.of());
        for (String cat : new String[]{"upper_piece", "lower_piece", "shoes_piece", null}) {
            r.put("accept." + cat, PhotoAcceptance.evaluate(cat, 800, 960, good, Set.of(), q).toMap().toString());
        }
        r.put("accept.truncated", PhotoAcceptance.evaluate("upper_piece", 400, 480, good, sorted("bottom", "left"), null).toMap().toString());
        ImageOps.Cutout weak = new ImageOps.Cutout(frame, 0.3, 0.2, 0xFFFFFF, "aviso");
        r.put("accept.weak", PhotoAcceptance.evaluate("upper_piece", 400, 480, weak, Set.of("top"), null).toMap().toString());
        ImageOps.Cutout tiny = new ImageOps.Cutout(frame, 0.01, 0.2, 0xFFFFFF, null);
        r.put("accept.tiny", PhotoAcceptance.evaluate("upper_piece", 400, 480, tiny, null, null).toMap().toString());
        BufferedImage rotated = ImageOps.rotate(tee(120, 150), 14);
        ImageOps.Cutout tilted = new ImageOps.Cutout(rotated, 0.3, 0.9, 0xFFFFFF, null);
        r.put("accept.tilted", PhotoAcceptance.evaluate("upper_piece", 600, 600, tilted, Set.of(), null).toMap().toString());
        r.put("accept.shape", PhotoAcceptance.shapeCheck("Camiseta", null, 0, "Calça", 0.4, 0.6) + "|"
                + PhotoAcceptance.shapeCheck("Camiseta", false, 0.9, null, 0, 0) + "|"
                + PhotoAcceptance.shapeCheck("Camiseta", null, 0, null, 0.6, 0.62));
        r.put("accept.ai", PhotoAcceptance.aiPhotoChecks(false, "lateral", false, 0.8, "upper_piece").toString());
        return r;
    }

    Map<String, String> studioFraming() {
        Map<String, String> r = new LinkedHashMap<>();
        r.put("frame.adaptive", StudioFraming.frame(300, 700, Set.of(), 800, true).toString());
        r.put("frame.square", StudioFraming.frame(300, 700, Set.of("bottom"), 800, false).toString());
        r.put("frame.flush", StudioFraming.frame(500, 400, sorted("left", "bottom"), Set.of("bottom"), 640, true).toString());
        BufferedImage cut = tee(90, 120);
        BufferedImage bottomCut = new BufferedImage(90, 100, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = bottomCut.createGraphics();
        g.drawImage(cut, 0, 0, null);
        g.dispose();
        r.put("cuts.tee", StudioFraming.cuts(cut).toString());
        r.put("cuts.bottom", StudioFraming.cuts(bottomCut).toString() + StudioFraming.straightCuts(bottomCut));
        StudioPipeline.Backdrop bd = new StudioPipeline.Backdrop("t", "t", 0xF4F1EC, 0xD8D2C8, 0x302820);
        StudioFraming.Frame f = StudioFraming.frame(cut.getWidth(), cut.getHeight(), Set.of(), 160, true);
        r.put("compose.float", px(StudioFraming.compose(cut, bd, f)));
        StudioFraming.Frame fb = StudioFraming.frame(90, 100, Set.of("bottom"), 160, true);
        r.put("compose.bleed", px(StudioFraming.compose(bottomCut, bd, fb)));
        r.put("downscale", px(StudioFraming.downscale(tee(200, 240), 40, 48)));
        return r;
    }

    Map<String, String> svg() {
        Map<String, String> r = new LinkedHashMap<>();
        String svg = "<svg viewBox=\"0 0 24 24\"><path d=\"M2 2h8v4H6v2l4 0V12H2z m12-10 c2 0 4 2 4 4 s-2 4-4 4"
                + " q-2 0-2-2 t2-2 a3 2 30 01 4 4 A2 2 0 1 0 20 20 L22 22 l-1 1 V18 v1 Z\"/>"
                + "<path fill-rule=\"evenodd\" d=\"M1 20 L5 20 L3 23z\"/></svg>";
        SvgPathRenderer.Vector v = SvgPathRenderer.parse(svg);
        r.put("svg.viewBox", v.viewBox().toString());
        r.put("svg.path", path(v.shape()));
        r.put("svg.render", px(SvgPathRenderer.render(v, 96, 0.1)));
        SvgPathRenderer.Vector nb = SvgPathRenderer.parse("<svg><path d=\"M0 0a5 5 0 1 1 10 0a0 5 0 0 0 4 4z\"/></svg>");
        r.put("svg.noViewBox", nb.viewBox().toString() + path(nb.shape()));
        return r;
    }

    Map<String, String> worn() {
        Map<String, String> r = new LinkedHashMap<>();
        int w = 48, h = 80;
        byte[] cls = new byte[w * h];
        BufferedImage photo = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        Object[][] bands = {
                {20, 28, 0, 2, ClassMap.CLOTHES, 0x141414}, {21, 27, 3, 5, ClassMap.HAIR, 0x5A3C1E},
                {21, 27, 6, 11, ClassMap.FACE_SKIN, 0xD2AA8C}, {12, 36, 12, 38, ClassMap.CLOTHES, 0xF0F0F0},
                {17, 31, 39, 70, ClassMap.CLOTHES, 0x3050A0}, {16, 32, 71, 78, ClassMap.CLOTHES, 0x301818},
                {0, 4, 60, 70, ClassMap.OTHER, 0x00FF00}};
        for (Object[] b : bands) {
            for (int y = (int) b[2]; y <= (int) b[3]; y++) {
                for (int x = (int) b[0]; x <= (int) b[1]; x++) {
                    cls[y * w + x] = (byte) (int) b[4];
                    photo.setRGB(x, y, (int) b[5]);
                }
            }
        }
        r.put("worn.detect", WornPieceRegions.detect(photo, new ClassMap(w, h, cls)).toString());
        r.put("worn.empty", WornPieceRegions.detect(photo, new ClassMap(w, h, new byte[w * h])).toString());
        int[] clothes = {0, 5, 5, 5, 5, 5, 5, 5, 5, 0};
        long[] sr = {0, 1000, 1000, 1000, 1000, 100, 100, 100, 100, 0};
        r.put("worn.colourCut", WornPieceRegions.colourCut(clothes, sr, sr, sr, 1, 8, 2) + "|"
                + WornPieceRegions.colourCut(clothes, sr, sr, sr, 1, 4, 2));
        return r;
    }

    Map<String, String> flatLay() {
        Map<String, String> r = new LinkedHashMap<>();
        BufferedImage photo = new BufferedImage(160, 200, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = photo.createGraphics();
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, 160, 200);
        g.drawImage(tee(110, 160), 25, 20, null);
        g.dispose();
        FlatLayPipeline.Result res = new FlatLayPipeline(List.of(), List.of()).run(ImageOps.png(photo), true);
        r.put("flat.processed", sha(res.processedPng()));
        r.put("flat.white", sha(res.processedWhiteJpeg()));
        r.put("flat.thumb", sha(res.thumbnailPng()));
        r.put("flat.studio", px(res.studioSource()));
        r.put("flat.meta", res.metadata().toString());
        StringBuilder st = new StringBuilder();
        for (FlatLayPipeline.Stage s : res.stages()) {
            st.append(s.name()).append('/').append(s.provider()).append('/').append(s.ok()).append('/').append(s.fallback())
                    .append('/').append(s.note()).append(';');
        }
        r.put("flat.stages", st.toString());
        r.put("flat.flags", res.mimeType() + res.fallbackUsed() + res.backgroundRemoved() + res.truncated() + res.totalCostUsd());
        BufferedImage edge = new BufferedImage(100, 80, BufferedImage.TYPE_INT_ARGB);
        Graphics2D eg = edge.createGraphics();
        eg.setColor(Color.RED);
        eg.fillRect(0, 30, 60, 50);
        eg.dispose();
        r.put("flat.truncated", FlatLayPipeline.truncatedSides(edge).toString());
        ImageOps.Cutout cut = new ImageOps.Cutout(tee(60, 80), 0.4, 0.9, 0xFFFFFF, null);
        r.put("flat.person", FlatLayPipeline.mayShowPerson(cut, photo) + "|"
                + FlatLayPipeline.mayShowPerson(new ImageOps.Cutout(tee(60, 80), 0.4, 0.1, 0xFFFFFF, null), photo));
        BufferedImage big = ImageOps.scale(photo, 320, 400);
        BufferedImage mask = ImageOps.toArgb(ImageOps.scale(tee(110, 160), 160, 200));
        r.put("flat.hiRes", px(FlatLayPipeline.hiResCutout(big, mask)) + "|"
                + (FlatLayPipeline.hiResCutout(photo, mask) == mask));
        return r;
    }

    Map<String, String> relief() {
        Map<String, String> r = new LinkedHashMap<>();
        ReliefModelGenerator.Model m = ReliefModelGenerator.generate(tee(90, 110), 0.7);
        // o JSON do glTF sai de Map.of (ordem de chaves varia por JVM): compara o JSON canônico + o bloco binário
        java.nio.ByteBuffer b = java.nio.ByteBuffer.wrap(m.glb()).order(java.nio.ByteOrder.LITTLE_ENDIAN);
        int jsonLen = b.getInt(12);
        String json = new String(m.glb(), 20, jsonLen, StandardCharsets.UTF_8).trim();
        byte[] bin = java.util.Arrays.copyOfRange(m.glb(), 20 + jsonLen, m.glb().length);
        r.put("relief.glb", canonical(br.com.fashionai.application.common.Json.map(json)) + "/" + sha(bin) + "/" + m.glb().length
                + "/" + b.getInt(0) + "/" + b.getInt(4) + "/" + b.getInt(8));
        r.put("relief.numbers", m.vertices() + "/" + m.triangles() + "/" + m.widthM() + "/" + m.heightM() + "/" + m.depthM());
        r.put("relief.isGlb", ReliefModelGenerator.isGlb(m.glb()) + "|" + ReliefModelGenerator.isGlb(new byte[24]) + "|"
                + ReliefModelGenerator.isGlb(null));
        return r;
    }

    static final Map<String, String> EXPECTED = new LinkedHashMap<>();

    static {
        EXPECTED.put("brand.zones.upper_piece", "f267ece557f67f8f");
        EXPECTED.put("brand.zones.full_body_piece", "c56e55c6add44c83");
        EXPECTED.put("brand.zones.lower_piece", "3e49ed1944dc4f59");
        EXPECTED.put("brand.zones.shoes_piece", "d0eb21f06eb75cbc");
        EXPECTED.put("brand.zones.bag", "47b5fbe212525b65");
        EXPECTED.put("brand.zones.null", "f267ece557f67f8f");
        EXPECTED.put("brand.zones.tiny", "e3b0c44298fc1c14");
        EXPECTED.put("brand.tiles.logo3", "a567f6a34fd945e6");
        EXPECTED.put("brand.tiles.none9", "0394e6bc5b57cff4");
        EXPECTED.put("brand.tiles.none1", "d6a9adde7c0189fb");
        EXPECTED.put("brand.crop.default", "6239349d1686965a");
        EXPECTED.put("brand.crop.64", "ca583fb60835fc29");
        EXPECTED.put("brand.zoneOf", "26645049c2ff8867");
        EXPECTED.put("brand.detectLogo", "5f284b1d73f7e346");
        EXPECTED.put("accept.upper_piece", "12bdb9507c45ea68");
        EXPECTED.put("accept.lower_piece", "12bdb9507c45ea68");
        EXPECTED.put("accept.shoes_piece", "f105941d550084ea");
        EXPECTED.put("accept.null", "f105941d550084ea");
        EXPECTED.put("accept.truncated", "6e08b71e4997c7f1");
        EXPECTED.put("accept.weak", "eda32f141af269a2");
        EXPECTED.put("accept.tiny", "0eff3368be809a64");
        EXPECTED.put("accept.tilted", "e3c04e2883fa61f7");
        EXPECTED.put("accept.shape", "f32cda6b20bbc822");
        EXPECTED.put("accept.ai", "1b9e98fe8e7eb32b");
        EXPECTED.put("frame.adaptive", "1198ec6e005774ec");
        EXPECTED.put("frame.square", "a9d99dff8f132219");
        EXPECTED.put("frame.flush", "9b41393fc635a769");
        EXPECTED.put("cuts.tee", "618d8d42429719de");
        EXPECTED.put("cuts.bottom", "6d35ca95e78aece2");
        EXPECTED.put("compose.float", "ff22a2441e45b646");
        EXPECTED.put("compose.bleed", "cae2a4ec9ed9e367");
        EXPECTED.put("downscale", "6e2303a7fb7d12eb");
        EXPECTED.put("svg.viewBox", "1bf4dbfc007fa0a9");
        EXPECTED.put("svg.path", "82a5e903d6ca0f5d");
        EXPECTED.put("svg.render", "aa1ee6320b7e9756");
        EXPECTED.put("svg.noViewBox", "fa26ec0aa82c5f92");
        EXPECTED.put("worn.detect", "761c04698ff98e68");
        EXPECTED.put("worn.empty", "4f53cda18c2baa0c");
        EXPECTED.put("worn.colourCut", "e9cabf7a43211c5a");
        EXPECTED.put("flat.processed", "d397a1a31c2bd61f");
        EXPECTED.put("flat.white", "f3643b61bd836712");
        EXPECTED.put("flat.thumb", "f5b84f462a68d902");
        EXPECTED.put("flat.studio", "7ef5a0f7e813e04e");
        EXPECTED.put("flat.meta", "3505530759bfb1fd");
        EXPECTED.put("flat.stages", "c3a87fe74616ee8b");
        EXPECTED.put("flat.flags", "159a375aec8654d7");
        EXPECTED.put("flat.truncated", "7f3b4d428b498c13");
        EXPECTED.put("flat.person", "515781fb8713fb4f");
        EXPECTED.put("flat.hiRes", "1dac7918497664cf");
        EXPECTED.put("relief.glb", "1fdc6879a39e4c54");
        EXPECTED.put("relief.numbers", "24035139840e725c");
        EXPECTED.put("relief.isGlb", "bacff98749c542a0");
    }

    @Test
    void lotR03ImagingKeepsEveryPixelByteAndNumber() {
        Map<String, String> all = new LinkedHashMap<>();
        all.putAll(brandRegions());
        all.putAll(photoAcceptance());
        all.putAll(studioFraming());
        all.putAll(svg());
        all.putAll(worn());
        all.putAll(flatLay());
        all.putAll(relief());
        Map<String, String> digests = new LinkedHashMap<>();
        all.forEach((k, v) -> digests.put(k, sha(v.getBytes(StandardCharsets.UTF_8))));
        if (EXPECTED.isEmpty()) {
            digests.forEach((k, v) -> System.out.println("DIGEST\t" + k + "\t" + v));
        }
        assertThat(digests).containsExactlyEntriesOf(EXPECTED);
    }
}
