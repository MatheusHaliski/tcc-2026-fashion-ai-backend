package br.com.fashionai.application.catalog;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.CatalogVariant;

import java.util.List;
import java.util.Locale;
import java.util.function.Predicate;

/**
 * Identidade da variante do catálogo (exercício 20): o SKU e a cor valem juntos, na MESMA variante. Reúne a escolha da
 * variante pelo identificador buscado, a conferência da cor declarada ao guardar a peça e o SKU que a peça herda.
 */
final class CatalogVariantIdentity {
    private CatalogVariantIdentity() {
    }

    /**
     * A variante que o identificador aponta (SKU, código ou chave, sem diferenciar maiúsculas); com cor pedida, a mesma
     * variante precisa ter essa cor. Sem variante que atenda aos dois, devolve {@code null}: o produto foi achado pelo
     * código dele mesmo e nenhuma variante é pré-selecionada.
     */
    static CatalogVariant byIdentifier(List<CatalogVariant> variants, String identifier, String color) {
        if (identifier == null || identifier.isBlank()) {
            return null;
        }
        String code = identifier.trim().toLowerCase(Locale.ROOT);
        return variants.stream()
                .filter(v -> same(v.getSku(), code) || same(v.getVariantCode(), code) || same(v.getVariantKey(), code))
                .filter(v -> color == null || color.equals(v.getColor()))
                .findFirst().orElse(null);
    }

    /**
     * Cor da peça criada. Quando a pessoa escolheu a variante, a cor declarada não pode contradizê-la: o conflito é
     * recusado em vez de a cor do payload esconder a variante. Sem variante escolhida vale a primeira cor válida.
     */
    static String color(String declared, CatalogVariant chosen, CatalogVariant effective, CatalogProduct product) {
        String ofChosen = chosen == null ? null : chosen.getColor();
        if (ofChosen != null && Taxonomy.COLORS.containsKey(ofChosen) && declared != null && !declared.isBlank()
                && !ofChosen.equals(declared)) {
            throw ApiException.badRequest("COR_DIVERGE_DA_VARIANTE", Msg.t("catalog.cor_diverge_da_variante"));
        }
        return firstValid(declared, effective == null ? null : effective.getColor(), product.getColor(),
                Taxonomy.COLORS::containsKey, "black");
    }

    /** SKU que a peça guarda: o da variante quando ela tem um; senão o do produto. */
    static String sku(CatalogVariant variant, CatalogProduct product) {
        return variant != null && variant.getSku() != null && !variant.getSku().isBlank() ? variant.getSku() : product.getSku();
    }

    static String firstValid(String a, String b, String c, Predicate<String> valid, String fallback) {
        for (String v : new String[]{a, b, c}) {
            if (v != null && valid.test(v)) {
                return v;
            }
        }
        return fallback;
    }

    private static boolean same(String value, String code) {
        return value != null && value.toLowerCase(Locale.ROOT).equals(code);
    }
}
