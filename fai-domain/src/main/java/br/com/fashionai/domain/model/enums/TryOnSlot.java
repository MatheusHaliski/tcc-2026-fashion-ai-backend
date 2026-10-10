package br.com.fashionai.domain.model.enums;

/**
 * Os quatro lugares do provador multiplataforma (MP-2): parte de cima, parte de baixo, calçado e acessório. São os
 * mesmos lugares de {@code TryOnService.SLOTS}, com nome estável para os clientes instalados (iOS, Android, Windows,
 * macOS, consoles). Peça inteira (vestido, macacão) ocupa a parte de cima e libera a de baixo.
 */
public enum TryOnSlot {
    TOP("upper_piece"),
    BOTTOM("lower_piece"),
    SHOES("shoes_piece"),
    ACCESSORY("accessory_piece");

    private final String category;

    TryOnSlot(String category) {
        this.category = category;
    }

    /** Categoria canônica da taxonomia (RF4) que entra neste lugar. */
    public String category() {
        return category;
    }

    /** Lugar da peça pela categoria gravada; peça inteira vai para cima; categoria desconhecida → null (revisar). */
    public static TryOnSlot ofCategory(String category) {
        if ("full_body_piece".equals(category)) {
            return TOP;
        }
        for (TryOnSlot s : values()) {
            if (s.category.equals(category)) {
                return s;
            }
        }
        return null;
    }
}
