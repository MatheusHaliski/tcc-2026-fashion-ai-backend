package br.com.fashionai.web.support;

import br.com.fashionai.application.imaging.ImageOps;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Teto de decodificação de imagens (bomba de descompressão): toda foto recebida passa por {@link ImageOps#decode}, que
 * lê as dimensões do cabeçalho e recusa as que passam do teto antes de alocar os pixels.
 */
@Component
public class ImageDecodeLimits {
    private static final Logger log = LoggerFactory.getLogger(ImageDecodeLimits.class);

    public ImageDecodeLimits(@Value("${fashionai.security.image-max-pixels:40000000}") long maxPixels,
                             @Value("${fashionai.security.image-max-side:12000}") int maxSide) {
        ImageOps.configureLimits(maxPixels, maxSide);
        log.info("Imagens: até {} pixels e {} px por lado (teto efetivo pelo heap: {} pixels)", maxPixels, maxSide, ImageOps.maxPixels());
    }
}
