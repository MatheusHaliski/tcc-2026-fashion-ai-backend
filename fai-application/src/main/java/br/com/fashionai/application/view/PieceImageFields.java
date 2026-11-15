package br.com.fashionai.application.view;

import br.com.fashionai.domain.model.WardrobeItem;

import java.util.Map;

/**
 * Campos de imagem de uma peça numa resposta resumida (chip do Copilot, linha de arrumação…): a imagem e o que a tela
 * precisa para pintar a ilustração de uma peça sem foto na cor do cadastro (categoria, subcategoria e cor). Sem eles,
 * a tela só tinha a ilustração da categoria, que é azul para qualquer cor.
 */
public final class PieceImageFields {
    private PieceImageFields() {
    }

    public static String imagem(WardrobeItem w) {
        return w.getThumbnailUrl() != null ? w.getThumbnailUrl() : w.getImageUrl();
    }

    public static void put(Map<String, Object> m, String chaveImagem, WardrobeItem w) {
        m.put(chaveImagem, imagem(w));
        m.put("category", w.getCategory());
        m.put("subcategory", w.getSubcategory());
        m.put("color", w.getColor());
    }
}
