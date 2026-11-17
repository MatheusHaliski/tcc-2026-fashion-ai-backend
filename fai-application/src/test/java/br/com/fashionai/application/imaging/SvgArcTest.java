package br.com.fashionai.application.imaging;

import org.junit.jupiter.api.Test;

import java.awt.geom.Path2D;
import java.awt.geom.PathIterator;
import java.awt.geom.Point2D;
import java.awt.geom.Rectangle2D;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/** Arco elíptico do SVG convertido em Béziers cúbicas (SVG 1.1, apêndice F.6). */
class SvgArcTest {

    private static Path2D start(double x, double y) {
        Path2D p = new Path2D.Double();
        p.moveTo(x, y);
        return p;
    }

    private static int cubics(Path2D p) {
        int n = 0;
        for (PathIterator it = p.getPathIterator(null); !it.isDone(); it.next()) {
            if (it.currentSegment(new double[6]) == PathIterator.SEG_CUBICTO) {
                n++;
            }
        }
        return n;
    }

    @Test
    void raioZeroViraLinhaReta() {
        Path2D p = start(0, 0);
        SvgArc.arc(p, 0, 0, 0, 10, 0, false, true, 10, 10);
        assertThat(cubics(p)).isZero();
        assertThat(p.getCurrentPoint()).isEqualTo(new Point2D.Double(10, 10));
    }

    @Test
    void meioCirculoTerminaNoPontoFinalEPassaPeloTopo() {
        Path2D p = start(0, 0);
        SvgArc.arc(p, 0, 0, 10, 10, 0, false, true, 20, 0);   // de (0,0) a (20,0), centro (10,0), raio 10
        assertThat(cubics(p)).isEqualTo(2);                    // 180° em trechos de até 90°
        assertThat(p.getCurrentPoint().getX()).isCloseTo(20, within(1e-9));
        assertThat(p.getCurrentPoint().getY()).isCloseTo(0, within(1e-9));
        Rectangle2D box = p.getBounds2D();
        assertThat(box.getMinX()).isCloseTo(0, within(1e-6));
        assertThat(box.getMaxX()).isCloseTo(20, within(1e-6));
        assertThat(Math.max(Math.abs(box.getMinY()), Math.abs(box.getMaxY()))).isCloseTo(10, within(0.1));
    }

    @Test
    void sweepEscolheOLadoDoArco() {
        Path2D cw = start(0, 0);
        SvgArc.arc(cw, 0, 0, 10, 10, 0, false, true, 20, 0);
        Path2D ccw = start(0, 0);
        SvgArc.arc(ccw, 0, 0, 10, 10, 0, false, false, 20, 0);
        double ladoCw = cw.getBounds2D().getCenterY(), ladoCcw = ccw.getBounds2D().getCenterY();
        assertThat(Math.signum(ladoCw)).isEqualTo(-Math.signum(ladoCcw));
    }

    @Test
    void raioPequenoDemaisEAumentadoAteAlcancarOPonto() {
        Path2D p = start(0, 0);
        SvgArc.arc(p, 0, 0, 1, 1, 0, false, true, 20, 0);    // raio 1 não chega a 20: vira meio círculo de raio 10
        assertThat(p.getCurrentPoint().getX()).isCloseTo(20, within(1e-9));
        assertThat(p.getBounds2D().getHeight()).isCloseTo(10, within(0.1));
    }

    @Test
    void arcoGrandeUsaMaisTrechos() {
        Path2D pequeno = start(0, 0);
        SvgArc.arc(pequeno, 0, 0, 20, 20, 0, false, true, 10, 0);
        Path2D grande = start(0, 0);
        SvgArc.arc(grande, 0, 0, 20, 20, 0, true, true, 10, 0);
        assertThat(cubics(grande)).isGreaterThan(cubics(pequeno));
        assertThat(grande.getCurrentPoint().getX()).isCloseTo(10, within(1e-9));
    }
}
