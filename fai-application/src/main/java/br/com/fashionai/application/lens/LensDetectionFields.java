package br.com.fashionai.application.lens;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.LensDetection;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Leitura dos campos gravados de uma {@link LensDetection} (caixa, cores, rótulo, embedding) e da caixa marcada pela
 * pessoa. Puro: sem repositório nem storage; usado pelo {@link LensService} e pelos seus colaboradores.
 */
final class LensDetectionFields {
    /** Lado menor mínimo (em %) de uma caixa marcada pela pessoa — a mesma regra do detector de várias peças. */
    static final double MIN_BOX_PCT = 3.0;

    private LensDetectionFields() {
    }

    static LensReading.Piece readingPiece(LensDetection d) {
        LensViews.Box b = box(d);
        return new LensReading.Piece(d.getId(), d.getCategory(), d.getSubcategory(), d.getMaterial(), Json.csv(d.getStyleTags()),
                Json.csv(d.getOccasionTags()), colors(d), Math.max(0, b.w()) * Math.max(0, b.h()) / 10000.0);
    }

    static LensViews.Box box(LensDetection d) {
        Map<String, Object> m = Json.map(d.getBoxJson());
        return new LensViews.Box(num(m.get("x")), num(m.get("y")), num(m.get("w")), num(m.get("h")));
    }

    /** Caixa marcada pela pessoa: os quatro números, presa dentro da imagem e com lado mínimo de 3%. */
    static LensViews.Box box(LensService.BoxInput in) {
        if (in == null || in.x() == null || in.y() == null || in.w() == null || in.h() == null) {
            throw ApiException.badRequest("CAIXA_INVALIDA", Msg.t("lens.caixa_invalida"), Map.of("field", "box"));
        }
        double x0 = clamp100(in.x()), y0 = clamp100(in.y());
        double x1 = clamp100(in.x() + in.w()), y1 = clamp100(in.y() + in.h());
        if (x1 - x0 < MIN_BOX_PCT || y1 - y0 < MIN_BOX_PCT) {
            throw ApiException.badRequest("CAIXA_INVALIDA", Msg.t("lens.caixa_invalida"), Map.of("field", "box"));
        }
        return new LensViews.Box(round1(x0), round1(y0), round1(x1 - x0), round1(y1 - y0));
    }

    static List<LensViews.ColorShare> colors(LensDetection d) {
        List<LensViews.ColorShare> out = new ArrayList<>();
        for (Map<String, Object> m : Json.list(d.getColorsJson())) {
            Object name = m.get("name");
            if (name instanceof String n && !n.isBlank()) {
                out.add(new LensViews.ColorShare(n, m.get("hex") instanceof String h ? h : Taxonomy.COLORS.get(n), num(m.get("share"))));
            }
        }
        return out;
    }

    /** Cor corrigida vira a principal (com a fração da antiga principal); a repetida sai das secundárias. */
    static List<LensViews.ColorShare> withMainColor(List<LensViews.ColorShare> colors, String color) {
        List<LensViews.ColorShare> out = new ArrayList<>();
        if (color == null) {
            return colors.size() > 1 ? new ArrayList<>(colors.subList(1, colors.size())) : out;
        }
        double share = colors.isEmpty() ? 1.0 : colors.get(0).share();
        out.add(new LensViews.ColorShare(color, Taxonomy.hex(color), share <= 0 ? 1.0 : share));
        colors.stream().skip(1).filter(c -> !c.name().equals(color)).forEach(out::add);
        return out;
    }

    static String defaultLabel(String category, String subcategory) {
        if (subcategory != null) {
            return Taxonomy.label(subcategory);
        }
        if (category != null) {
            return Taxonomy.label(category);
        }
        return Msg.t("lens.peca");
    }

    static float[] embedding(String json) {
        List<Double> v = Json.doubles(json);
        if (v.isEmpty()) {
            return null;
        }
        float[] out = new float[v.size()];
        for (int i = 0; i < out.length; i++) {
            out[i] = v.get(i) == null ? 0f : v.get(i).floatValue();
        }
        return out;
    }

    static List<Double> round4(float[] v) {
        List<Double> out = new ArrayList<>(v == null ? 0 : v.length);
        if (v != null) {
            for (float f : v) {
                out.add(Math.round(f * 10000) / 10000.0);
            }
        }
        return out;
    }

    private static double num(Object o) {
        return o instanceof Number n ? n.doubleValue() : 0;
    }

    private static double clamp100(double v) {
        return Math.max(0, Math.min(100, v));
    }

    private static double round1(double v) {
        return Math.round(v * 10) / 10.0;
    }
}
