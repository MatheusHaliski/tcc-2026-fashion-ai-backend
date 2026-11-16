package br.com.fashionai.application.garmentdelivery;

import br.com.fashionai.application.garmentdelivery.GarmentDeliveryViews.Composition;
import br.com.fashionai.application.garmentdelivery.GarmentDeliveryViews.CompositionLine;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static java.util.Map.entry;

/**
 * Regra pura da composição da peça (docs/garment-delivery §6.2): percentuais explícitos no tecido; senão os materiais
 * da BOM da revisão, proporcionais à quantidade; senão as fibras citadas no tecido; nada reconhecido → não especificada.
 */
final class GarmentCompositionRules {
    private GarmentCompositionRules() {
    }

    /** Item MATERIAL da BOM congelada: nome e consumo por unidade. */
    record BomMaterial(String name, BigDecimal quantity) {
    }

    static final String UNSPECIFIED = "UNSPECIFIED";
    private static final Pattern NUMBER_PERCENT = Pattern.compile("(\\d{1,3}(?:[.,]\\d+)?)\\s*%");
    /** "lã" sem acento vira "la", que em espanhol é artigo: a palavra com til é trocada por "wool" antes de normalizar. */
    private static final Pattern LA = Pattern.compile("(?iu)(^|[^\\p{L}])lã(?=[^\\p{L}]|$)");

    /** Ordem: as expressões mais específicas antes ("couro sintetico" antes de "couro"). */
    private static final List<Map.Entry<String, List<String>>> FIBERS = List.of(
            entry("FAUX_LEATHER", List.of("couro sintetico", "couro ecologico", "faux leather", "vegan leather", "cuero sintetico", "poliuretano")),
            entry("LEATHER", List.of("couro", "leather", "cuero", "camurca", "suede", "gamuza", "pelica")),
            entry("CASHMERE", List.of("cashmere", "caxemira", "cachemira")),
            entry("SILK", List.of("seda", "silk")),
            entry("WOOL", List.of("la fria", "merino", "wool", "lana", "tweed")),
            entry("LINEN", List.of("linho", "linen", "lino")),
            entry("COTTON", List.of("algodao", "cotton", "algodon", "jeans", "denim", "cotele", "corduroy", "lona", "canvas", "sarja")),
            entry("VISCOSE", List.of("viscose", "viscosa", "rayon", "modal", "liocel", "lyocell", "tencel")),
            entry("POLYAMIDE", List.of("poliamida", "nylon", "nailon", "polyamide")),
            entry("POLYESTER", List.of("poliester", "polyester", "microfibra")),
            entry("ACRYLIC", List.of("acrilico", "acrylic")),
            entry("ELASTANE", List.of("elastano", "elastane", "spandex", "lycra")));

    static String prepare(String text) {
        return GarmentText.normalize(text == null ? null : LA.matcher(text).replaceAll("$1wool"));
    }

    static Composition compose(String fabric, List<BomMaterial> bom) {
        String text = prepare(fabric);
        List<CompositionLine> explicit = explicitPercent(text);
        if (!explicit.isEmpty()) {
            return new Composition(explicit, "FABRIC_PERCENT");
        }
        Map<String, Double> weights = new LinkedHashMap<>();
        for (BomMaterial item : bom == null ? List.<BomMaterial>of() : bom) {
            List<String> fibers = fibers(prepare(item.name()));
            double quantity = item.quantity() == null ? 0 : item.quantity().doubleValue();
            for (String fiber : fibers) {
                weights.merge(fiber, quantity / fibers.size(), Double::sum);
            }
        }
        if (weights.values().stream().anyMatch(w -> w > 0)) {
            return new Composition(percentages(weights), "BOM");
        }
        List<String> named = fibers(text);
        if (named.isEmpty()) {
            return new Composition(List.of(new CompositionLine(UNSPECIFIED, 100)), UNSPECIFIED);
        }
        boolean stretch = named.contains("ELASTANE") && named.size() > 1;
        Map<String, Double> split = new LinkedHashMap<>();
        for (String fiber : named) {
            boolean elastane = "ELASTANE".equals(fiber) && stretch;
            split.put(fiber, elastane ? 3.0 : (stretch ? 97.0 : 100.0) / (named.size() - (stretch ? 1 : 0)));
        }
        return new Composition(percentages(split), "FABRIC");
    }

    /** Fibras citadas no texto normalizado, na ordem em que aparecem, sem repetir. */
    static List<String> fibers(String normalized) {
        Map<Integer, String> found = new TreeMap<>();
        for (Map.Entry<String, List<String>> fiber : FIBERS) {
            int at = GarmentText.firstIndex(normalized, fiber.getValue());
            boolean shadowed = "LEATHER".equals(fiber.getKey()) && found.containsValue("FAUX_LEATHER");
            if (at >= 0 && !shadowed) {
                found.putIfAbsent(at, fiber.getKey());
            }
        }
        return new ArrayList<>(found.values());
    }

