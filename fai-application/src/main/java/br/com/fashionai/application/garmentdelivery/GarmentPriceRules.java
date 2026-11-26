package br.com.fashionai.application.garmentdelivery;

import br.com.fashionai.application.atelierproject.AtelierProjectViews.Specification;
import br.com.fashionai.application.garmentdelivery.GarmentDeliveryViews.Price;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;
import java.util.stream.Stream;

import static java.util.Map.entry;

/**
 * Regra pura do preço fictício em R$ (docs/garment-delivery §6.5): base da linha de produção × fator do tecido ×
 * fator de complexidade da ficha, arredondado para o real de cima menos R$ 0,10, mais o frete fictício da região do
 * CEP. A assinatura não recebe tamanho nem medidas do corpo: o preço nunca depende deles.
 */
final class GarmentPriceRules {
    private GarmentPriceRules() {
    }

    private static final Map<String, BigDecimal> BASE = Map.of(
            "CAM", new BigDecimal("89"), "CMS", new BigDecimal("149"), "MAL", new BigDecimal("179"),
            "ALF", new BigDecimal("279"), "CAL", new BigDecimal("169"), "CUR", new BigDecimal("129"), "VES", new BigDecimal("219"));

    private static final Map<String, BigDecimal> FABRIC = Map.ofEntries(
            entry("COTTON", new BigDecimal("1.00")), entry("DENIM", new BigDecimal("1.10")), entry("LINEN", new BigDecimal("1.25")),
            entry("WOOL", new BigDecimal("1.45")), entry("CASHMERE", new BigDecimal("2.10")), entry("SILK", new BigDecimal("1.60")),
            entry("SATIN", new BigDecimal("1.20")), entry("VISCOSE", new BigDecimal("1.05")), entry("POLYESTER", new BigDecimal("0.95")),
            entry("NYLON", new BigDecimal("1.00")), entry("ACRYLIC", new BigDecimal("0.95")), entry("FLEECE", new BigDecimal("1.05")),
            entry("KNIT", new BigDecimal("1.00")), entry("CORDUROY", new BigDecimal("1.15")), entry("VELVET", new BigDecimal("1.30")),
            entry("CANVAS", new BigDecimal("1.05")), entry("LEATHER", new BigDecimal("2.40")), entry("SUEDE", new BigDecimal("2.30")),
            entry("FAUX_LEATHER", new BigDecimal("1.35")));

    private static final BigDecimal DEFAULT_FABRIC = new BigDecimal("1.10");
    private static final Map<String, BigDecimal> COMPLEXITY = Map.of(
            "LOW", new BigDecimal("1.00"), "MEDIUM", new BigDecimal("1.12"), "HIGH", new BigDecimal("1.25"));

    /** Detalhes de construção preenchidos + 1 ponto a cada 4 medidas: até 2 baixa, 3 a 5 média, 6 ou mais alta. */
    static String complexity(Specification spec) {
        long details = Stream.of(spec.pockets(), spec.collar(), spec.sleeves(), spec.fastenings(), spec.finishes(), spec.printPlacement())
                .filter(value -> !GarmentText.blank(value)).count();
        int measures = spec.measurements() == null ? 0 : spec.measurements().size();
        long score = details + measures / 4;
        return score <= 2 ? "LOW" : score <= 5 ? "MEDIUM" : "HIGH";
    }

    /** {@code shipping} nulo = CEP ainda não informado: a prévia mostra o preço da peça sem total. */
    static Price price(String line, String materialCode, String complexity, BigDecimal shipping) {
        BigDecimal base = BASE.getOrDefault(line, BASE.get("CAM"));
        BigDecimal fabric = FABRIC.getOrDefault(materialCode, DEFAULT_FABRIC);
        BigDecimal factor = COMPLEXITY.getOrDefault(complexity, BigDecimal.ONE);
        BigDecimal raw = base.multiply(fabric).multiply(factor);
        BigDecimal garment = raw.setScale(0, RoundingMode.CEILING).subtract(new BigDecimal("0.10"));
        BigDecimal total = shipping == null ? null : garment.add(shipping);
        return new Price(base.setScale(2, RoundingMode.UNNECESSARY), fabric, complexity, factor, garment, shipping, total, "BRL");
    }
}
