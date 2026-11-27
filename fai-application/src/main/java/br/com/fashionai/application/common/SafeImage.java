package br.com.fashionai.application.common;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.Iterator;

/**
 * Re-codifica uma foto enviada pela pessoa como PNG limpo: confere assinatura e dimensões antes de alocar, descarta
 * metadados e nome de arquivo. Compartilhado por documentos privados (passaporte, devolução, reparo).
 */
public final class SafeImage {
    private SafeImage() {
    }

    /** {@code codePrefix} nomeia os códigos de erro do módulo (ex.: PASSPORT_IMAGE_SIZE). */
    public static byte[] png(byte[] bytes, String codePrefix) {
        if (bytes == null || bytes.length < 8 || bytes.length > 2 * 1024 * 1024) {
            throw ApiException.badRequest(codePrefix + "_IMAGE_SIZE", "Envie uma imagem PNG ou JPEG de até 2 MB.");
        }
        boolean png = bytes[0] == (byte) 137 && bytes[1] == 80 && bytes[2] == 78 && bytes[3] == 71 && bytes[4] == 13 && bytes[5] == 10 && bytes[6] == 26 && bytes[7] == 10;
        boolean jpeg = bytes[0] == (byte) 255 && bytes[1] == (byte) 216 && bytes[2] == (byte) 255;
        if (!png && !jpeg) throw ApiException.badRequest(codePrefix + "_IMAGE_TYPE", "Somente fotos PNG e JPEG são aceitas.");
        try (ImageInputStream in = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(in);
            if (!readers.hasNext()) throw new IllegalArgumentException();
            ImageReader reader = readers.next();
            try {
                reader.setInput(in, true, true);
                int width = reader.getWidth(0), height = reader.getHeight(0);
                if (width < 1 || height < 1 || width > 6000 || height > 6000 || (long) width * height > 12_000_000) throw new IllegalArgumentException();
                BufferedImage image = reader.read(0);
                ByteArrayOutputStream output = new ByteArrayOutputStream();
                ImageIO.write(image, "png", output);
                if (output.size() > 8 * 1024 * 1024) throw new IllegalArgumentException();
                return output.toByteArray();
            } finally {
                reader.dispose();
            }
        } catch (Exception ex) {
            throw ApiException.badRequest(codePrefix + "_INVALID_IMAGE", "Imagem inválida ou dimensões muito grandes.");
        }
    }
}
