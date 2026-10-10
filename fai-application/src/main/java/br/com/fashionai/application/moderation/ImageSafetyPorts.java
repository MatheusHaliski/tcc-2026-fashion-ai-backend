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
         * Mapa de classes por pixel da imagem inteira (RF4 · várias peças numa foto vestida): vazio quando a porta não o
         * oferece. A resolução é a do segmentador; as coordenadas cobrem a imagem de canto a canto, sem as faixas de encaixe.
         */
        default Optional<ClassMap> classes(BufferedImage image) {
            return Optional.empty();
        }
    }

    /** Classe de cada pixel: 0 fundo · 1 cabelo · 2 pele do corpo · 3 pele do rosto · 4 roupa · 5 acessório. */
    public record ClassMap(int width, int height, byte[] classes) {
        public static final int BACKGROUND = 0, HAIR = 1, BODY_SKIN = 2, FACE_SKIN = 3, CLOTHES = 4, OTHER = 5;

        public int at(int x, int y) {
            return classes[y * width + x];
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
