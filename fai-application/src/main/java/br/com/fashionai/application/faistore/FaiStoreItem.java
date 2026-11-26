package br.com.fashionai.application.faistore;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Item da Loja FAI Points: digital, comprado só com FAI Points e usado só dentro do app.
 *
 * @param id         identificador estável (vira o {@code ref_id} do lançamento no ledger)
 * @param type       um dos {@link #TYPES}
 * @param auraCode   código em {@code aura_art_offers} quando a compra também concede a licença da arte (Metamorfose)
 * @param visual     dados da amostra desenhada na tela (paleta, acabamento, configuração do móvel)
 * @param creator    marca ou celebridade que assina o item (nulo nos itens da FAI)
 * @param product    card do catálogo quando o item é uma peça digital de marca
 */
public record FaiStoreItem(String id, String type, String name, String description, int pricePoints, String auraCode,
                           Map<String, Object> visual, Map<String, Object> creator, Map<String, Object> product) {

    /** Ordem dos filtros na tela. */
    public static final java.util.List<String> TYPES = java.util.List.of(
            "AURA_PRESET", "WARDROBE", "ACERVO_ITEM", "PIECE_CARD", "LOOK_CARD", "BRAND_AURA", "BRAND_PIECE");

    Map<String, Object> view(boolean owned, long balance) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", id);
        out.put("type", type);
        out.put("name", name);
        out.put("description", description);
        out.put("pricePoints", pricePoints);
        out.put("visual", visual);
        out.put("creator", creator);
        out.put("product", product);
        out.put("owned", owned);
        out.put("affordable", owned || balance >= pricePoints);
        return out;
    }
}
