package br.com.fashionai.infrastructure.ai.image;

import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.imaging.ImageProviderPorts.ImageEditPort;
import br.com.fashionai.application.imaging.ImageProviderPorts.ProviderImage;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.awt.image.BufferedImage;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;

/**
 * Reserva da cópia da peça por IA: FLUX.1 Kontext Pro na Replicate (~US$0,04/imagem), editor imagem → imagem que
 * mantém o objeto da foto. Entra só quando o Gemini ({@link GeminiImageEditAdapter}, {@code @Order(1)}) falha ou não
 * está configurado. A criação, o acompanhamento e o download seguem as regras de token de
 * {@link ReplicateImageGenerationAdapter#predict}.
 */
@Component
@Order(2)
public class ReplicateImageEditAdapter implements ImageEditPort {
    /** A Replicate recomenda data URI só para arquivos pequenos: acima disso a foto é reduzida antes do envio. */
    static final int MAX_DATA_URI_BYTES = 240_000;
    private final ReplicateImageGenerationAdapter replicate;
    private final String model;

    @Autowired
    public ReplicateImageEditAdapter(@Value("${fashionai.ai.replicate-api-token:}") String token,
                                     @Value("${fashionai.ai.replicate-edit-model:black-forest-labs/flux-kontext-pro}") String model) {
        this(new ReplicateImageGenerationAdapter(token, model, ReplicateImageGenerationAdapter.API, Duration.ofSeconds(2)), model);
    }

    ReplicateImageEditAdapter(ReplicateImageGenerationAdapter replicate, String model) {
        this.replicate = replicate;
        this.model = model;
    }

    @Override
    public boolean available() {
        return replicate.available();
    }

    @Override
    public Optional<ProviderImage> edit(byte[] image, String mimeType, String prompt) {
        byte[] small = fitDataUri(image);
        Map<String, Object> input = Map.of("prompt", prompt,
                "input_image", ImageHttp.dataUri(small, small == image ? mimeType : "image/jpeg"),
                "aspect_ratio", "match_input_image", "output_format", "png", "safety_tolerance", 2);
        return replicate.predict(model, input, "0.04");
    }

    /** Reduz a foto (lado e qualidade) até caber no limite do data URI; já pequena, segue como veio. */
    static byte[] fitDataUri(byte[] image) {
        if (image.length <= MAX_DATA_URI_BYTES) {
            return image;
        }
        BufferedImage img = ImageOps.decode(image);
        byte[] out = image;
        for (int side : new int[]{1024, 896, 768, 640, 512}) {
            out = ImageOps.jpeg(ImageOps.scaleToFit(img, side, side), 0.85f);
            if (out.length <= MAX_DATA_URI_BYTES) {
                break;
            }
        }
        return out;
    }
}
