package br.com.fashionai.application.catalog.image;

import java.util.Locale;

/** piece_type do catálogo (normalization.json → taxonomy): decide a estratégia de enquadramento e o perfil de escala. */
public enum PieceType {
    UPPER_PIECE("UPPER"), LOWER_PIECE("PANTS"), SHOES_PIECE("FOOTWEAR"), ACCESSORY_PIECE("GENERIC"), FULL_BODY_PIECE("DRESS");

    /** família do {@link br.com.fashionai.application.vision.landmarks.LandmarkDetector} */
    private final String landmarkFamily;

    PieceType(String landmarkFamily) {
        this.landmarkFamily = landmarkFamily;
    }

    public String landmarkFamily(String subcategory) {
        String s = subcategory == null ? "" : subcategory;
        if (this == LOWER_PIECE && (s.equals("skirt") || s.equals("skort"))) {
            return "SKIRT";
        }
        if (this == ACCESSORY_PIECE) {
            if (s.equals("watch")) {
                return "WATCH";
            }
            if (s.equals("sunglasses") || s.equals("eyeglasses")) {
                return "GLASSES";
            }
            if (s.endsWith("bag") || s.equals("clutch") || s.equals("backpack")) {
                return "BAG";
            }
        }
        return landmarkFamily;
    }

    /** Aceita a categoria do catálogo (upper_piece…) e os nomes do enum; desconhecida vira acessório (objeto inteiro). */
    public static PieceType of(String category) {
        if (category == null) {
            return ACCESSORY_PIECE;
        }
        String c = category.trim().toUpperCase(Locale.ROOT);
        for (PieceType t : values()) {
            if (t.name().equals(c)) {
                return t;
            }
        }
        return ACCESSORY_PIECE;
    }
}
