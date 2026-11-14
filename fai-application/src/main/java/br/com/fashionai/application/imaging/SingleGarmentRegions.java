package br.com.fashionai.application.imaging;

import br.com.fashionai.application.imaging.LocalPieceRegions.Region;

import java.awt.Color;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Uma peça só não vira várias: as regiões por cor de {@link LocalPieceRegions} cortam uma calça em pernas, cós e barra.
 * Aqui elas são conferidas contra os objetos da foto (blocos conexos de pixels diferentes do fundo):
 * <ul>
 *   <li>regiões dentro do MESMO objeto em que uma família de cor domina ({@link #DOMINANT_SHARE}) são uma peça — a
 *       caixa passa a ser a do objeto inteiro e a cor, a mais frequente nele (cós, barra, botões e etiqueta ficam nela);</li>
 *   <li>objeto com cores equilibradas (camiseta encostada na calça) continua separado: só se juntam as regiões da mesma
 *       família de cor e saem os fragmentos pequenos ({@link #FRAGMENT_SHARE} da maior);</li>
 *   <li>regiões fora de qualquer objeto medido (fundo irregular, objeto que toma a foto toda) ficam como estavam.</li>
 * </ul>
 * Objetos separados pelo fundo nunca se juntam: uma grade de catálogo continua com uma região por peça.
 */
final class SingleGarmentRegions {
    private SingleGarmentRegions() {
    }

    /** fração da área das regiões de um objeto que a família de cor dominante precisa ter para ele ser uma peça só */
    static final double DOMINANT_SHARE = 0.6;
    /** região menor que esta fração da maior do mesmo objeto é detalhe (bolso, etiqueta), não outra peça */
    static final double FRAGMENT_SHARE = 0.12;
    /** objeto maior que isto não é uma peça sobre um fundo: é a própria superfície */
    static final double MAX_OBJECT = 0.85;
    static final double MIN_OBJECT = 0.01;

    static List<Region> unify(int[] pixels, int w, int h, List<Region> regions) {
        ForegroundObjects objects = ForegroundObjects.find(pixels, w, h, MIN_OBJECT, MAX_OBJECT);
        if (objects.count() == 0) {
            return regions;
        }
        if (regions.isEmpty()) {
            return objects.count() == 1 ? List.of(objects.region(0, objects.dominantColor(0))) : regions;
        }
        List<List<Region>> byObject = new ArrayList<>();
        for (int i = 0; i < objects.count(); i++) {
            byObject.add(new ArrayList<>());
        }
        List<Region> out = new ArrayList<>();
        for (Region r : regions) {
            int object = objects.objectOf(r);
            if (object < 0) {
                out.add(r);
            } else {
                byObject.get(object).add(r);
            }
        }
        for (int i = 0; i < byObject.size(); i++) {
            out.addAll(unifyObject(byObject.get(i), objects, i));
        }
        out.sort(Comparator.comparingInt((Region r) -> (int) ((r.y() + r.height() / 2) / 12)).thenComparingDouble(Region::x));
        return List.copyOf(out);
    }

    /** As regiões de um objeto: uma peça só quando uma família de cor domina; senão, uma por família de cor. */
    private static List<Region> unifyObject(List<Region> inside, ForegroundObjects objects, int object) {
        if (inside.size() <= 1) {
            return inside;
        }
        inside.sort(Comparator.comparingDouble(SingleGarmentRegions::area).reversed());
        Region largest = inside.get(0);
        double total = 0, family = 0;
        for (Region r : inside) {
            total += area(r);
            family += sameFamily(r.rgb(), largest.rgb()) ? area(r) : 0;
        }
        if (family >= total * DOMINANT_SHARE) {
            return List.of(objects.region(object, objects.dominantColor(object)));
        }
        List<Region> merged = new ArrayList<>();
        for (Region r : inside) {
            if (area(r) < area(largest) * FRAGMENT_SHARE) {
                continue;
            }
            int same = -1;
            for (int i = 0; i < merged.size() && same < 0; i++) {
                same = sameFamily(merged.get(i).rgb(), r.rgb()) ? i : -1;
            }
            if (same < 0) {
                merged.add(r);
            } else {
                merged.set(same, union(merged.get(same), r));
            }
        }
        return merged;
    }

    private static double area(Region r) {
        return r.width() * r.height();
    }

    private static Region union(Region big, Region other) {
        double x0 = Math.min(big.x(), other.x()), y0 = Math.min(big.y(), other.y());
        double x1 = Math.max(big.x() + big.width(), other.x() + other.width());
        double y1 = Math.max(big.y() + big.height(), other.y() + other.height());
        return new Region(x0, y0, x1 - x0, y1 - y0, big.rgb());
    }

    /** Mesma família de cor: tons próximos, ou o mesmo matiz com luz diferente (o jeans na sombra continua azul). */
    static boolean sameFamily(int a, int b) {
        if (PixelStats.distance(a, b) <= 48) {
            return true;
        }
        float[] ha = hsb(a), hb = hsb(b);
        if (ha[1] < 0.25f || hb[1] < 0.25f || ha[2] < 0.15f || hb[2] < 0.15f) {
            return false;
        }
        float diff = Math.abs(ha[0] - hb[0]);
        return Math.min(diff, 1 - diff) <= 30f / 360f;
    }

    private static float[] hsb(int rgb) {
        return Color.RGBtoHSB((rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255, null);
    }
}
