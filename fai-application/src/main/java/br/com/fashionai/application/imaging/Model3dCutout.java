package br.com.fashionai.application.imaging;

import java.awt.image.BufferedImage;

/**
 * RF16 — entrada do 3D: o recorte sem fundo da peça. A foto da peça nem sempre é um recorte: quando a remoção de fundo
 * falhou no envio (ou a pessoa trocou por uma foto opaca), {@code imageUrl} é a própria foto, e o relevo local fazia da
 * foto inteira a "silhueta" — um bloco retangular com a foto na frente e no verso. Aqui a foto sem transparência passa
 * pela remoção de fundo local; se ela não for confiável, a geração para com o motivo em vez de entregar o bloco.
 */
public final class Model3dCutout {
    /** Menos que isso de pixels transparentes: a imagem é uma foto com fundo, não um recorte. */
    static final double MIN_TRANSPARENT = 0.02;
    /** Abaixo disso o recorte local se declarou incerto (peça partida, fundo parecido com a peça). */
    static final double MIN_CONFIDENCE = 0.45;

    private Model3dCutout() {
    }

    /** @param png a imagem que vai aos provedores (o recorte em PNG) · @param removedHere o fundo saiu aqui */
    public record Prepared(BufferedImage cutout, byte[] png, boolean removedHere) {
    }

    /** A foto tem fundo e o recorte local não é confiável: não há silhueta para modelar. */
    public static final class NoCutoutException extends RuntimeException {
        public NoCutoutException(String reason) {
            super(reason);
        }
    }

    public static Prepared prepare(byte[] bytes) {
        BufferedImage img = ImageOps.toArgb(ImageOps.decode(bytes));
        if (transparentShare(img) >= MIN_TRANSPARENT) {
            return new Prepared(img, bytes, false);
        }
        ImageOps.Cutout cut = ImageOps.removeBackgroundLocal(img);
        BufferedImage out = ImageOps.toArgb(cut.image());
        if (cut.confidence() < MIN_CONFIDENCE || transparentShare(out) < MIN_TRANSPARENT) {
            throw new NoCutoutException(cut.warning() != null ? cut.warning() : "fundo não separado da peça");
        }
        return new Prepared(out, ImageOps.png(out), true);
    }

    /** Fração dos pixels com alfa abaixo de 128 (amostra a cada 2 px: basta para decidir). */
    static double transparentShare(BufferedImage img) {
        long clear = 0, total = 0;
        for (int y = 0; y < img.getHeight(); y += 2) {
            for (int x = 0; x < img.getWidth(); x += 2) {
                total++;
                if ((img.getRGB(x, y) >>> 24) < 128) {
                    clear++;
                }
            }
        }
        return total == 0 ? 0 : clear / (double) total;
    }
}