    /**
     * "95% algodão, 5% elastano" (número antes da fibra) ou "algodão 95% e elastano 5%" (fibra antes): a convenção vem
     * do texto — fibra antes do primeiro número e nenhuma depois do último indica fibra antes.
     */
    private static List<CompositionLine> explicitPercent(String text) {
        Matcher m = NUMBER_PERCENT.matcher(text);
        List<Double> values = new ArrayList<>();
        List<String> segments = new ArrayList<>();
        int last = 0;
        while (m.find()) {
            segments.add(" " + text.substring(last, m.start()) + " ");
            values.add(Double.parseDouble(m.group(1).replace(',', '.')));
            last = m.end();
        }
        segments.add(" " + text.substring(last) + " ");
        if (values.isEmpty()) {
            return List.of();
        }
        boolean fiberFirst = !fibers(segments.getFirst()).isEmpty() && fibers(segments.getLast()).isEmpty();
        Map<String, Double> weights = new LinkedHashMap<>();
        for (int i = 0; i < values.size(); i++) {
            List<String> named = fibers(segments.get(fiberFirst ? i : i + 1));
            String fiber = named.isEmpty() ? UNSPECIFIED : fiberFirst ? named.getLast() : named.getFirst();
            weights.merge(fiber, values.get(i), Double::sum);
        }
        double total = weights.values().stream().mapToDouble(Double::doubleValue).sum();
        if (total <= 0 || total > 105) {
            return List.of();
        }
        if (total < 95) {
            weights.merge(UNSPECIFIED, 100 - total, Double::sum);
        }
        return percentages(weights);
    }

    /** Pesos → percentuais inteiros que somam 100 (maiores restos), do maior para o menor. */
    static List<CompositionLine> percentages(Map<String, Double> weights) {
        double total = weights.values().stream().mapToDouble(Double::doubleValue).sum();
        List<String> keys = new ArrayList<>(weights.keySet());
        int[] floors = new int[keys.size()];
        double[] rests = new double[keys.size()];
        int used = 0;
        for (int i = 0; i < keys.size(); i++) {
            double exact = weights.get(keys.get(i)) * 100 / total;
            floors[i] = (int) Math.floor(exact);
            rests[i] = exact - floors[i];
            used += floors[i];
        }
        for (int left = 100 - used; left > 0; left--) {
            int best = 0;
            for (int i = 1; i < keys.size(); i++) {
                if (rests[i] > rests[best]) {
                    best = i;
                }
            }
            floors[best]++;
            rests[best] = -1;
        }
        List<CompositionLine> out = new ArrayList<>();
        for (int i = 0; i < keys.size(); i++) {
            if (floors[i] > 0) {
                out.add(new CompositionLine(keys.get(i), floors[i]));
            }
        }
        out.sort((a, b) -> Integer.compare(b.percent(), a.percent()));
        return List.copyOf(out);
    }

    private static final List<Map.Entry<String, List<String>>> FABRIC_TYPES = List.of(
            entry("DENIM", List.of("jeans", "denim", "vaquero")),
            entry("SATIN", List.of("cetim", "satin", "saten", "charmeuse")),
            entry("CORDUROY", List.of("veludo cotele", "cotele", "corduroy", "pana")),
            entry("VELVET", List.of("veludo", "velvet", "terciopelo")),
            entry("FAUX_LEATHER", List.of("couro sintetico", "couro ecologico", "faux leather", "vegan leather", "cuero sintetico")),
            entry("SUEDE", List.of("camurca", "suede", "gamuza")),
            entry("LEATHER", List.of("couro", "leather", "cuero")),
            entry("FLEECE", List.of("moletom", "fleece", "felpa", "plush")),
            entry("KNIT", List.of("trico", "malha", "knit", "punto", "canelado", "ribana")),
            entry("CANVAS", List.of("lona", "canvas", "brim")));

    private static final Map<String, String> FIBER_MATERIAL = Map.ofEntries(
            entry("COTTON", "COTTON"), entry("LINEN", "LINEN"), entry("SILK", "SILK"), entry("WOOL", "WOOL"),
            entry("CASHMERE", "CASHMERE"), entry("VISCOSE", "VISCOSE"), entry("POLYESTER", "POLYESTER"),
            entry("POLYAMIDE", "NYLON"), entry("ACRYLIC", "ACRYLIC"), entry("LEATHER", "LEATHER"), entry("FAUX_LEATHER", "FAUX_LEATHER"));

    /** Código de material da peça: o tipo de tecido manda (jeans, cetim, veludo, couro, malha…); senão a fibra principal. */
    static String materialCode(String fabric, Composition composition) {
        String text = prepare(fabric);
        for (Map.Entry<String, List<String>> type : FABRIC_TYPES) {
            if (GarmentText.hasAny(text, type.getValue())) {
                return type.getKey();
            }
        }
        return composition.lines().isEmpty() ? "BLEND" : FIBER_MATERIAL.getOrDefault(composition.lines().getFirst().fiber(), "BLEND");
    }
}
