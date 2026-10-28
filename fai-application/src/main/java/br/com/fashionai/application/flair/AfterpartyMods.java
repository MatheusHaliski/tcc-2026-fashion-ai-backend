package br.com.fashionai.application.flair;

import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * MET Gala Heist (FLAIR Metamorfose — Afterparty): as cartas do deck da partida mudam o avatar e o salão. Regras
 * determinísticas sobre o que cada carta já tem (atributos FLAIR, estilos, ocasiões, cor, subcategoria, material e
 * raridade); valem só dentro da partida e nunca mexem na peça, no Hype ou nos FAI Points.
 *
 * <ul>
 *   <li>Agilidade: tênis e estilos esportivos aceleram; salto, vestido longo e bota pesam. Velocidade ×0,85–1,25.</li>
 *   <li>Furtividade: cores escuras e estilos discretos passam despercebidos; statement e brilho chamam atenção.
 *   Suspeita ×1,3–0,7.</li>
 *   <li>Carisma: marca, foto, estilo e ocasião de festa. Distração ×0,8–1,5 e disfarce mais convincente.</li>
 *   <li>Fôlego: peça da estação e material confortável. Energia ×0,7–1,5.</li>
 *   <li>Luz do salão: deck escuro deixa o salão na penumbra (os seguranças enxergam menos); deck claro e statement
 *   acende os holofotes (enxergam mais).</li>
 *   <li>Multidão: ocasiões variadas trazem convidados; perto deles a suspeita cai mais rápido.</li>
 *   <li>Rota VIP: três ou mais peças de alta-cultura LIMITED/RARE abrem o cordão VIP nos primeiros 8 segundos.</li>
 * </ul>
 */
public final class AfterpartyMods {
    private AfterpartyMods() {
    }

    public record Mods(int agility, int stealth, int charm, int stamina, double speedMul, double suspicionMul,
                       double distractMul, double regenMul, String light, double zoneMul, double crowd, int guests,
                       long vipRouteMs) {
    }

    /** Sem cartas (ou partida salva antes desta regra): tudo neutro, o jogo de antes. */
    public static final Mods NEUTRAL = new Mods(50, 50, 50, 50, 1, 1, 1, 1, "SALAO", 1, 0, 2, 0);
    public static final long VIP_ROUTE_MS = 8000;

    static final Set<String> SNEAKERS = Set.of("sneakers", "casual_sneakers", "running_shoes", "training_shoes", "high_top_sneakers",
            "skate_shoes", "basketball_shoes", "slip_on_sneakers");
    static final Set<String> SPORT = Set.of("sporty", "athleisure", "techwear", "utility");
    static final Set<String> DISCREET = Set.of("minimalist", "basic", "classic");
    static final Set<String> LOUD = Set.of("statement", "glam", "avant_garde", "y2k", "futuristic");
    static final Set<String> CHARMING = Set.of("glam", "luxury", "chic", "tailored", "romantic");
    static final Set<String> PARTY = Set.of("party", "formal", "wedding", "ceremony", "night_out", "date");
    static final Set<String> HIGH_CULTURE_STYLES = Set.of("luxury", "glam", "tailored", "chic", "classic", "avant_garde");
    static final Set<String> HIGH_CULTURE_OCCASIONS = Set.of("formal", "wedding", "ceremony");
    static final Set<String> COMFORT = Set.of("COTTON", "KNIT", "LINEN", "JERSEY", "FLEECE", "MODAL", "VISCOSE");
    static final Set<String> STIFF = Set.of("LEATHER", "SEQUIN", "PVC", "LATEX", "VINYL");

