package br.com.fashionai.application.imaging;

import java.awt.geom.Path2D;

/**
 * Comando {@code A}/{@code a} do caminho SVG ({@link SvgPathRenderer#path}): arco elíptico convertido em curvas de
 * Bézier cúbicas pela parametrização por centro (SVG 1.1, apêndice F.6). Puro: só acrescenta segmentos ao caminho.
 */
final class SvgArc {
    private SvgArc() {
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
