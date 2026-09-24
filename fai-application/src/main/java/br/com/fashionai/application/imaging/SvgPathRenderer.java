package br.com.fashionai.application.imaging;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.AffineTransform;
import java.awt.geom.Path2D;
import java.awt.geom.Rectangle2D;
import java.awt.image.BufferedImage;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Renderizador mínimo de logos vetoriais (SVG de um ou mais {@code <path d="...">}, como os do catálogo aberto Simple
 * Icons e os logos do Wikimedia Commons de forma simples). Só lê o {@code viewBox} e os atributos {@code d}: nada de
 * script, estilo, imagem embutida ou referência externa é interpretado — por isso é seguro para SVG de terceiros.
 * <p>
 * Vetor não perde nitidez: o logo é desenhado em preto sobre branco, no tamanho final, com antisserrilhado.
 */
public final class SvgPathRenderer {
    private static final Pattern VIEWBOX = Pattern.compile("viewBox\\s*=\\s*\"([^\"]+)\"");
    private static final Pattern PATH_D = Pattern.compile("<path\\b[^>]*?\\sd\\s*=\\s*\"([^\"]+)\"", Pattern.CASE_INSENSITIVE);
    private static final Pattern FILL_RULE = Pattern.compile("fill-rule\\s*=\\s*\"evenodd\"", Pattern.CASE_INSENSITIVE);
    private static final Pattern TOKEN = Pattern.compile("[MmZzLlHhVvCcSsQqTtAa]|[-+]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][-+]?\\d+)?");
    static final int MAX_SVG_CHARS = 400_000;

    private SvgPathRenderer() {
    }

    public record Vector(Rectangle2D viewBox, Path2D shape) {
    }

    /** Lê o SVG; lança {@link IllegalArgumentException} quando não há caminho utilizável. */
    public static Vector parse(String svg) {
        if (svg == null || svg.length() > MAX_SVG_CHARS || !svg.contains("<svg")) {
            throw new IllegalArgumentException("SVG ausente ou grande demais");
        }
        Matcher vb = VIEWBOX.matcher(svg);
        Rectangle2D box = null;
        if (vb.find()) {
            String[] p = vb.group(1).trim().split("[\\s,]+");
            if (p.length == 4) {
                box = new Rectangle2D.Double(Double.parseDouble(p[0]), Double.parseDouble(p[1]), Double.parseDouble(p[2]), Double.parseDouble(p[3]));
            }
        }
        Path2D all = new Path2D.Double(FILL_RULE.matcher(svg).find() ? Path2D.WIND_EVEN_ODD : Path2D.WIND_NON_ZERO);
        Matcher m = PATH_D.matcher(svg);
        int paths = 0;
        while (m.find()) {
            all.append(path(m.group(1)), false);
            paths++;
        }
        if (paths == 0 || all.getBounds2D().isEmpty()) {
            throw new IllegalArgumentException("SVG sem <path> utilizável");
        }
        return new Vector(box == null ? all.getBounds2D() : box, all);
    }

