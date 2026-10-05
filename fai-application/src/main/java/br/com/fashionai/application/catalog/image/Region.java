package br.com.fashionai.application.catalog.image;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Retângulo normalizado (0–1) numa imagem: {@code x0,y0} canto superior esquerdo, {@code x1,y1} inferior direito.
 * Pode passar de [0, 1] quando descreve a janela de um enquadramento com margem além da foto (o fundo completa).
 */
public record Region(double x0, double y0, double x1, double y1) {
    public static final Region FULL = new Region(0, 0, 1, 1);

    public Region {
        if (Double.isNaN(x0) || Double.isNaN(y0) || Double.isNaN(x1) || Double.isNaN(y1)) {
            throw new IllegalArgumentException("região com NaN");
        }
        if (x1 < x0) {
            double t = x0;
            x0 = x1;
            x1 = t;
        }
        if (y1 < y0) {
            double t = y0;
            y0 = y1;
            y1 = t;
        }
    }

    public static Region ofPixels(int x, int y, int w, int h, int imgW, int imgH) {
        return new Region(x / (double) imgW, y / (double) imgH, (x + w) / (double) imgW, (y + h) / (double) imgH);
    }

    public double width() {
        return x1 - x0;
    }

    public double height() {
        return y1 - y0;
    }

    public double area() {
        return Math.max(0, width()) * Math.max(0, height());
    }

    public double cx() {
        return (x0 + x1) / 2;
    }

    public double cy() {
        return (y0 + y1) / 2;
    }

    public boolean isEmpty() {
        return width() <= 0 || height() <= 0;
    }

    public Region intersect(Region o) {
        double a = Math.max(x0, o.x0), b = Math.max(y0, o.y0), c = Math.min(x1, o.x1), d = Math.min(y1, o.y1);
        return c <= a || d <= b ? new Region(a, b, a, b) : new Region(a, b, c, d);
    }

    public Region union(Region o) {
        return new Region(Math.min(x0, o.x0), Math.min(y0, o.y0), Math.max(x1, o.x1), Math.max(y1, o.y1));
    }

    /** Fração da área desta região que cai dentro de {@code o} (1 = inteira dentro). */
    public double fractionInside(Region o) {
        double a = area();
        return a <= 0 ? 0 : intersect(o).area() / a;
    }

    public boolean contains(Region o) {
        return o.x0 >= x0 - 1e-9 && o.y0 >= y0 - 1e-9 && o.x1 <= x1 + 1e-9 && o.y1 <= y1 + 1e-9;
    }

    /** Cresce cada lado pela fração dada da própria largura/altura (negativo encolhe). */
    public Region expand(double fx, double fy) {
        double dx = width() * fx, dy = height() * fy;
        return new Region(x0 - dx, y0 - dy, x1 + dx, y1 + dy);
    }

    public Region clamp() {
        return new Region(clamp01(x0), clamp01(y0), clamp01(x1), clamp01(y1));
    }

    /** Mapeia um ponto relativo desta região (0–1 dentro dela) para coordenadas da imagem. */
    public Region sub(double rx0, double ry0, double rx1, double ry1) {
        return new Region(x0 + rx0 * width(), y0 + ry0 * height(), x0 + rx1 * width(), y0 + ry1 * height());
    }

    public int[] toPixels(int imgW, int imgH) {
        int px = (int) Math.floor(x0 * imgW), py = (int) Math.floor(y0 * imgH);
        int qx = (int) Math.ceil(x1 * imgW), qy = (int) Math.ceil(y1 * imgH);
        return new int[]{px, py, Math.max(0, qx - px), Math.max(0, qy - py)};
    }

    public Map<String, Object> toMap() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("x", r(x0));
        m.put("y", r(y0));
        m.put("w", r(width()));
        m.put("h", r(height()));
        return m;
    }

    public static Region fromMap(Map<?, ?> m) {
        double x = num(m.get("x")), y = num(m.get("y")), w = num(m.get("w")), h = num(m.get("h"));
        return new Region(x, y, x + w, y + h);
    }

    private static double num(Object o) {
        return o instanceof Number n ? n.doubleValue() : Double.parseDouble(String.valueOf(o));
    }

    private static double clamp01(double v) {
        return Math.max(0, Math.min(1, v));
    }

    static double r(double v) {
        return Math.round(v * 10000) / 10000.0;
    }
}
