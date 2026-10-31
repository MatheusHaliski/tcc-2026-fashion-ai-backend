package br.com.fashionai.application.imaging;

import java.awt.image.BufferedImage;

/**
 * RF4 · Flat Lay — leituras locais da máscara do recorte usadas pelo pipeline ({@link FlatLayPipeline#run}): portão de
 * privacidade (pele de pessoa), lados cortados pela borda da foto e a fonte do estúdio em alta resolução. Puras: não
 * chamam provedor externo nem registram etapas.
 */
final class FlatLayMasks {
    private FlatLayMasks() {
    }

    /**
     * Peça com ao menos esta fração de pele estranha a ela é vestida ou segurada por alguém. Metade do limiar do catálogo
     * (ProductRuleFrame.OBJECT_PERSON_SKIN = 4%: rosto e braços passam de 5%; couro caramelo fica em ~1%): na dúvida, a foto
     * fica no servidor — o custo é só o recorte local, nunca a foto de uma pessoa num provedor externo.
     */
    static final double PERSON_SKIN_GATE = 0.02;
    /** Amostras da verificação (a foto de 12 MP não precisa ser lida pixel a pixel para achar um rosto ou um braço). */
    private static final int PERSON_SAMPLES = 250_000;

    /**
     * A foto pode mostrar uma pessoa? Mede a pele estranha à peça dentro do recorte local; recorte pouco confiável (fundo
     * confuso) mede na foto inteira.
     */
    static boolean mayShowPerson(ImageOps.Cutout local, BufferedImage original) {
        boolean reliable = local.confidence() >= 0.45;
        BufferedImage img = reliable ? local.image() : original;
        int w = img.getWidth(), h = img.getHeight();
        int step = Math.max(1, (int) Math.ceil(Math.sqrt(w * (double) h / PERSON_SAMPLES)));
        int cols = (w + step - 1) / step, rows = (h + step - 1) / step;
        int[] px = new int[cols * rows];
        boolean[] mask = new boolean[px.length];
        int i = 0;
        for (int y = 0; y < h; y += step) {
            for (int x = 0; x < w; x += step, i++) {
                int argb = img.getRGB(x, y);
                px[i] = argb & 0xFFFFFF;
                mask[i] = !reliable || (argb >>> 24) > 128;
            }
        }
        return LocalVision.foreignSkinShare(px, mask) >= PERSON_SKIN_GATE;
    }

    /**
     * Lados do recorte que encostam na borda da foto: pelo menos 3% do lado (e 8 px) com peça nas 2 linhas/colunas
     * externas. É o caso da foto que cortou a barra ou as mangas — o estúdio não pode deixar esse corte "flutuando".
     */
    static java.util.Set<String> truncatedSides(BufferedImage cut) {
        int w = cut.getWidth(), h = cut.getHeight();
        int top = 0, bottom = 0, left = 0, right = 0;
        for (int x = 0; x < w; x++) {
            if (opaque(cut, x, 0) || opaque(cut, x, 1)) {
                top++;
            }
            if (opaque(cut, x, h - 1) || opaque(cut, x, h - 2)) {
                bottom++;
            }
        }
        for (int y = 0; y < h; y++) {
            if (opaque(cut, 0, y) || opaque(cut, 1, y)) {
                left++;
            }
            if (opaque(cut, w - 1, y) || opaque(cut, w - 2, y)) {
                right++;
            }
        }
        java.util.Set<String> out = new java.util.LinkedHashSet<>();
        if (top >= Math.max(8, w * 0.03)) {
            out.add("top");
        }
        if (bottom >= Math.max(8, w * 0.03)) {
            out.add("bottom");
        }
        if (left >= Math.max(8, h * 0.03)) {
            out.add("left");
        }
        if (right >= Math.max(8, h * 0.03)) {
            out.add("right");
        }
        return out;
    }

    private static boolean opaque(BufferedImage img, int x, int y) {
        return x >= 0 && y >= 0 && x < img.getWidth() && y < img.getHeight() && (img.getRGB(x, y) >>> 24) > 128;
    }

    /**
     * A remoção local trabalha em ≤ 1600 px; aqui a máscara é ampliada e aplicada sobre a foto original reduzida a
     * {@link FlatLayPipeline#STUDIO_SOURCE_MAX}. Se a original não for maior (ou a proporção não bater), devolve o próprio recorte.
     */
    static BufferedImage hiResCutout(BufferedImage original, BufferedImage cut) {
        BufferedImage target = ImageOps.scaleToFit(original, FlatLayPipeline.STUDIO_SOURCE_MAX, FlatLayPipeline.STUDIO_SOURCE_MAX);
        int tw = target.getWidth(), th = target.getHeight();
        double ratioCut = cut.getWidth() / (double) cut.getHeight(), ratioOrig = tw / (double) th;
        if (tw <= cut.getWidth() * 1.1 || Math.abs(ratioCut - ratioOrig) > 0.02 * ratioOrig) {
            return cut;
        }
        BufferedImage mask = ImageOps.scale(cut, tw, th);
        int[] m = mask.getRGB(0, 0, tw, th, null, 0, tw);
        int[] o = ImageOps.toArgb(target).getRGB(0, 0, tw, th, null, 0, tw);
        for (int i = 0; i < o.length; i++) {
            o[i] = (m[i] & 0xFF000000) | (o[i] & 0x00FFFFFF);
        }
        BufferedImage out = new BufferedImage(tw, th, BufferedImage.TYPE_INT_ARGB);
        out.setRGB(0, 0, tw, th, o, 0, tw);
        return out;
    }
}
