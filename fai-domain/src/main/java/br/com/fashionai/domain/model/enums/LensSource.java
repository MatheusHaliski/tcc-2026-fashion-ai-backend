package br.com.fashionai.domain.model.enums;

/**
 * RF54 · FashionAI Lens — de onde veio a imagem do scan: câmera, galeria ou arquivo enviado pela pessoa, ou uma peça/look
 * do próprio app ("Ver no Lens"; só quando quem pede pode ver o original).
 */
public enum LensSource {
    CAMERA,
    GALLERY,
    UPLOAD,
    IN_APP_PIECE,
    IN_APP_LOOK;

    public boolean inApp() {
        return this == IN_APP_PIECE || this == IN_APP_LOOK;
    }
}
