package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.local.LocalAdvisors;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.SealTier;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * RF25 — política padronizada do selo: regras que o sistema avalia sozinho nos criadores de peça (RF4) e de look
 * (RF5), no lugar de um texto livre separado por vírgulas.
 *
 * <pre>
 * { "match": "ALL" | "ANY",
 *   "rules": [ { "quantifier": "AT_LEAST", "count": 3, "color": "Azul", "brand": "Zara", "category": null, "subcategory": null },
 *              { "quantifier": "ALL",      "color": "Amarelo", "brand": "Adidas" },
 *              { "quantifier": "NONE",     "color": "Preto" } ],
 *   "occasions": ["party"], "styles": ["streetwear"] }
 * </pre>
 *
 * Cada regra filtra peças por cor (família da taxonomia, como "Azul", ou a cor exata, como "navy"), marca, categoria e
 * subcategoria; o quantificador diz quantas peças do look precisam passar no filtro: no mínimo N, todas ou nenhuma. No
 * selo de PEÇA a peça precisa passar em cada filtro (NONE: não pode passar). Ocasiões e estilos do selo são tags: com
 * os dois lados preenchidos, o look/peça precisa ter ao menos uma em comum.
 */
public final class SealPolicies {
    public static final List<String> QUANTIFIERS = List.of("AT_LEAST", "ALL", "NONE");
    public static final int MAX_RULES = 6;
    public static final int MAX_TAGS = 4;

    private SealPolicies() {
    }

    public record Rule(String quantifier, int count, String color, String brand, String category, String subcategory) {
    }

    public record Policy(boolean any, List<Rule> rules, List<String> occasions, List<String> styles) {
        public boolean isEmpty() {
            return rules.isEmpty() && occasions.isEmpty() && styles.isEmpty();
        }
    }

    /** Resultado da avaliação: atende? quais peças sustentam o selo e por quê (texto da regra que bateu). */
    public record Verdict(boolean matched, List<UUID> pieceIds, String why) {
    }

    // ------------------------------------------------------------------ validação