    /**
     * Desenha só a área ocupada pelo logo (recorte justo + margem), em preto sobre branco, com o lado maior igual a
     * {@code longSide} pixels.
     */
    public static BufferedImage render(Vector v, int longSide, double marginFraction) {
        Rectangle2D b = v.shape().getBounds2D();
        double side = Math.max(b.getWidth(), b.getHeight());
        double margin = side * marginFraction;
        double w = b.getWidth() + 2 * margin;
        double h = b.getHeight() + 2 * margin;
        double scale = longSide / Math.max(w, h);
        int iw = Math.max(1, (int) Math.round(w * scale));
        int ih = Math.max(1, (int) Math.round(h * scale));
        BufferedImage img = new BufferedImage(iw, ih, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        try {
            g.setColor(Color.WHITE);
            g.fillRect(0, 0, iw, ih);
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.setRenderingHint(RenderingHints.KEY_STROKE_CONTROL, RenderingHints.VALUE_STROKE_PURE);
            AffineTransform t = new AffineTransform();
            t.scale(scale, scale);
            t.translate(-b.getX() + margin, -b.getY() + margin);
            g.setColor(Color.BLACK);
            g.fill(t.createTransformedShape(v.shape()));
        } finally {
            g.dispose();
        }
        return img;
    }

    // ================================================================== dados do caminho (comandos SVG 1.1)

    static Path2D path(String d) {
        List<String> tk = new ArrayList<>();
        Matcher m = TOKEN.matcher(d);
        while (m.find()) {
            tk.add(m.group());
        }
        Path2D.Double p = new Path2D.Double(Path2D.WIND_NON_ZERO);
        double x = 0, y = 0, sx = 0, sy = 0, cx = 0, cy = 0;
        char cmd = 0, prev = 0;
        int i = 0;
        boolean open = false;
        while (i < tk.size()) {
            String t = tk.get(i);
            if (Character.isLetter(t.charAt(0))) {
                cmd = t.charAt(0);
                i++;
                if (cmd == 'Z' || cmd == 'z') {
                    if (open) {
                        p.closePath();
                    }
                    x = sx;
                    y = sy;
                    prev = cmd;
                    open = false;
                    continue;
                }
            } else if (cmd == 0) {
                throw new IllegalArgumentException("caminho começa sem comando");
            }
            boolean rel = Character.isLowerCase(cmd);
            double ox = rel ? x : 0, oy = rel ? y : 0;
            switch (Character.toUpperCase(cmd)) {
                case 'M' -> {
                    x = ox + num(tk, i++);
                    y = oy + num(tk, i++);
                    p.moveTo(x, y);
                    sx = x;
                    sy = y;
                    open = true;
                    cmd = rel ? 'l' : 'L'; // pares seguintes do M são linhas
                }
                case 'L' -> {
                    x = ox + num(tk, i++);
                    y = oy + num(tk, i++);
                    p.lineTo(x, y);
                }
                case 'H' -> {
                    x = ox + num(tk, i++);
                    p.lineTo(x, y);
                }
                case 'V' -> {
                    y = oy + num(tk, i++);
                    p.lineTo(x, y);
                }
                case 'C' -> {
                    double x1 = ox + num(tk, i++), y1 = oy + num(tk, i++);
                    cx = ox + num(tk, i++);
                    cy = oy + num(tk, i++);
                    x = ox + num(tk, i++);
                    y = oy + num(tk, i++);
                    p.curveTo(x1, y1, cx, cy, x, y);
                }
                case 'S' -> {
                    boolean smooth = "CcSs".indexOf(prev) >= 0;
                    double x1 = smooth ? 2 * x - cx : x, y1 = smooth ? 2 * y - cy : y;
                    cx = ox + num(tk, i++);
                    cy = oy + num(tk, i++);
                    x = ox + num(tk, i++);
                    y = oy + num(tk, i++);
                    p.curveTo(x1, y1, cx, cy, x, y);
                }
                case 'Q' -> {
                    cx = ox + num(tk, i++);
                    cy = oy + num(tk, i++);
                    x = ox + num(tk, i++);
                    y = oy + num(tk, i++);
                    p.quadTo(cx, cy, x, y);
                }
                case 'T' -> {
                    boolean smooth = "QqTt".indexOf(prev) >= 0;
                    cx = smooth ? 2 * x - cx : x;
                    cy = smooth ? 2 * y - cy : y;
                    x = ox + num(tk, i++);
                    y = oy + num(tk, i++);
                    p.quadTo(cx, cy, x, y);
                }
                case 'A' -> {
                    double rx = num(tk, i++), ry = num(tk, i++), rot = num(tk, i++);
                    // flags podem vir colados ("a1 1 0 01 1 1"): o tokenizador separa "01" como número; trata dígito a dígito
                    int[] flags = new int[2];
                    for (int f = 0; f < 2; f++) {
                        String ft = tk.get(i);
                        if (ft.length() > 1 && (ft.charAt(0) == '0' || ft.charAt(0) == '1')) {
                            flags[f] = ft.charAt(0) - '0';
                            tk.set(i, ft.substring(1));
                        } else {
                            flags[f] = (int) num(tk, i++);
                        }
                    }
                    double ex = ox + num(tk, i++), ey = oy + num(tk, i++);
                    arc(p, x, y, rx, ry, rot, flags[0] == 1, flags[1] == 1, ex, ey);
                    x = ex;
                    y = ey;
                }
                default -> throw new IllegalArgumentException("comando SVG desconhecido: " + cmd);
            }
            prev = cmd;
        }
        return p;
    }

    private static double num(List<String> tk, int i) {
        if (i >= tk.size()) {
            throw new IllegalArgumentException("caminho SVG incompleto");
        }
        return Double.parseDouble(tk.get(i));
    }

    /** Arco elíptico SVG convertido em curvas de Bézier cúbicas (SVG 1.1, apêndice F.6). */
    static void arc(Path2D p, double x1, double y1, double rx, double ry, double angleDeg, boolean large, boolean sweep, double x2, double y2) {
        if (rx == 0 || ry == 0) {
            p.lineTo(x2, y2);
            return;
        }
        rx = Math.abs(rx);
        ry = Math.abs(ry);
        double phi = Math.toRadians(angleDeg % 360);
        double cos = Math.cos(phi), sin = Math.sin(phi);
        double dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
        double x1p = cos * dx + sin * dy, y1p = -sin * dx + cos * dy;
        double lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
        if (lambda > 1) {
            double s = Math.sqrt(lambda);
            rx *= s;
            ry *= s;
        }
        double num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
        double den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
        double coef = (large == sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
        double cxp = coef * rx * y1p / ry, cyp = coef * -ry * x1p / rx;
        double cx = cos * cxp - sin * cyp + (x1 + x2) / 2, cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
        double t1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
        double dt = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
        if (!sweep && dt > 0) {
            dt -= 2 * Math.PI;
        } else if (sweep && dt < 0) {
            dt += 2 * Math.PI;
        }
        int segs = (int) Math.ceil(Math.abs(dt) / (Math.PI / 2));
        double delta = dt / segs;
        double k = 4.0 / 3.0 * Math.tan(delta / 4);
        double t = t1;
        for (int s = 0; s < segs; s++) {
            double c1 = Math.cos(t), s1 = Math.sin(t), c2 = Math.cos(t + delta), s2 = Math.sin(t + delta);
            double[] e1 = {c1 - k * s1, s1 + k * c1}, e2 = {c2 + k * s2, s2 - k * c2}, e = {c2, s2};
            p.curveTo(px(e1, rx, ry, cos, sin, cx), py(e1, rx, ry, cos, sin, cy),
                    px(e2, rx, ry, cos, sin, cx), py(e2, rx, ry, cos, sin, cy),
                    px(e, rx, ry, cos, sin, cx), py(e, rx, ry, cos, sin, cy));
            t += delta;
        }
    }

    private static double px(double[] u, double rx, double ry, double cos, double sin, double cx) {
        return cos * rx * u[0] - sin * ry * u[1] + cx;
    }

    private static double py(double[] u, double rx, double ry, double cos, double sin, double cy) {
        return sin * rx * u[0] + cos * ry * u[1] + cy;
    }

    private static double angle(double ux, double uy, double vx, double vy) {
        double a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
        return a;
    }
}
