package br.com.fashionai.application.catalog.image;

import java.util.LinkedHashMap;
import java.util.Map;

/** Retângulo em coordenadas normalizadas da foto original (0–1). Pode passar das bordas quando há smartPadding. */
public record NRect(double x, double y, double w, double h) {
    public static NRect of(double[] r) {
        return new NRect(r[0], r[1], r[2], r[3]);
    }

    public double x2() {
        return x + w;
    }

    public double y2() {
        return y + h;
    }

    public double cx() {
        return x + w / 2;
    }

    public double cy() {
        return y + h / 2;
    }

    public double area() {
        return Math.max(0, w) * Math.max(0, h);
    }

    /** Sub-retângulo dado em coordenadas relativas a este (registro de regiões: relativo à caixa do produto). */
    public NRect sub(NRect rel) {
        return new NRect(x + rel.x * w, y + rel.y * h, rel.w * w, rel.h * h);
    }

    public NRect intersect(NRect o) {
        double ax = Math.max(x, o.x), ay = Math.max(y, o.y), bx = Math.min(x2(), o.x2()), by = Math.min(y2(), o.y2());
        return bx <= ax || by <= ay ? new NRect(ax, ay, 0, 0) : new NRect(ax, ay, bx - ax, by - ay);
    }

    public NRect union(NRect o) {
        double ax = Math.min(x, o.x), ay = Math.min(y, o.y);
        return new NRect(ax, ay, Math.max(x2(), o.x2()) - ax, Math.max(y2(), o.y2()) - ay);
    }

    /** Fração da área deste retângulo que fica dentro de {@code o}. */
    public double insideOf(NRect o) {
        double a = area();
        return a <= 0 ? 0 : intersect(o).area() / a;
    }

    public NRect clampTo(NRect bounds) {
        return intersect(bounds);
    }

    public NRect expand(double dx, double dy) {
        return new NRect(x - dx, y - dy, w + 2 * dx, h + 2 * dy);
    }

    public Map<String, Object> toMap() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("x", r4(x));
        m.put("y", r4(y));
        m.put("w", r4(w));
        m.put("h", r4(h));
        return m;
    }

    static double r4(double v) {
        return Math.round(v * 10000) / 10000.0;
    }
}