    /** Valida o JSON vindo da tela; devolve null quando não há política (selo sem regras). Erros viram 400 legíveis. */
    public static Map<String, Object> normalize(Map<String, Object> raw) {
        if (raw == null) {
            return null;
        }
        List<Map<String, Object>> rules = new ArrayList<>();
        Object rs = raw.get("rules");
        if (rs instanceof Collection<?> c) {
            for (Object o : c) {
                if (!(o instanceof Map<?, ?> m)) {
                    continue;
                }
                String q = upper(m.get("quantifier"), "AT_LEAST");
                if (!QUANTIFIERS.contains(q)) {
                    throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealPolicy.quantificador_invalido", q));
                }
                int count = 1;
                if (m.get("count") instanceof Number n) {
                    count = n.intValue();
                } else if (m.get("count") != null && !String.valueOf(m.get("count")).isBlank()) {
                    try {
                        count = Integer.parseInt(String.valueOf(m.get("count")).trim());
                    } catch (NumberFormatException e) {
                        throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealPolicy.quantidade_invalida"));
                    }
                }
                if ("AT_LEAST".equals(q) && (count < 1 || count > 4)) {
                    throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealPolicy.quantidade_invalida"));
                }
                String color = text(m.get("color"));
                if (color != null && !Taxonomy.COLORS.containsKey(color.toLowerCase(Locale.ROOT)) && !families().contains(color)) {
                    throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealPolicy.cor_fora_da_taxonomia", color));
                }
                String category = text(m.get("category"));
                if (category != null && !Taxonomy.SUBCATEGORIES.containsKey(category)) {
                    throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealPolicy.categoria_invalida", category));
                }
                String sub = text(m.get("subcategory"));
                if (sub != null && !Taxonomy.isSubcategory(sub)) {                        // ativa ou LEGACY
                    throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealPolicy.categoria_invalida", sub));
                }
                String brand = text(m.get("brand"));
                if (brand != null && brand.length() > 80) {
                    brand = brand.substring(0, 80);
                }
                if (color == null && brand == null && category == null && sub == null) {
                    continue;                                   // regra sem filtro nenhum não diz nada
                }
                Map<String, Object> r = new LinkedHashMap<>();
                r.put("quantifier", q);
                r.put("count", "AT_LEAST".equals(q) ? count : null);
                r.put("color", color == null ? null : (Taxonomy.COLORS.containsKey(color.toLowerCase(Locale.ROOT)) ? color.toLowerCase(Locale.ROOT) : color));
                r.put("brand", brand);
                r.put("category", category);
                r.put("subcategory", sub);
                rules.add(r);
            }
        }
        if (rules.size() > MAX_RULES) {
            throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealPolicy.regras_demais", MAX_RULES));
        }
        List<String> occasions = tags(raw.get("occasions"), Taxonomy.OCCASIONS);
        List<String> styles = tags(raw.get("styles"), Taxonomy.STYLES);
        if (rules.isEmpty() && occasions.isEmpty() && styles.isEmpty()) {
            return null;
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("match", "ANY".equals(upper(raw.get("match"), "ALL")) ? "ANY" : "ALL");
        out.put("rules", rules);
        out.put("occasions", occasions);
        out.put("styles", styles);
        return out;
    }

    public static Policy parse(Object stored) {
        if (!(stored instanceof Map<?, ?> m)) {
            return null;
        }
        List<Rule> rules = new ArrayList<>();
        if (m.get("rules") instanceof Collection<?> c) {
            for (Object o : c) {
                if (o instanceof Map<?, ?> r) {
                    int count = r.get("count") instanceof Number n ? n.intValue() : 1;
                    rules.add(new Rule(upper(r.get("quantifier"), "AT_LEAST"), Math.max(1, count), text(r.get("color")),
                            text(r.get("brand")), text(r.get("category")), text(r.get("subcategory"))));
                }
            }
        }
        Policy p = new Policy("ANY".equals(upper(m.get("match"), "ALL")), rules, strings(m.get("occasions")), strings(m.get("styles")));
        return p.isEmpty() ? null : p;
    }

    // ------------------------------------------------------------------ avaliação

    /**
     * Avalia a política contra as peças de um look (tier LOOK) ou contra uma única peça (tier PECA). Ocasiões/estilos
     * vazios de um dos lados não bloqueiam.
     */
    public static Verdict evaluate(Policy p, SealTier tier, List<WardrobeItem> pieces, Collection<String> occasions, Collection<String> styles) {
        if (p == null || pieces.isEmpty()) {
            return new Verdict(false, List.of(), null);
        }
        if (!overlaps(p.occasions(), occasions) || !overlaps(p.styles(), styles)) {
            return new Verdict(false, List.of(), null);
        }
        if (p.rules().isEmpty()) {
            return new Verdict(true, pieces.stream().map(WardrobeItem::getId).toList(), describeTags(p));
        }
        Set<UUID> support = new LinkedHashSet<>();
        List<String> hits = new ArrayList<>();
        int ok = 0;
        for (Rule r : p.rules()) {
            List<WardrobeItem> pass = pieces.stream().filter(w -> passes(r, w)).toList();
            boolean holds;
            if (tier == SealTier.PECA) {
                holds = "NONE".equals(r.quantifier()) ? pass.isEmpty() : pass.size() == pieces.size();
            } else {
                holds = switch (r.quantifier()) {
                    case "ALL" -> pass.size() == pieces.size();
                    case "NONE" -> pass.isEmpty();
                    default -> pass.size() >= r.count();
                };
            }
            if (holds) {
                ok++;
                pass.forEach(w -> support.add(w.getId()));
                hits.add(describe(r, tier));
            }
        }
        boolean matched = p.any() ? ok > 0 : ok == p.rules().size();
        if (!matched) {
            return new Verdict(false, List.of(), null);
        }
        List<UUID> ids = support.isEmpty() ? pieces.stream().map(WardrobeItem::getId).toList() : List.copyOf(support);
        return new Verdict(true, ids, String.join("; ", hits));
    }

    static boolean passes(Rule r, WardrobeItem w) {
        if (r.color() != null && !colorMatches(r.color(), w.getColor())) {
            return false;
        }
        if (r.category() != null && !r.category().equalsIgnoreCase(String.valueOf(w.getCategory()))) {
            return false;
        }
        if (r.subcategory() != null && !r.subcategory().equalsIgnoreCase(String.valueOf(w.getSubcategory()))) {
            return false;
        }
        if (r.brand() != null) {
            String brand = w.getBrandName() != null ? w.getBrandName()
                    : w.getBrand() != null ? w.getBrand().getName()
                    : w.getBrandProfile() != null ? w.getBrandProfile().getBrandName() : null;
            if (brand == null || LocalAdvisors.jaroWinkler(LocalAdvisors.normalize(r.brand()), LocalAdvisors.normalize(brand)) < 0.92) {
                return false;
            }
        }
        return true;
    }

    /** "Azul" casa com navy/denim/cobalt…; "navy" só com navy. */
    static boolean colorMatches(String wanted, String color) {
        if (color == null) {
            return false;
        }
        String c = color.toLowerCase(Locale.ROOT).trim();
        if (wanted.equalsIgnoreCase(c)) {
            return true;
        }
        String family = Taxonomy.COLOR_FAMILY.get(c);
        return family != null && family.equalsIgnoreCase(wanted);
    }

    // ------------------------------------------------------------------ texto (cards, e-mails, explicação da sugestão)

    /** Frase da política inteira: o que o card do selo mostra no lugar do antigo texto livre. */
    public static String describe(Policy p, SealTier tier) {
        if (p == null) {
            return null;
        }
        List<String> parts = new ArrayList<>();
        for (Rule r : p.rules()) {
            parts.add(describe(r, tier));
        }
        String rules = String.join(p.any() ? Msg.t("sealPolicy.ou") : Msg.t("sealPolicy.e"), parts);
        String tags = describeTags(p);
        return rules.isEmpty() ? tags : tags == null ? rules : rules + " · " + tags;
    }

    static String describe(Rule r, SealTier tier) {
        String what = pieceWords(r);
        if (tier == SealTier.PECA) {
            return "NONE".equals(r.quantifier()) ? Msg.t("sealPolicy.peca_que_nao_seja", what) : Msg.t("sealPolicy.peca", what);
        }
        return switch (r.quantifier()) {
            case "ALL" -> Msg.t("sealPolicy.todas_as_pecas", what);
            case "NONE" -> Msg.t("sealPolicy.nenhuma_peca", what);
            default -> r.count() == 1 ? Msg.t("sealPolicy.ao_menos_uma_peca", what) : Msg.t("sealPolicy.no_minimo_pecas", r.count(), what);
        };
    }

    private static String pieceWords(Rule r) {
        List<String> w = new ArrayList<>();
        if (r.subcategory() != null) {
            w.add(Msg.t("taxonomy." + r.subcategory()));
        } else if (r.category() != null) {
            w.add(Msg.t("taxonomy." + r.category()));
        }
        if (r.color() != null) {
            String c = Taxonomy.COLORS.containsKey(r.color()) ? Msg.t("taxonomy." + r.color()) : Msg.t("sealPolicy.familia." + r.color().toLowerCase(Locale.ROOT));
            w.add(Msg.t("sealPolicy.cor", c.toLowerCase(Locale.ROOT)));
        }
        if (r.brand() != null) {
            w.add(Msg.t("sealPolicy.da_marca", r.brand()));
        }
        return String.join(" ", w).trim();
    }

    private static String describeTags(Policy p) {
        List<String> t = new ArrayList<>();
        if (!p.occasions().isEmpty()) {
            t.add(Msg.t("sealPolicy.ocasioes", String.join(", ", p.occasions().stream().map(o -> Msg.t("taxonomy." + o)).toList())));
        }
        if (!p.styles().isEmpty()) {
            t.add(Msg.t("sealPolicy.estilos", String.join(", ", p.styles().stream().map(o -> Msg.t("taxonomy." + o)).toList())));
        }
        return t.isEmpty() ? null : String.join(" · ", t);
    }

    // ------------------------------------------------------------------ utilitários

    private static boolean overlaps(List<String> wanted, Collection<String> have) {
        if (wanted.isEmpty() || have == null || have.isEmpty()) {
            return true;
        }
        for (String h : have) {
            if (wanted.contains(h.toLowerCase(Locale.ROOT).trim())) {
                return true;
            }
        }
        return false;
    }

    private static Set<String> families() {
        return new LinkedHashSet<>(Taxonomy.COLOR_FAMILY.values());
    }

    private static List<String> tags(Object o, List<String> allowed) {
        List<String> out = new ArrayList<>();
        for (String s : strings(o)) {
            String k = s.toLowerCase(Locale.ROOT).trim();
            if (!allowed.contains(k)) {
                throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealPolicy.tag_fora_da_taxonomia", s));
            }
            if (!out.contains(k)) {
                out.add(k);
            }
        }
        if (out.size() > MAX_TAGS) {
            throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealPolicy.tags_demais", MAX_TAGS));
        }
        return out;
    }

    private static List<String> strings(Object o) {
        List<String> out = new ArrayList<>();
        if (o instanceof Collection<?> c) {
            for (Object x : c) {
                if (x != null && !String.valueOf(x).isBlank()) {
                    out.add(String.valueOf(x).trim());
                }
            }
        }
        return out;
    }

    private static String text(Object o) {
        if (o == null) {
            return null;
        }
        String s = String.valueOf(o).trim();
        return s.isEmpty() || "null".equals(s) ? null : s;
    }

    private static String upper(Object o, String dflt) {
        String s = text(o);
        return s == null ? dflt : s.toUpperCase(Locale.ROOT);
    }
}
