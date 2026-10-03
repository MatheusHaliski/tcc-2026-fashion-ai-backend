package br.com.fashionai.domain.model.enums;

/**
 * RF4 · Captura adaptativa — vista semântica de uma foto da peça. Cada pedido de foto complementar tem uma vista e um
 * propósito ({@link CapturePurpose}); nunca "upload 2, upload 3".
 */
public enum CaptureView {
    FRONT_VIEW,
    BACK_VIEW,
    LEFT_SIDE,
    RIGHT_SIDE,
    THREE_QUARTER,
    TOP_VIEW,
    WATCH_FACE,
    LOGO_DETAIL,
    BRAND_DETAIL,
    TEXTURE_DETAIL,
    LABEL_DETAIL,
    INNER_LABEL,
    INNER_VIEW,
    SOLE_VIEW,
    TONGUE_LABEL,
    SERIAL_DETAIL,
    CLASP_DETAIL,
    HARDWARE_DETAIL,
    BUCKLE_DETAIL,
    WATCH_BACK,
    TEMPLE_DETAIL,
    ENGRAVING_DETAIL;

    /** Vistas de produto inteiro (vão ao recorte e ao asset canônico); as demais são detalhes (etiqueta, logo, textura…). */
    public boolean wholeProduct() {
        return switch (this) {
            case FRONT_VIEW, BACK_VIEW, LEFT_SIDE, RIGHT_SIDE, THREE_QUARTER, TOP_VIEW, WATCH_FACE, WATCH_BACK, SOLE_VIEW, INNER_VIEW -> true;
            default -> false;
        };
    }

    /** Vistas cujo valor está no texto (etiqueta, língua, verso, haste, gravação): o OCR sempre roda nelas. */
    public boolean textBearing() {
        return switch (this) {
            case LABEL_DETAIL, INNER_LABEL, TONGUE_LABEL, WATCH_BACK, TEMPLE_DETAIL, SERIAL_DETAIL, BRAND_DETAIL,
                 ENGRAVING_DETAIL, CLASP_DETAIL, BUCKLE_DETAIL, HARDWARE_DETAIL, LOGO_DETAIL -> true;
            default -> false;
        };
    }
}
