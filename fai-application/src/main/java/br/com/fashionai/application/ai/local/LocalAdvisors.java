package br.com.fashionai.application.ai.local;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.Brand;
import br.com.fashionai.domain.model.WardrobeItem;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Motores locais curtos: Style Advisor (#7), Insight Generator (#8), Brand Resolver (#9) e Edit Assistant (#12).
 */
public final class LocalAdvisors {
    private LocalAdvisors() {
    }

    // ---------------------------------------------------------------- #7 Style Advisor
    /** Dica acionável a partir da métrica mais fraca do breakdown L/C/S/R (curtidas, comentários, shares, remixes). */
    public static String styleTip(long likes, long comments, long shares, long remixes, double eNorm, double tNorm) {
        Map<String, Double> weighted = new LinkedHashMap<>();
        weighted.put("L", (double) likes);
        weighted.put("C", comments * 3.0);
        weighted.put("S", shares * 5.0);
        weighted.put("R", remixes * 8.0);
        String weakest = weighted.entrySet().stream().min(Map.Entry.comparingByValue()).map(Map.Entry::getKey).orElse("L");
        if (tNorm < 35) {
            return Msg.t("localAdvisors.seu_look_esta_fora_das");
        }
        return switch (weakest) {
            case "C" -> Msg.t("localAdvisors.poucas_conversas_no_look_publique");
            case "S" -> Msg.t("localAdvisors.o_look_ainda_nao_circulou");
            case "R" -> Msg.t("localAdvisors.ninguem_remixou_ainda_deixe_o");
            default -> eNorm < 40
                    ? Msg.t("localAdvisors.poucas_curtidas_publique_no_horario")
                    : Msg.t("localAdvisors.bom_engajamento_marque_o_look");
        };
    }

    // ---------------------------------------------------------------- #8 Insight Generator
    public static String insightText(Map<String, Object> rankings) {
        StringBuilder sb = new StringBuilder();
        Object countries = rankings.get("topCountries");
        Object brands = rankings.get("topBrands");
        Object colors = rankings.get("hypeByColor") instanceof List<?> l && !l.isEmpty() ? rankings.get("hypeByColor") : null;
        Object used = rankings.get("topColors");
        Object seasons = rankings.get("hypeBySeason");
        if (countries instanceof List<?> list && !list.isEmpty()) {
            sb.append(Msg.t("localAdvisors.o_pais_com_mais_atividade")).append(countryPt(label(list.get(0)))).append(". ");
        }
        if (brands instanceof List<?> list && !list.isEmpty()) {
            sb.append(Msg.t("localAdvisors.a_marca_mais_usada_nos")).append(label(list.get(0))).append(". ");
        }
        if (colors instanceof List<?> list) {
            sb.append(Msg.t("localAdvisors.a_cor_com_maior_hype")).append(colorPt(label(list.get(0)))).append(". ");
        } else if (used instanceof List<?> list && !list.isEmpty()) {
            sb.append(Msg.t("localAdvisors.a_cor_mais_presente_nas")).append(colorPt(label(list.get(0)))).append(". ");
        }
        if (seasons instanceof List<?> list && !list.isEmpty()) {
            sb.append(Msg.t("localAdvisors.entre_as_estacoes")).append(seasonPt(label(list.get(0)))).append(Msg.t("localAdvisors.lidera_o_hype_score_medio"));
        }
        return sb.length() == 0 ? Msg.t("localAdvisors.ainda_nao_ha_dados_suficientes") : sb.toString().trim();
    }

    private static String label(Object o) {
        if (o instanceof Map<?, ?> m) {
            Object k = m.containsKey("label") ? m.get("label") : m.get("key");
            return String.valueOf(k);
        }
        return String.valueOf(o);
    }

    private static final Map<String, String> COLOR_PT = Map.ofEntries(
            Map.entry("black", "preto"), Map.entry("charcoal", "grafite"), Map.entry("washed_black", "preto lavado"), Map.entry("white", "branco"),
            Map.entry("off_white", "off-white"), Map.entry("ivory", "marfim"), Map.entry("cream", "creme"), Map.entry("light_gray", "cinza-claro"),
            Map.entry("gray", "cinza"), Map.entry("dark_gray", "cinza-escuro"), Map.entry("silver", "prata"), Map.entry("blue", "azul"),
            Map.entry("navy", "azul-marinho"), Map.entry("light_blue", "azul-claro"), Map.entry("sky_blue", "azul-céu"), Map.entry("cobalt", "azul-cobalto"),
            Map.entry("denim", "jeans"), Map.entry("teal", Msg.k("localAdvisors.azul_petroleo")), Map.entry("red", "vermelho"), Map.entry("crimson", "carmim"),
            Map.entry("burgundy", "bordô"), Map.entry("maroon", "vinho"), Map.entry("rust", "ferrugem"), Map.entry("pink", "rosa"),
            Map.entry("hot_pink", "pink"), Map.entry("rose", Msg.k("localAdvisors.rose")), Map.entry("coral", "coral"), Map.entry("salmon", Msg.k("localAdvisors.salmao")),
            Map.entry("orange", "laranja"), Map.entry("terracotta", "terracota"), Map.entry("amber", "âmbar"), Map.entry("apricot", "damasco"),
            Map.entry("yellow", "amarelo"), Map.entry("mustard", "mostarda"), Map.entry("gold", "dourado"), Map.entry("butter", "manteiga"),
            Map.entry("green", "verde"), Map.entry("olive", "oliva"), Map.entry("military_green", "verde-militar"), Map.entry("forest_green", "verde-floresta"),
            Map.entry("mint", "menta"), Map.entry("sage", Msg.k("localAdvisors.salvia")), Map.entry("emerald", "esmeralda"), Map.entry("purple", "roxo"),
            Map.entry("violet", "violeta"), Map.entry("lilac", Msg.k("localAdvisors.lilas")), Map.entry("lavender", "lavanda"), Map.entry("plum", "ameixa"),
            Map.entry("brown", "marrom"), Map.entry("chocolate", "chocolate"), Map.entry("camel", "caramelo"), Map.entry("tan", "castanho"),
            Map.entry("beige", "bege"), Map.entry("taupe", "taupe"), Map.entry("metallic_gold", "dourado metálico"),
            Map.entry("metallic_silver", Msg.k("localAdvisors.prata_metalico")), Map.entry("bronze", "bronze"), Map.entry("multicolor", "multicolorido"), Map.entry("print", "estampado"));

    static String colorPt(String code) {
        return COLOR_PT.getOrDefault(code, code.replace('_', ' '));
    }

    static String seasonPt(String code) {
        return switch (code.toUpperCase(Locale.ROOT)) {
            case "SPRING", "PRIMAVERA" -> "a primavera";
            case "SUMMER", "VERAO" -> Msg.t("localAdvisors.o_verao");
            case "AUTUMN", "FALL", "OUTONO" -> "o outono";
            case "WINTER", "INVERNO" -> "o inverno";
            default -> code.toLowerCase(Locale.ROOT);
        };
    }

    static String countryPt(String iso) {
        if (iso == null || iso.length() != 2) {
            return String.valueOf(iso);
        }
        String name = new Locale("", iso.toUpperCase(Locale.ROOT)).getDisplayCountry(Locale.forLanguageTag("pt-BR"));
        return name == null || name.isBlank() ? iso : name;
    }

    // ---------------------------------------------------------------- #9 Brand Resolver
    public record BrandResolution(Brand match, double score, String normalized) {
    }

    public static BrandResolution resolveBrand(String text, Collection<Brand> brands) {
        String norm = normalize(text);
        Brand best = null;
        double bestScore = 0;
        for (Brand b : brands) {
            double s = Math.max(jaroWinkler(norm, normalize(b.getName())), jaroWinkler(norm, normalize(b.getSlug())));
            if (s > bestScore) {
                bestScore = s;
                best = b;
            }
        }
        return new BrandResolution(bestScore >= 0.92 ? best : null, bestScore, norm);
    }

    public static String normalize(String text) {
        return Normalizer.normalize(text == null ? "" : text, Normalizer.Form.NFKD).replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", " ").trim();
    }

    public static double jaroWinkler(String s1, String s2) {
        if (s1.equals(s2)) {
            return 1.0;
        }
        int len1 = s1.length();
        int len2 = s2.length();
        if (len1 == 0 || len2 == 0) {
            return 0;
        }
        int matchDistance = Math.max(0, Math.max(len1, len2) / 2 - 1);
        boolean[] m1 = new boolean[len1];
        boolean[] m2 = new boolean[len2];
        int matches = 0;
        for (int i = 0; i < len1; i++) {
            int start = Math.max(0, i - matchDistance);
            int end = Math.min(i + matchDistance + 1, len2);
            for (int j = start; j < end; j++) {
                if (m2[j] || s1.charAt(i) != s2.charAt(j)) {
                    continue;
                }
                m1[i] = true;
                m2[j] = true;
                matches++;
                break;
            }
        }
        if (matches == 0) {
            return 0;
        }
        double t = 0;
        int k = 0;
        for (int i = 0; i < len1; i++) {
            if (!m1[i]) {
                continue;
            }
            while (!m2[k]) {
                k++;
            }
            if (s1.charAt(i) != s2.charAt(k)) {
                t++;
            }
            k++;
        }
        t /= 2;
        double jaro = (matches / (double) len1 + matches / (double) len2 + (matches - t) / matches) / 3.0;
        int prefix = 0;
        for (int i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
            if (s1.charAt(i) == s2.charAt(i)) {
                prefix++;
            } else {
                break;
            }
        }
        return jaro + prefix * 0.1 * (1 - jaro);
    }

    // ---------------------------------------------------------------- #12 Edit Assistant
    public record FieldChange(String field, Object current, Object proposed, String reason) {
    }

    /**
     * Diff estruturado a partir de uma instrução em linguagem natural. Campos conhecidos: title, description,
     * occasion, style, season, mood, visibility, backgroundColor. Nunca aplica: só propõe (RF9 / RF30.CA10).
     */
    public static List<FieldChange> proposeEdit(Map<String, Object> current, String instruction) {
        String text = normalize(instruction);
        List<FieldChange> changes = new ArrayList<>();
        List<String> occ = new ArrayList<>(asList(current.get("occasion")));
        List<String> sty = new ArrayList<>(asList(current.get("style")));
        List<String[]> rules = List.of(
                new String[]{"formal|elegante|social|trabalho|escritorio|reuniao", "occasion", "work", "style", "tailored"},
                new String[]{"casual|relax|confort|dia a dia|everyday|comfort|comod|cotidian", "occasion", "casual", "style", "basic"},
                new String[]{"festa|balada|noite|party", "occasion", "party", "style", "glam"},
                new String[]{"academia|treino|gym|esporte", "occasion", "gym", "style", "athleisure"},
                new String[]{"viagem|viajar|travel", "occasion", "travel", "style", "utility"},
                new String[]{"praia|beach|resort", "occasion", "beach", "style", "resort"},
                new String[]{"ousad|statement|chamativ|marcante", "style", "statement", "style", "edgy"},
                new String[]{"minimal|clean|simples", "style", "minimalist", "style", "modern"},
                new String[]{"street|urbano|skate", "style", "streetwear", "style", "urban"},
                new String[]{"romantic|delicad|floral", "style", "romantic", "style", "boho"});
        for (String[] r : rules) {
            if (text.matches(".*(" + r[0] + ").*")) {
                addTag(r[1].equals("occasion") ? occ : sty, r[2], 3);
                addTag(r[3].equals("occasion") ? occ : sty, r[4], 3);
            }
        }
        if (!occ.equals(asList(current.get("occasion")))) {
            changes.add(new FieldChange("occasion", current.get("occasion"), occ, Msg.t("localAdvisors.ocasiao_ajustada_ao_pedido", instruction)));
        }
        if (!sty.equals(asList(current.get("style")))) {
            changes.add(new FieldChange("style", current.get("style"), sty, Msg.t("localAdvisors.estilo_sintetizado_a_partir_do")));
        }
        String season = text.matches(".*(verao|calor|summer).*") ? "SUMMER" : text.matches(".*(inverno|frio|winter).*") ? "WINTER"
                : text.matches(".*(outono|autumn|fall).*") ? "AUTUMN" : text.matches(".*(primavera|spring).*") ? "SPRING" : null;
        if (season != null && !season.equals(current.get("season"))) {
            changes.add(new FieldChange("season", current.get("season"), season, "Estação citada na instrução."));
        }
        if (text.matches(".*(public|todos verem|aberto).*") && !"PUBLIC".equals(current.get("visibility"))) {
            changes.add(new FieldChange("visibility", current.get("visibility"), "PUBLIC", Msg.t("localAdvisors.voce_pediu_para_tornar_visivel")));
        } else if (text.matches(".*(privad|so eu|esconder).*") && !"PRIVATE".equals(current.get("visibility"))) {
            changes.add(new FieldChange("visibility", current.get("visibility"), "PRIVATE", Msg.t("localAdvisors.voce_pediu_para_restringir_a")));
        }
        if (text.matches(".*(titulo|nome|renomear|title).*") || changes.stream().anyMatch(c -> c.field().equals("style"))) {
            String proposed = LocalSchemeComposer.title(sty, occ, season);
            if (!proposed.equals(current.get("title"))) {
                changes.add(new FieldChange("title", current.get("title"), proposed, Msg.t("localAdvisors.titulo_coerente_com_o_novo")));
            }
        }
        if (text.matches(".*(descri|legenda|caption).*")) {
            String proposed = "Look " + String.join(", ", sty) + " pensado para " + String.join(" e ", occ) + ".";
            changes.add(new FieldChange("description", current.get("description"), proposed, Msg.t("localAdvisors.descricao_gerada_a_partir_das")));
        }
        String mood = LocalSchemeComposer.mood(sty, occ);
        if (!changes.isEmpty() && !mood.equals(current.get("mood"))) {
            changes.add(new FieldChange("mood", current.get("mood"), mood, Msg.t("localAdvisors.humor_derivado_do_estilo_e")));
        }
        return changes;
    }

    private static void addTag(List<String> list, String tag, int max) {
        if (list.contains(tag)) {
            return;
        }
        list.add(0, tag);
        while (list.size() > max) {
            list.remove(list.size() - 1);
        }
    }

    @SuppressWarnings("unchecked")
    private static List<String> asList(Object o) {
        if (o instanceof List<?> l) {
            return (List<String>) l;
        }
        if (o instanceof String s) {
            return Json.csv(s);
        }
        return List.of();
    }

    // ---------------------------------------------------------------- #10 Copilot (lacunas do acervo)
    public record PieceSuggestion(String subcategory, String color, String reason) {
    }

    public static List<PieceSuggestion> wardrobeGaps(Collection<WardrobeItem> wardrobe, Double temperatureC) {
        List<PieceSuggestion> out = new ArrayList<>();
        java.util.Set<String> subs = new java.util.HashSet<>();
        java.util.Set<String> cats = new java.util.HashSet<>();
        long neutralsShoes = 0;
        for (WardrobeItem w : wardrobe) {
            subs.add(w.getSubcategory());
            cats.add(w.getCategory());
            if ("shoes_piece".equals(w.getCategory()) && ColorMath.isNeutral(w.getColor())) {
                neutralsShoes++;
            }
        }
        if (!cats.contains("shoes_piece") || neutralsShoes == 0) {
            out.add(new PieceSuggestion("casual_sneakers", "white", Msg.t("localAdvisors.um_tenis_branco_fecha_a")));
        }
        if (temperatureC != null && temperatureC < 18 && subs.stream().noneMatch(s -> java.util.Set.of("coat", "jacket", "parka", "blazer").contains(s))) {
            out.add(new PieceSuggestion("jacket", "navy", Msg.t("localAdvisors.esta_frio_e_voce_nao")));
        }
        if (!subs.contains("jeans")) {
            out.add(new PieceSuggestion("jeans", "denim", Msg.t("localAdvisors.jeans_denim_e_a_base")));
        }
        if (!cats.contains("accessory_piece")) {
            out.add(new PieceSuggestion("belt", "brown", Msg.t("localAdvisors.um_cinto_marrom_da_acabamento")));
        }
        return out.stream().limit(4).toList();
    }

    public static Optional<String> weatherNote(Double temperatureC, String description) {
        if (temperatureC == null) {
            return Optional.empty();
        }
        String feel = temperatureC >= 27 ? "calor" : temperatureC >= 20 ? "clima ameno" : temperatureC >= 13 ? "friozinho" : "frio";
        return Optional.of(String.format(Locale.ROOT, "%.0f°C e %s (%s)", temperatureC, description == null ? "tempo estável" : description, feel));
    }
}
