package br.com.fashionai.application.imaging;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Foto de celular em retrato: o arquivo vem deitado + tag EXIF Orientation; o decode tem de devolver a foto em pé. */
class ImageOrientationTest {

    /** 64×32 com o quadrante superior esquerdo vermelho e o resto azul (blocos grandes resistem ao JPEG). */
    private static BufferedImage landscape() {
        BufferedImage img = new BufferedImage(64, 32, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(Color.BLUE);
        g.fillRect(0, 0, 64, 32);
        g.setColor(Color.RED);
        g.fillRect(0, 0, 32, 16);
        g.dispose();
        return img;
    }

    /** JPEG com um APP1 Exif mínimo (IFD0 com a tag 0x0112) logo depois do APP0 do JFIF. */
    static byte[] jpegWithOrientation(BufferedImage img, int orientation, boolean littleEndian) {
        byte[] jpeg = ImageOps.jpeg(img, 0.95f);
        byte[] t = tiff(orientation, littleEndian);
        int len = 2 + 6 + t.length;
        ByteArrayOutputStream app1 = new ByteArrayOutputStream();
        writeBytes(app1, new byte[]{(byte) 0xFF, (byte) 0xE1, (byte) (len >> 8), (byte) len, 'E', 'x', 'i', 'f', 0, 0});
        writeBytes(app1, t);
        int app0End = 2 + 2 + (((jpeg[4] & 0xFF) << 8) | (jpeg[5] & 0xFF));
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(jpeg, 0, app0End);
        writeBytes(out, app1.toByteArray());
        out.write(jpeg, app0End, jpeg.length - app0End);
        return out.toByteArray();
    }

    /** PNG com o chunk eXIf (TIFF direto) logo depois do IHDR, como gravam o macOS e o Pillow. */
    static byte[] pngWithOrientation(BufferedImage img, int orientation) {
        byte[] png = ImageOps.png(img);
        byte[] t = tiff(orientation, false);
        int ihdrEnd = 8 + 4 + 4 + 13 + 4;
        ByteArrayOutputStream chunk = new ByteArrayOutputStream();
        write32(chunk, t.length, false);
        byte[] typeAndData = new byte[4 + t.length];
        System.arraycopy(new byte[]{'e', 'X', 'I', 'f'}, 0, typeAndData, 0, 4);
        System.arraycopy(t, 0, typeAndData, 4, t.length);
        writeBytes(chunk, typeAndData);
        java.util.zip.CRC32 crc = new java.util.zip.CRC32();
        crc.update(typeAndData);
        write32(chunk, (int) crc.getValue(), false);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(png, 0, ihdrEnd);
        writeBytes(out, chunk.toByteArray());
        out.write(png, ihdrEnd, png.length - ihdrEnd);
        return out.toByteArray();
    }

    /** Estrutura RIFF de um WebP estendido (VP8X + EXIF); só os cabeçalhos, para a leitura da tag. */
    static byte[] webpHeadersWithOrientation(int orientation, boolean exifPrefix) {
        byte[] t = tiff(orientation, true);
        byte[] exif = exifPrefix ? new byte[6 + t.length] : t;
        if (exifPrefix) {
            System.arraycopy(new byte[]{'E', 'x', 'i', 'f', 0, 0}, 0, exif, 0, 6);
            System.arraycopy(t, 0, exif, 6, t.length);
        }
        ByteArrayOutputStream body = new ByteArrayOutputStream();
        writeBytes(body, new byte[]{'W', 'E', 'B', 'P', 'V', 'P', '8', 'X'});
        write32(body, 10, true);
        writeBytes(body, new byte[]{0x08, 0, 0, 0, 63, 0, 0, 31, 0, 0});
        writeBytes(body, new byte[]{'E', 'X', 'I', 'F'});
        write32(body, exif.length, true);
        writeBytes(body, exif);
        if ((exif.length & 1) == 1) {
            body.write(0);
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        writeBytes(out, new byte[]{'R', 'I', 'F', 'F'});
        write32(out, body.size(), true);
        writeBytes(out, body.toByteArray());
        return out.toByteArray();
    }

    /** TIFF mínimo do EXIF: IFD0 com uma entrada, a tag Orientation. */
    private static byte[] tiff(int orientation, boolean littleEndian) {
        ByteArrayOutputStream tiff = new ByteArrayOutputStream();
        writeBytes(tiff, littleEndian ? new byte[]{'I', 'I', 0x2A, 0} : new byte[]{'M', 'M', 0, 0x2A});
        write32(tiff, 8, littleEndian);                  // IFD0 logo após o cabeçalho
        write16(tiff, 1, littleEndian);                  // uma entrada
        write16(tiff, 0x0112, littleEndian);
        write16(tiff, 3, littleEndian);                  // SHORT
        write32(tiff, 1, littleEndian);
        write16(tiff, orientation, littleEndian);
        write16(tiff, 0, littleEndian);
        write32(tiff, 0, littleEndian);                  // sem próximo IFD
        return tiff.toByteArray();
    }

    private static void writeBytes(ByteArrayOutputStream o, byte[] b) {
        o.write(b, 0, b.length);
    }

    private static void write16(ByteArrayOutputStream o, int v, boolean le) {
        if (le) {
            o.write(v & 0xFF);
            o.write((v >> 8) & 0xFF);
        } else {
            o.write((v >> 8) & 0xFF);
            o.write(v & 0xFF);
        }
    }

    private static void write32(ByteArrayOutputStream o, int v, boolean le) {
        if (le) {
            write16(o, v & 0xFFFF, true);
            write16(o, (v >>> 16) & 0xFFFF, true);
        } else {
            write16(o, (v >>> 16) & 0xFFFF, false);
            write16(o, v & 0xFFFF, false);
        }
    }

    private static boolean red(BufferedImage img, int x, int y) {
        Color c = new Color(img.getRGB(x, y));
        return c.getRed() > 180 && c.getBlue() < 90;
    }

    @Test
    void semExifNadaMuda() {
        byte[] jpeg = ImageOps.jpeg(landscape(), 0.95f);
        assertEquals(1, ImageOps.exifOrientation(jpeg));
        BufferedImage img = ImageOps.decode(jpeg);
        assertEquals(64, img.getWidth());
        assertEquals(32, img.getHeight());
        assertTrue(red(img, 4, 4));
    }

    @ParameterizedTest(name = "orientação {0} ({1}): vermelho em ({4},{5})")
    @CsvSource({
            "6, true, 32, 64, 28, 4",     // retrato do celular girado para a direita: canto sup. esq. vai para o sup. dir.
            "6, false, 32, 64, 28, 4",
            "8, true, 32, 64, 4, 60",     // girado para a esquerda: vai para o inf. esq.
            "3, false, 64, 32, 60, 28",   // de cabeça para baixo
            "2, true, 64, 32, 60, 4",     // espelhado (câmera frontal)
    })
    void decodeAplicaOrientacao(int orientation, boolean le, int w, int h, int rx, int ry) {
        byte[] jpeg = jpegWithOrientation(landscape(), orientation, le);
        assertEquals(orientation, ImageOps.exifOrientation(jpeg));
        BufferedImage img = ImageOps.decode(jpeg);
        assertEquals(w, img.getWidth());
        assertEquals(h, img.getHeight());
        assertTrue(red(img, rx, ry), "o bloco vermelho deveria estar em (" + rx + "," + ry + ")");
    }

    @Test
    void orientRemapeiaCadaPixelNasOitoOrientacoes() {
        BufferedImage src = new BufferedImage(3, 2, BufferedImage.TYPE_INT_ARGB);
        int v = 1;
        for (int y = 0; y < 2; y++) {
            for (int x = 0; x < 3; x++) {
                src.setRGB(x, y, 0xFF000000 | v++);
            }
        }
        // onde o pixel (0,0) da origem vai parar em cada orientação (EXIF: 2 espelho, 3 180°, 4 espelho vertical,
        // 5 transposta, 6 90° horário, 7 transversa, 8 90° anti-horário)
        int[][] where = {{0, 0}, {2, 0}, {2, 1}, {0, 1}, {0, 0}, {1, 0}, {1, 2}, {0, 2}};
        for (int o = 1; o <= 8; o++) {
            BufferedImage out = ImageOps.orient(src, o);
            assertEquals(o >= 5 ? 2 : 3, out.getWidth(), "largura na orientação " + o);
            assertEquals(1, out.getRGB(where[o - 1][0], where[o - 1][1]) & 0xFFFFFF, "pixel (0,0) na orientação " + o);
            int[] seen = out.getRGB(0, 0, out.getWidth(), out.getHeight(), null, 0, out.getWidth());
            int[] sorted = java.util.Arrays.stream(seen).map(p -> p & 0xFFFFFF).sorted().toArray();
            assertArrayEquals(new int[]{1, 2, 3, 4, 5, 6}, sorted, "nenhum pixel perdido na orientação " + o);
        }
    }

    @Test
    void pngComEXifTambemFicaEmPe() {
        byte[] png = pngWithOrientation(landscape(), 6);
        assertEquals(6, ImageOps.exifOrientation(png));
        BufferedImage img = ImageOps.decode(png);
        assertEquals(32, img.getWidth());
        assertEquals(64, img.getHeight());
        assertTrue(red(img, 28, 4));
    }

    @Test
    void webpComChunkExifDaAOrientacao() {
        assertEquals(6, ImageOps.exifOrientation(webpHeadersWithOrientation(6, false)));
        assertEquals(8, ImageOps.exifOrientation(webpHeadersWithOrientation(8, true)));
    }

    @Test
    void jpegComBytesDePreenchimentoAntesDoMarcador() {
        byte[] jpeg = jpegWithOrientation(landscape(), 6, true);
        byte[] padded = new byte[jpeg.length + 1];
        padded[0] = jpeg[0];
        padded[1] = jpeg[1];
        padded[2] = (byte) 0xFF;                          // FF extra antes do APP0
        System.arraycopy(jpeg, 2, padded, 3, jpeg.length - 2);
        assertEquals(6, ImageOps.exifOrientation(padded));
    }

    @Test
    void naoJpegOuExifQuebradoValeUm() {
        assertEquals(1, ImageOps.exifOrientation(ImageOps.png(landscape())));
        assertEquals(1, ImageOps.exifOrientation(new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE1, 0, 8, 'E', 'x', 'i', 'f'}));
        byte[] jpeg = jpegWithOrientation(landscape(), 6, true);
        byte[] cut = java.util.Arrays.copyOf(jpeg, 40);   // APP1 truncado no meio do IFD
        assertEquals(1, ImageOps.exifOrientation(cut));
        assertEquals(1, ImageOps.exifOrientation(null));
    }
}
