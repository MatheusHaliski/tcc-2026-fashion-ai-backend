package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.catalog.image.ImageModel.CanvasSpec;
import br.com.fashionai.application.catalog.image.ImageModel.CropPlan;
import br.com.fashionai.application.catalog.image.ImageModel.FramingInput;
import br.com.fashionai.application.catalog.image.ImageModel.PieceType;
import br.com.fashionai.application.catalog.image.ImageModel.ProductContext;
import br.com.fashionai.application.catalog.image.ImageModel.Purpose;
import br.com.fashionai.application.catalog.image.ImageModel.Segmentation;
import br.com.fashionai.application.catalog.image.ImageModel.SourceImage;

import java.awt.image.BufferedImage;
import java.util.Optional;

/** RF47 · Pontos de extensão do pipeline de imagens oficiais (implementações plugáveis, ordem por @Order). */
public final class ImageStages {
    private ImageStages() {
    }

    /**
     * Um método de segmentação primeiro plano × fundo. O {@code ProductSegmenter} tenta os disponíveis na ordem e fica
     * com o primeiro de confiança suficiente; o local (flood fill) é sempre o último.
     */
    public interface SegmentationProvider {
        /** NATIVE_ALPHA · STUDIO_BACKDROP · REMBG_SELF_HOSTED · LOCAL_FLOOD · THIRD_PARTY */
        String method();

        /** Provedor de terceiros só roda quando a fonte autorizou processamento por terceiros. */
        boolean thirdParty();

        boolean available();

        Optional<Segmentation> segment(SourceImage source, ProductContext context);
    }

    /**
     * Máscara de pessoa por pixel na imagem de trabalho (pele, rosto, cabelo × roupa). Produção: ONNX local
     * (selfie_multiclass); testes: a verdade das fixtures sintéticas.
     */
    public interface PersonMaskProvider {
        boolean available();

        Optional<ImageModel.PersonMask> mask(BufferedImage work);
    }

    /** Estratégia de enquadramento por tipo de peça (Upper/Lower/Shoes/Accessory). */
    public interface FramingStrategy {
        PieceType type();

        CropPlan plan(FramingInput input, CanvasSpec canvas, Purpose purpose);
    }
}
