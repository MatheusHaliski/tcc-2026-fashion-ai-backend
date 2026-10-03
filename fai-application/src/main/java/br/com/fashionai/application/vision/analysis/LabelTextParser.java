package br.com.fashionai.application.vision.analysis;

import br.com.fashionai.application.vision.ModelRef;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * RF4 · Interpreta o texto lido (OCR ou IA) em etiquetas, línguas de tênis, versos de relógio e hastes de óculos:
 * composição ("100% algodão" → COTTON), tamanho, país de fabricação e códigos (estilo Nike {@code AB1234-001},
 * referência Tissot {@code T137.407.11.041.00}, medidas de óculos {@code 52□18 145}, artigo/referência genéricos).
 * Números de série são reconhecidos para não confundir com códigos de modelo, mas nunca saem da análise do dono.
 */
public final class LabelTextParser {
    public static final ModelRef MODEL = ModelRef.LABEL_PARSER;

    /** Fibra → material da taxonomia (null = fibra sem material próprio na taxonomia, ex.: linho). */
    private static final Map<String, String> FIBERS = new LinkedHashMap<>();

    static {
        for (String f : List.of("algodao", "cotton", "algodon", "coton")) FIBERS.put(f, "COTTON");
        for (String f : List.of("poliester", "polyester", "polyster")) FIBERS.put(f, "POLYESTER");
        for (String f : List.of("la", "wool", "lana", "laine", "merino", "cashmere", "caxemira")) FIBERS.put(f, "WOOL");
        for (String f : List.of("seda", "silk", "soie")) FIBERS.put(f, "SILK");
        for (String f : List.of("couro", "leather", "cuero", "piel", "cuir")) FIBERS.put(f, "LEATHER");
        for (String f : List.of("elastano", "elastane", "spandex", "lycra", "viscose", "rayon", "viscosa", "nylon",
                "poliamida", "polyamide", "acrilico", "acrylic", "modal", "lyocell", "elastodieno")) FIBERS.put(f, "SYNTHETIC");
        for (String f : List.of("linho", "linen", "lino", "lin", "canhamo", "hemp")) FIBERS.put(f, null);
    }

    private static final Pattern PCT_FIRST = Pattern.compile("(\\d{1,3})\\s?%\\s*([a-z]+)");
    private static final Pattern FIBER_FIRST = Pattern.compile("([a-z]+)\\s*(\\d{1,3})\\s?%");
    private static final Pattern SIZE = Pattern.compile("\\b(?:tam(?:anho)?|size|talla|taille)\\s*[:.]?\\s*([a-z0-9]{1,4})\\b");
    private static final Pattern COUNTRY = Pattern.compile("\\b(?:made in|fabricado (?:em|no|na)|hecho en|fabrique en|feito (?:em|no|na))\\s+([a-z ]{3,24})");
    private static final Pattern NIKE_STYLE = Pattern.compile("\\b([A-Z]{2}\\d{4}-\\d{3})\\b");
    private static final Pattern TISSOT_REF = Pattern.compile("\\b(T\\d{3}\\.\\d{3}\\.\\d{2}\\.\\d{3}\\.\\d{2})\\b");
    private static final Pattern EYEWEAR_SIZE = Pattern.compile("\\b(\\d{2})\\s?[□\\[\\]xX\\-]\\s?(\\d{2})\\s+(1[2-5]\\d)\\b");
    private static final Pattern EYEWEAR_MODEL = Pattern.compile("\\b([A-Z]{2,3}\\s?\\d{4})\\b");
    private static final Pattern ARTICLE = Pattern.compile("\\b(?:ART(?:ICLE)?|REF|STYLE|MODEL|MOD|SKU)\\.?\\s*(?:NO\\.?|N[ºO°]\\.?|#)?\\s*[:.]?\\s*([A-Z0-9][A-Z0-9.\\-]{3,18})");
    private static final Pattern SERIAL = Pattern.compile("\\b(?:SERIAL|S/N|SN|N[ºO°]\\s?DE\\s?S[EÉ]RIE)\\s*[:.#]?\\s*([A-Z0-9]{5,})");
    private static final Pattern HALLMARK = Pattern.compile("\\b(925|750|585|375|18K|14K|9K|PT950)\\b");

