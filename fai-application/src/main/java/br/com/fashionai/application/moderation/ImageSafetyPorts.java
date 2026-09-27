package br.com.fashionai.application.moderation;

import java.awt.image.BufferedImage;
import java.util.Optional;

/** Portas da moderação de imagens enviadas (docs/seguranca/moderacao-de-imagens.md). */
public final class ImageSafetyPorts {
    private ImageSafetyPorts() {
    }

    /**
     * Classificador remoto de conteúdo (ex.: Google Cloud Vision SafeSearch). Probabilidades na escala do SafeSearch:
     * 0 desconhecido, 1 muito improvável, 2 improvável, 3 possível, 4 provável, 5 muito provável.
     */
    public interface RemoteClassifierPort {
        String name();

        boolean available();

        Optional<Likelihoods> classify(byte[] jpeg);
    }

    public record Likelihoods(int adult, int racy, int violence) {
    }

    /** Segmentação de pessoa local (cabelo, pele do corpo, pele do rosto, roupa) — o que é roupa e o que é pele. */
    public interface PersonSegmentationPort {
        boolean available();

        Optional<PersonParts> segment(BufferedImage image);
    }

    /**
     * @param person   fração da imagem ocupada pela pessoa
     * @param bodySkin fração da pessoa que é pele do corpo (sem o rosto)
     * @param faceSkin fração da pessoa que é pele do rosto
     * @param clothes  fração da pessoa que é roupa
     */
    public record PersonParts(double person, double bodySkin, double faceSkin, double clothes) {
    }
}
