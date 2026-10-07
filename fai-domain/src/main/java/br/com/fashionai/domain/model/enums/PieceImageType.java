package br.com.fashionai.domain.model.enums;

/**
 * RF4 · Tipo do asset de imagem da peça. Combinado com a vista ({@link CaptureView}) dá ORIGINAL_FRONT, ORIGINAL_BACK,
 * CANONICAL_FRONT, CANONICAL_BACK… ORIGINAL nunca é sobrescrito; os demais são derivados determinísticos dele.
 */
public enum PieceImageType {
    ORIGINAL,
    CANONICAL,
    DETAIL,
    LOGO_DETAIL,
    TEXTURE_DETAIL,
    SEGMENTATION_MASK,
    /** RF15 · versão de apresentação (estúdio, editorial, filtro): rotulada, nunca substitui a canônica */
    PRESENTATION
}
