package br.com.fashionai.application.garmentdelivery;

import br.com.fashionai.application.atelierproject.AtelierProjectViews.Measurement;
import br.com.fashionai.application.garmentdelivery.GarmentDeliveryViews.Measure;
import br.com.fashionai.application.taxonomy.Taxonomy;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Regra pura de tamanho e medidas (docs/garment-delivery §6.4): a ficha descreve o tamanho-base (M nas letras, 40 na
 * numeração); a fábrica gradua ±3% por tamanho (arredondado a 0,5 cm), aplica a tolerância por faixa e o controle de
 * qualidade registra uma medida conferida determinística, sempre dentro da tolerância.
 */
final class GarmentSizeRules {
    private GarmentSizeRules() {
    }

    private static final BigDecimal STEP = new BigDecimal("0.03");
    private static final Map<String, String> LETTER_CODE = Map.of("PP", "xs", "P", "s", "M", "m", "G", "l", "GG", "xl", "XG", "xxl");

    static String base(String grid, List<String> labels) {
        if ("numeric".equals(grid) && labels.contains("40")) {
            return "40";
        }
        if (labels.contains("M")) {
            return "M";
        }
        return labels.isEmpty() ? null : labels.get(labels.size() / 2);
    }

    /** Medidas da ficha graduadas do tamanho-base para o escolhido; sem medida conferida (ela nasce no controle). */
    static List<Measure> graded(List<Measurement> spec, List<String> labels, String base, String selected) {
        int steps = labels.indexOf(selected) - labels.indexOf(base);
        BigDecimal factor = BigDecimal.ONE.add(STEP.multiply(BigDecimal.valueOf(steps)));
        return (spec == null ? List.<Measurement>of() : spec).stream().map(m -> {
            BigDecimal value = halfCentimeter(m.centimeters().multiply(factor));
            return new Measure(m.point(), m.protocol(), m.centimeters(), value, tolerance(value), null);
        }).toList();
    }

    /** ±1 cm abaixo de 50 cm, ±1,5 cm até 100 cm, ±2 cm acima. */
    static BigDecimal tolerance(BigDecimal value) {
        if (value.compareTo(new BigDecimal("50")) < 0) {
            return new BigDecimal("1.0");
        }
        return value.compareTo(new BigDecimal("100")) <= 0 ? new BigDecimal("1.5") : new BigDecimal("2.0");
    }

    /** Medida conferida: desvio determinístico (série + ponto) de no máximo 60% da tolerância, em décimos de cm. */
    static List<Measure> checked(List<Measure> graded, String serial) {
        return graded.stream().map(m -> {
            long seed = UUID.nameUUIDFromBytes((serial + "|" + m.point()).getBytes(StandardCharsets.UTF_8)).getLeastSignificantBits();
            double unit = (Math.floorMod(seed, 2001L) - 1000) / 1000.0;
            BigDecimal deviation = m.tolerance().multiply(BigDecimal.valueOf(0.6 * unit)).setScale(1, RoundingMode.HALF_UP);
            return new Measure(m.point(), m.protocol(), m.base(), m.value(), m.tolerance(), m.value().add(deviation).setScale(1, RoundingMode.HALF_UP));
        }).toList();
    }

    /** Rótulo da grade ("M", "G", "40") → código de tamanho do cadastro da peça ("m", "l", "br_40"). */
    static String sizeCode(String label) {
        if (label == null) {
            return "one_size";
        }
        String letter = LETTER_CODE.get(label.toUpperCase(Locale.ROOT));
        if (letter != null) {
            return letter;
        }
        String numeric = "br_" + label;
        return Taxonomy.SIZES.contains(numeric) ? numeric : "one_size";
    }

    private static BigDecimal halfCentimeter(BigDecimal value) {
        return value.multiply(BigDecimal.valueOf(2)).setScale(0, RoundingMode.HALF_UP).divide(BigDecimal.valueOf(2), 1, RoundingMode.UNNECESSARY);
    }
}