    public static Mods of(List<FlairEngine.Card> cards) {
        if (cards == null || cards.isEmpty()) {
            return NEUTRAL;
        }
        double agility = 0, stealth = 0, charm = 0, stamina = 0, lum = 0, edge = 0, range = 0;
        int highCulture = 0;
        for (FlairEngine.Card c : cards) {
            Set<String> styles = lower(c.styles()), occasions = lower(c.occasions());
            String sub = c.subcategory() == null ? "" : c.subcategory().toLowerCase(Locale.ROOT);
            double l = luminance(c.colorHex());
            double a = 50;
            if (SNEAKERS.contains(sub)) a += 40;
            if (styles.stream().anyMatch(SPORT::contains)) a += 20;
            if (sub.contains("heel") || sub.contains("pump") || sub.contains("stiletto")) a -= 40;
            if (sub.contains("maxi") || sub.contains("gown")) a -= 20;
            if (sub.contains("boot")) a -= 10;
            agility += clamp(a);
            double st = 50 + (0.5 - l) * 80;
            if (styles.stream().anyMatch(DISCREET::contains)) st += 15;
            if (styles.stream().anyMatch(LOUD::contains)) st -= 20;
            stealth += clamp(st);
            double ch = 0.4 * stat(c, "CLOUT") + 0.3 * stat(c, "GLOW") + 0.3 * stat(c, "EDGE");
            if (styles.stream().anyMatch(CHARMING::contains)) ch += 15;
            if (occasions.stream().anyMatch(PARTY::contains)) ch += 10;
            charm += clamp(ch);
            String mat = c.material() == null ? "" : c.material().toUpperCase(Locale.ROOT);
            stamina += clamp(0.6 * stat(c, "SYNC") + 0.4 * (COMFORT.contains(mat) ? 80 : STIFF.contains(mat) ? 30 : 55));
            lum += l;
            edge += stat(c, "EDGE");
            range += stat(c, "RANGE");
            boolean culture = styles.stream().anyMatch(HIGH_CULTURE_STYLES::contains) || occasions.stream().anyMatch(HIGH_CULTURE_OCCASIONS::contains);
            if (culture && ("LIMITED".equals(c.rarity()) || "RARE".equals(c.rarity()))) highCulture++;
        }
        int n = cards.size();
        int ag = (int) Math.round(agility / n), stl = (int) Math.round(stealth / n), chm = (int) Math.round(charm / n), sta = (int) Math.round(stamina / n);
        double avgLum = lum / n, avgEdge = edge / n, avgRange = range / n;
        String light = avgLum < 0.35 ? "PENUMBRA" : avgLum > 0.65 && avgEdge > 60 ? "HOLOFOTES" : "SALAO";
        double zone = "PENUMBRA".equals(light) ? 0.82 : "HOLOFOTES".equals(light) ? 1.15 : 1;
        double crowd = Math.max(0, Math.min(1, (avgRange - 40) / 60));
        return new Mods(ag, stl, chm, sta,
                round(0.85 + 0.4 * ag / 100.0), round(1.3 - 0.6 * stl / 100.0), round(0.8 + 0.7 * chm / 100.0), round(0.7 + 0.8 * sta / 100.0),
                light, zone, round(crowd), 2 + (int) Math.round(crowd * 6), highCulture >= 3 ? VIP_ROUTE_MS : 0);
    }

    private static Set<String> lower(List<String> xs) {
        return xs == null ? Set.of() : Set.copyOf(xs.stream().filter(java.util.Objects::nonNull).map(x -> x.toLowerCase(Locale.ROOT)).toList());
    }

    private static int stat(FlairEngine.Card c, String key) {
        Integer v = c.stats() == null ? null : c.stats().get(key);
        return v == null ? 50 : v;
    }

    /** Luminância relativa aproximada (0 = preto, 1 = branco); sem cor, meio-termo. */
    static double luminance(String hex) {
        if (hex == null || !hex.matches("#[0-9A-Fa-f]{6}")) {
            return 0.5;
        }
        int r = Integer.parseInt(hex.substring(1, 3), 16), g = Integer.parseInt(hex.substring(3, 5), 16), b = Integer.parseInt(hex.substring(5, 7), 16);
        return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0;
    }

    private static double clamp(double v) {
        return Math.max(0, Math.min(100, v));
    }

    private static double round(double v) {
        return Math.round(v * 100) / 100.0;
    }
}
