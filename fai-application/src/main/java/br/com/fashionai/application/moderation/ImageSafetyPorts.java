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

        /**
         * Mapa de classes por pixel (pipeline de imagens oficiais do catálogo: tirar a pessoa da foto do produto).
         * Vazio quando a implementação não expõe o mapa.
         */
        default Optional<PersonClassMap> segmentClasses(BufferedImage image) {
            return Optional.empty();
        }
    }

    /**
     * Classes por pixel na grade do modelo ({@code size}×{@code size}); a imagem ocupa o retângulo
     * ({@code offsetX}, {@code offsetY}, {@code scaledW}, {@code scaledH}) dessa grade, sem distorção.
     * Classes: 0 fundo, 1 cabelo, 2 pele do corpo, 3 pele do rosto, 4 roupa, 5 acessório/outro.
     */
    public record PersonClassMap(int size, byte[] classes, int offsetX, int offsetY, int scaledW, int scaledH, String model) {
        public static final int BACKGROUND = 0, HAIR = 1, BODY_SKIN = 2, FACE_SKIN = 3, CLOTHES = 4, OTHER = 5;

        /** Classe no ponto normalizado (0–1) da imagem original. */
        public int classAt(double nx, double ny) {
            int x = offsetX + Math.min(scaledW - 1, Math.max(0, (int) (nx * scaledW)));
            int y = offsetY + Math.min(scaledH - 1, Math.max(0, (int) (ny * scaledH)));
            return classes[y * size + x];
        }
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
