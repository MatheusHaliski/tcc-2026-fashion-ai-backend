package br.com.fashionai.application.hype;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.HypeScoreCurrent;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import static br.com.fashionai.application.hype.HypeQueryService.NO_REGION;

/** HypeScore v2 — recortes puros do ranking público: região, país, categorias, subcategorias, trend e normalização de filtros. */
final class HypeRankFilters {
    private HypeRankFilters() {
    }

    static String regionOf(HypeScoreCurrent c) {
        return blank(c.getRegion()) ? NO_REGION : c.getRegion().trim().toUpperCase(Locale.ROOT);
    }

    /** Peça: a própria categoria; look: as das peças dele (linhas anteriores à V39 só têm a coluna {@code category}). */
    static List<String> categoriesOf(HypeScoreCurrent c) {
        List<String> list = Json.csv(c.getCategories());
        return list.isEmpty() && !blank(c.getCategory()) ? List.of(c.getCategory()) : list;
    }

    static List<String> subcategoriesOf(HypeScoreCurrent c) {
        return Json.csv(c.getSubcategories());
    }

    static boolean inRegion(HypeScoreCurrent c, String region) {
        return blank(region) || region.equalsIgnoreCase(regionOf(c));
    }

    static boolean inCountry(HypeScoreCurrent c, String country) {
        return blank(country) || (c.getCountry() != null && country.equalsIgnoreCase(c.getCountry().trim()));
    }

    static boolean hasCategory(HypeScoreCurrent c, String category) {
        return blank(category) || categoriesOf(c).stream().anyMatch(category::equalsIgnoreCase);
    }

    static boolean hasSubcategory(HypeScoreCurrent c, String subcategory) {
        return blank(subcategory) || subcategoriesOf(c).stream().anyMatch(subcategory::equalsIgnoreCase);
    }

    static double trendOf(HypeScoreCurrent c) {
        return c.getDimensions() == null || c.getDimensions().getTrend() == null ? 0 : c.getDimensions().getTrend().doubleValue();
    }

    /** Ordem das categorias da taxonomia (parte de cima, de baixo, calçados, acessórios, peça inteira); fora dela, no fim. */
    static int categoryOrder(String category) {
        int i = new ArrayList<>(Taxonomy.SUBCATEGORIES.keySet()).indexOf(category);
        return i < 0 ? Integer.MAX_VALUE : i;
    }

    /** Rótulo adiado (resolvido no idioma de quem lê) de um código da taxonomia; sem rótulo, o próprio código. */
    static String taxonomyLabel(String code) {
        return Msg.has("taxonomy." + code) ? Msg.k("taxonomy." + code) : code;
    }

    static String upper(String s) {
        return blank(s) ? "" : s.trim().toUpperCase(Locale.ROOT);
    }

    static double round1(double v) {
        return Math.round(v * 10) / 10.0;
    }

    static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    static String norm(String s) {
        return blank(s) ? "" : s.trim().toLowerCase(Locale.ROOT);
    }
}
