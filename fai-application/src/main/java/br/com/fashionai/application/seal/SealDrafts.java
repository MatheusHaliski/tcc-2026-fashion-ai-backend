package br.com.fashionai.application.seal;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.SealTier;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;

/**
 * RF25 — modo "Com IA" do criador de selo: a partir do perfil emissor e das peças que ele cadastrou, sugere os dados
 * (nome, nível, política padronizada com tags) e a arte (tipo e modelo) do selo. É a IA local do FashionAI (estatística
 * do próprio catálogo, sem provedor externo): o emissor revisa tudo antes de salvar.
 *
 * <ul>
 *   <li>cor: a família de cor mais frequente nas peças vira regra da política e escolhe o anel circular de cor mais
 *   próxima (marca) — celebridade recebe a folha holográfica, o acabamento Premium (RF21.CA20);</li>
 *   <li>ocasião e estilo: as duas tags mais frequentes das peças (da taxonomia);</li>
 *   <li>marca: a regra exige peça da própria marca; o elemento central leva as iniciais.</li>
 * </ul>
 */
public final class SealDrafts {
    private static final int MAX_TAGS = 2;

    private SealDrafts() {
    }

    /** Sugestão completa: {name, tier, policy, design, reasons}. */
    public static Map<String, Object> suggest(String issuerName, boolean celebrity, SealTier tier, List<WardrobeItem> pieces) {
        SealTier t = tier == null ? SealTier.LOOK : tier;
        String issuer = issuerName == null || issuerName.isBlank() ? "FashionAI" : issuerName.trim();
        List<String> reasons = new ArrayList<>();

        String color = top(pieces, w -> Taxonomy.COLORS.containsKey(w.getColor()) ? w.getColor() : null);
        String fam = color == null ? null : Taxonomy.COLOR_FAMILY.get(color);
        String family = "Especiais".equals(fam) ? null : fam;          // multicolor/estampa não vira regra de cor
        List<String> occasions = topTags(pieces, WardrobeItem::getOccasionTags, Taxonomy.OCCASIONS);
        List<String> styles = topTags(pieces, WardrobeItem::getStyleTags, Taxonomy.STYLES);
        String category = top(pieces, WardrobeItem::getCategory);

        // ---- política padronizada (mesmo formato de SealPolicies)
        Map<String, Object> rule = new LinkedHashMap<>();
        rule.put("quantifier", "AT_LEAST");
        rule.put("count", celebrity && t == SealTier.LOOK && family != null ? 2 : 1);
        if (family != null) {
            rule.put("color", family);
        }
        if (!celebrity) {
            rule.put("brand", issuer);
        } else if (family == null && category != null) {
            rule.put("category", category);
        }
        Map<String, Object> policy = new LinkedHashMap<>();
        policy.put("match", "ALL");
        policy.put("rules", rule.size() > 2 ? List.of(rule) : List.of());
        policy.put("occasions", occasions);
        policy.put("styles", styles);

        if (pieces.isEmpty()) {
            reasons.add(Msg.t("sealDraft.sem_pecas"));
        } else if (family != null) {
            long n = pieces.stream().filter(w -> family.equals(Taxonomy.COLOR_FAMILY.get(w.getColor()))).count();
            reasons.add(Msg.t("sealDraft.cor_frequente", familyLabel(family), n, pieces.size()));
        }
        if (!occasions.isEmpty() || !styles.isEmpty()) {
            List<String> tags = new ArrayList<>();
            occasions.forEach(o -> tags.add(Msg.t("taxonomy." + o)));
            styles.forEach(s -> tags.add(Msg.t("taxonomy." + s)));
            reasons.add(Msg.t("sealDraft.tags", String.join(", ", tags)));
        }

        // ---- nome
        String name = celebrity ? Msg.t("sealDraft.nome_assinatura", issuer)
                : family != null ? Msg.t("sealDraft.nome_cor", issuer, capitalize(familyLabel(family))) : Msg.t("sealDraft.nome_marca", issuer);
        name = name.length() > 60 ? name.substring(0, 60).trim() : name;

        // ---- arte
        Map<String, Object> design = new LinkedHashMap<>();
        if (celebrity) {
            design.put("kind", "FOLHA");
            design.put("mode", "TEMPLATE");
            design.put("template", "folha/mat-12");
            design.put("label", SealDesigns.labelFrom(issuer));
            design.put("caption", caption(Msg.t("sealDraft.legenda_celebridade")));
            reasons.add(Msg.t("sealDraft.arte_folha"));
        } else {
            String hex = color != null ? Taxonomy.COLORS.get(color) : "#F58220";
            String template = SealDesigns.nearestCircular(hex);
            design.put("kind", "CIRCULAR");
            design.put("mode", "TEMPLATE");
            design.put("template", template);
            Map<String, Object> element = new LinkedHashMap<>();
            element.put("id", t == SealTier.PECA ? "HANGER" : "BAG");
            element.put("material", "FOSCO");
            element.put("color", "#2B2622");
            element.put("text", initials(issuer));
            design.put("element", element);
            reasons.add(Msg.t("sealDraft.arte_circular"));
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("name", name);
        out.put("tier", t.name());
        out.put("policy", policy);
        out.put("design", SealDesigns.normalize(design));
        out.put("reasons", reasons);
        return out;
    }

    /** Até 3 letras/números: iniciais das palavras ("New Balance" → NB) ou o começo do nome ("Zara" → ZAR). */
    static String initials(String name) {
        String[] words = name.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9 ]", "").trim().split("\\s+");
        StringBuilder b = new StringBuilder();
        if (words.length > 1) {
            for (String w : words) {
                if (!w.isEmpty() && b.length() < 3) {
                    b.append(w.charAt(0));
                }
            }
        } else if (words.length == 1) {
            b.append(words[0], 0, Math.min(3, words[0].length()));
        }
        return b.length() == 0 ? "FAI" : b.toString();
    }

    private static String caption(String s) {
        return s.length() > SealDesigns.CAPTION_MAX ? s.substring(0, SealDesigns.CAPTION_MAX).trim() : s;
    }

    private static String familyLabel(String family) {
        return Msg.t("sealPolicy.familia." + family.toLowerCase(Locale.ROOT));
    }

    private static String capitalize(String s) {
        return s.isEmpty() ? s : s.substring(0, 1).toUpperCase(Locale.ROOT) + s.substring(1);
    }

    private static String top(List<WardrobeItem> pieces, Function<WardrobeItem, String> f) {
        Map<String, Integer> n = new LinkedHashMap<>();
        for (WardrobeItem w : pieces) {
            String v = f.apply(w);
            if (v != null && !v.isBlank()) {
                n.merge(v, 1, Integer::sum);
            }
        }
        return n.entrySet().stream().max(Map.Entry.comparingByValue()).map(Map.Entry::getKey).orElse(null);
    }

    private static List<String> topTags(List<WardrobeItem> pieces, Function<WardrobeItem, String> f, List<String> allowed) {
        Map<String, Integer> n = new LinkedHashMap<>();
        for (WardrobeItem w : pieces) {
            for (String v : Json.csv(f.apply(w))) {
                String k = v.toLowerCase(Locale.ROOT);
                if (allowed.contains(k)) {
                    n.merge(k, 1, Integer::sum);
                }
            }
        }
        return n.entrySet().stream().sorted(Map.Entry.<String, Integer>comparingByValue(Comparator.reverseOrder()))
                .limit(MAX_TAGS).map(Map.Entry::getKey).toList();
    }
}
