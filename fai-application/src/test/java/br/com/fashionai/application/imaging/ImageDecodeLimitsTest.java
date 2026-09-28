package br.com.fashionai.application.imaging;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.moderation.ImageSafety;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.awt.image.BufferedImage;
import java.nio.ByteBuffer;
import java.util.List;
import java.util.zip.CRC32;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Bomba de descompressão: as dimensões do cabeçalho são conferidas antes de qualquer pixel ser alocado. */
class ImageDecodeLimitsTest {
    @AfterEach
    void restore() {
        ImageOps.configureLimits(ImageOps.DEFAULT_MAX_PIXELS, ImageOps.DEFAULT_MAX_SIDE);
    }

    /** PNG de poucos bytes que declara {@code w×h} no IHDR (o conteúdo real é 1×1). */
    static byte[] pngDeclaring(int w, int h) {
        byte[] png = ImageOps.png(new BufferedImage(1, 1, BufferedImage.TYPE_INT_ARGB));
        ByteBuffer.wrap(png, 16, 8).putInt(w).putInt(h);
        CRC32 crc = new CRC32();
        crc.update(png, 12, 17);                          // "IHDR" + 13 bytes de dados
        ByteBuffer.wrap(png, 29, 4).putInt((int) crc.getValue());
        return png;
    }

    private static String code(Runnable r) {
        return assertThrows(ApiException.class, r::run).code();
    }

    @Test
    void cabecalhoGiganteERecusadoSemDecodificar() {
        byte[] bomb = pngDeclaring(50_000, 50_000);
        assertTrue(bomb.length < 200);
        assertEquals(new ImageOps.Dimensions(50_000, 50_000), ImageOps.dimensions(bomb).orElseThrow());
        assertEquals(ImageOps.TOO_LARGE, code(() -> ImageOps.decode(bomb)));
    }

    @Test
    void ladoAcimaDoTetoTambemERecusadoMesmoComPoucosPixels() {
        assertEquals(ImageOps.TOO_LARGE, code(() -> ImageOps.decode(pngDeclaring(12_001, 10))));
    }

    @Test
    void tetoConfiguravel() {
        byte[] jpeg = ImageOps.jpeg(new BufferedImage(300, 200, BufferedImage.TYPE_INT_RGB), 0.8f);
        assertEquals(300, ImageOps.decode(jpeg).getWidth());
        ImageOps.configureLimits(50_000, 12_000);
        assertEquals(ImageOps.TOO_LARGE, code(() -> ImageOps.decode(jpeg)));
        ImageOps.configureLimits(1_000_000, 250);
        assertEquals(ImageOps.TOO_LARGE, code(() -> ImageOps.decode(jpeg)));
    }

    @Test
    void imagemNormalContinuaSaindoEmArgb() {
        BufferedImage img = ImageOps.decode(ImageOps.jpeg(new BufferedImage(64, 48, BufferedImage.TYPE_INT_RGB), 0.8f));
        assertEquals(BufferedImage.TYPE_INT_ARGB, img.getType());
        assertEquals(64, img.getWidth());
        assertEquals(48, img.getHeight());
    }

    @Test
    void lixoContinuaIlegivel() {
        assertEquals("IMAGEM_ILEGIVEL", code(() -> ImageOps.decode("nao-e-imagem-nenhuma".getBytes())));
        assertEquals("IMAGEM_ILEGIVEL", code(() -> ImageOps.decode(new byte[0])));
    }

    @Test
    void moderacaoRecusaABombaEmVezDeTratarComoIlegivel() {
        ImageSafety safety = new ImageSafety(List.of(), List.of(), false);
        assertEquals(ImageOps.TOO_LARGE, code(() -> safety.check(pngDeclaring(40_000, 40_000))));
    }
}