    public record Composition(String fiber, int percent, String material) {
    }

    public record Parsed(List<Composition> composition, String material, double materialConfidence, String size,
                         String country, List<String> codes, String eyewearSize, boolean serialPresent, String hallmark) {
        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("composition", composition.stream().map(c -> {
                Map<String, Object> x = new LinkedHashMap<>();
                x.put("fiber", c.fiber());
                x.put("percent", c.percent());
                x.put("material", c.material());
                return x;
            }).toList());
            m.put("material", material);
            m.put("materialConfidence", materialConfidence);
            m.put("size", size);
            m.put("country", country);
            m.put("codes", codes);
            m.put("eyewearSize", eyewearSize);
            m.put("serialPresent", serialPresent);
            m.put("hallmark", hallmark);
            m.put("model", MODEL.key());
            return m;
        }
    }

    public Parsed parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return new Parsed(List.of(), null, 0, null, null, List.of(), null, false, null);
        }
        String upper = raw.toUpperCase(Locale.ROOT);
        String folded = Normalizer.normalize(raw, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT);
        // "60% algodão 40% poliéster" × "algodão 98% elastano 2%": vale a leitura com mais fibras reconhecidas
        List<Composition> pctFirst = new ArrayList<>(), fiberFirst = new ArrayList<>();
        collect(PCT_FIRST.matcher(folded), 2, 1, pctFirst);
        collect(FIBER_FIRST.matcher(folded), 1, 2, fiberFirst);
        List<Composition> comp = fiberFirst.size() > pctFirst.size() ? fiberFirst : pctFirst;
        String material = null;
        double materialConf = 0;
        if (!comp.isEmpty()) {
            Composition main = comp.stream().max((a, b) -> Integer.compare(a.percent(), b.percent())).get();
            long significant = comp.stream().filter(c -> c.percent() >= 20).count();
            if (main.percent() >= 80 && main.material() != null) {
                material = main.material();
                materialConf = 0.95;
            } else if (significant >= 2) {
                material = "BLEND";
                materialConf = 0.85;
            } else if (main.material() != null) {
                material = main.material();
                materialConf = 0.7;
            }
        }
        String size = group(SIZE.matcher(folded), 1);
        String country = group(COUNTRY.matcher(folded), 1);
        List<String> codes = new ArrayList<>();
        for (Pattern p : List.of(NIKE_STYLE, TISSOT_REF, ARTICLE)) {
            Matcher m = p.matcher(upper);
            while (m.find()) {
                String code = m.group(1);
                if (!codes.contains(code) && code.chars().anyMatch(Character::isDigit)) {
                    codes.add(code);
                }
            }
        }
        Matcher ey = EYEWEAR_SIZE.matcher(upper);
        String eyewear = ey.find() ? ey.group(1) + "□" + ey.group(2) + " " + ey.group(3) : null;
        if (eyewear != null) {
            Matcher em = EYEWEAR_MODEL.matcher(upper);
            if (em.find() && !codes.contains(em.group(1))) {
                codes.add(em.group(1));
            }
        }
        Matcher serial = SERIAL.matcher(upper);
        boolean serialPresent = serial.find();
        if (serialPresent) {
            codes.remove(serial.group(1));
        }
        // contraste de metal (925, 18K…): evidência de material da joia; metal não está na taxonomia de materiais
        String hallmark = group(HALLMARK.matcher(upper), 1);
        return new Parsed(comp, material, materialConf, size == null ? null : size.toUpperCase(Locale.ROOT),
                country == null ? null : country.trim(), codes, eyewear, serialPresent, hallmark);
    }

    private static void collect(Matcher m, int fiberGroup, int pctGroup, List<Composition> out) {
        while (m.find()) {
            String fiber = m.group(fiberGroup);
            if (!FIBERS.containsKey(fiber)) {
                continue;
            }
            int pct = Integer.parseInt(m.group(pctGroup));
            if (pct <= 0 || pct > 100) {
                continue;
            }
            out.add(new Composition(fiber, pct, FIBERS.get(fiber)));
        }
    }

    private static String group(Matcher m, int g) {
        return m.find() ? m.group(g) : null;
    }
}
