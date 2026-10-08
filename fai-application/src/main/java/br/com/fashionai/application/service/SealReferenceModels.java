package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ai.local.LocalAdvisors;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.taxonomy.TaxonomyRegistry;
import br.com.fashionai.domain.model.TaxonomyAttribute;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.SealTier;

import java.util.*;

/** Modelo de referência produzido pelo #createsealpolicy. Só campos explicitamente exigidos restringem o resgate. */
public final class SealReferenceModels {
    private static final Set<String> FIELDS = Set.of("category", "subcategory", "brand", "color", "material", "variation", "sex", "size", "market");
    private static final Set<String> BACKGROUND = Set.of("artUrl", "color", "gradientPresetId", "seasonalPresetId", "materialId", "cardSkin", "layoutAnatomy", "animation", "aura");
    private static final Set<String> PIECE_KEYS;
    static {
        Set<String> keys = new HashSet<>(FIELDS);
        keys.addAll(Set.of("name", "quantifier", "count", "attributes", "background"));
        PIECE_KEYS = Set.copyOf(keys);
    }
    private SealReferenceModels() { }

    public static Map<String, Object> normalize(Object raw) {
        if (!(raw instanceof Map<?, ?> model)) throw invalid();
        rejectUnknown(model, Set.of("version", "tier", "title", "description", "match", "pieces", "minPieces", "maxPieces", "background", "target", "earnedSeals"));
        if (!(model.get("version") instanceof Number v) || v.doubleValue() != 1) throw invalid();
        String tier = text(model.get("tier"));
        if (!Set.of("PERFIL", "PECA", "LOOK").contains(tier == null ? "" : tier)) throw invalid();
        String match = text(model.get("match"));
        if (match != null && !Set.of("ALL", "ANY").contains(match)) throw invalid();
        if (!(model.get("pieces") instanceof List<?> pieces) || pieces.isEmpty() || pieces.size() > 64) throw invalid();
        List<Map<String, Object>> normalized = new ArrayList<>();
        for (Object item : pieces) {
            if (!(item instanceof Map<?, ?> p)) throw invalid();
            rejectUnknown(p, PIECE_KEYS);
            Map<String, Object> out = new LinkedHashMap<>();
            String q = text(p.get("quantifier"));
            q = q == null ? "AT_LEAST" : q;
            if (!Set.of("AT_LEAST", "EXACTLY", "ALL", "NONE").contains(q)) throw invalid();
            int count = integer(p.getOrDefault("count", null), 1);
            if ("PECA".equals(tier) && count != 1) throw invalid();
            out.put("quantifier", q);
            out.put("count", count);
            if (text(p.get("name")) != null) out.put("name", text(p.get("name")));
            for (String field : FIELDS) if (text(p.get(field)) != null) out.put(field, text(p.get(field)));
            String category = text(p.get("category")), sub = text(p.get("subcategory"));
            if (category != null && !Taxonomy.isValidCategory(category)) throw invalid();
            if (sub != null && (!Taxonomy.isSubcategory(sub) || category != null && !Taxonomy.isSubcategoryOf(category, sub))) throw invalid();
            if (p.get("color") != null && !Taxonomy.COLORS.containsKey(text(p.get("color")))
                    && !Taxonomy.COLOR_FAMILY.containsValue(text(p.get("color")))) throw invalid();
            if (p.get("material") != null && !Taxonomy.isMaterial(text(p.get("material")))) throw invalid();
            if (p.get("sex") != null && !Taxonomy.SEXES.contains(text(p.get("sex")))) throw invalid();
            if (p.get("size") != null && !Taxonomy.SIZES.contains(text(p.get("size")))) throw invalid();
            if (p.get("market") != null && !Taxonomy.isValidMarket(text(p.get("market")))) throw invalid();
            Map<String, List<String>> attributes = attributes(p.get("attributes"));
            if (sub != null) {
                if (!Taxonomy.variationErrors(category == null ? Taxonomy.categoryOf(sub) : category, sub, text(p.get("variation")), attributes).isEmpty()) throw invalid();
            } else if (p.get("variation") != null) throw invalid();
            if (!attributes.isEmpty()) out.put("attributes", attributes);
            if (p.get("background") != null) out.put("background", background(p.get("background")));
            normalized.add(out);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("version", 1);
        out.put("tier", tier);
        out.put("title", requiredText(model.get("title")));
        out.put("description", requiredText(model.get("description")));
        out.put("match", match == null ? "ALL" : match);
        out.put("pieces", normalized);
        int min = integer(model.get("minPieces"), 1);
        Integer max = model.get("maxPieces") == null ? null : integer(model.get("maxPieces"), 1);
        if (max != null && max < min || "PECA".equals(tier) && (min != 1 || max != null && max != 1)) throw invalid();
        out.put("minPieces", min);
        if (max != null) out.put("maxPieces", max);
        if (model.get("background") != null) out.put("background", background(model.get("background")));
        if ("PERFIL".equals(tier)) {
            String target = requiredText(model.get("target"));
            if (!Set.of("PECA", "LOOK", "BOTH").contains(target)) throw invalid();
            out.put("target", target);
        } else if (model.containsKey("target")) throw invalid();
        if (model.get("earnedSeals") != null) out.put("earnedSeals", earnedSeals(model.get("earnedSeals")));
        return out;
    }

    private static Map<String, Object> earnedSeals(Object raw) {
        if (!(raw instanceof Map<?, ?> m)) throw invalid();
        rejectUnknown(m, Set.of("match", "rules"));
        String match = requiredText(m.get("match"));
        if (!Set.of("ALL", "ANY").contains(match) || !(m.get("rules") instanceof List<?> list) || list.isEmpty() || list.size() > 64) throw invalid();
        List<Map<String, Object>> rules = new ArrayList<>();
        for (Object item : list) {
            if (!(item instanceof Map<?, ?> r)) throw invalid();
            rejectUnknown(r, Set.of("sealId", "name", "scope", "minCount"));
            String id = requiredText(r.get("sealId")), scope = requiredText(r.get("scope"));
            try { UUID.fromString(id); } catch (IllegalArgumentException e) { throw invalid(); }
            if (!Set.of("PIECES", "LOOK", "ANY").contains(scope)) throw invalid();
            Map<String, Object> rule = new LinkedHashMap<>(Map.of("sealId", id, "scope", scope, "minCount", integer(r.get("minCount"), 1)));
            if (r.get("name") != null) rule.put("name", requiredText(r.get("name")));
            rules.add(rule);
        }
        return Map.of("match", match, "rules", rules);
    }

    private static Map<String, List<String>> attributes(Object raw) {
        Map<String, List<String>> out = new LinkedHashMap<>();
        if (raw == null) return out;
        if (!(raw instanceof Map<?, ?> attrs)) throw invalid();
        for (var entry : attrs.entrySet()) {
            String dim = String.valueOf(entry.getKey());
            var dimension = TaxonomyRegistry.get().dimension(dim).orElseThrow(SealReferenceModels::invalid);
            if (!(entry.getValue() instanceof List<?> values) || values.isEmpty() || values.size() > dimension.maxPerPiece()) throw invalid();
            List<String> codes = new ArrayList<>();
            for (Object value : values) {
                String code = requiredText(value);
                if (dimension.value(code).isEmpty()) throw invalid();
                if (!codes.contains(code)) codes.add(code);
            }
            out.put(dim, codes);
        }
        return out;
    }

    private static Map<String, Object> background(Object raw) {
        if (!(raw instanceof Map<?, ?> b) || b.isEmpty()) throw invalid();
        rejectUnknown(b, BACKGROUND);
        Map<String, Object> out = new LinkedHashMap<>();
        for (var entry : b.entrySet()) {
            String k = String.valueOf(entry.getKey());
            if ("aura".equals(k)) {
                if (!(entry.getValue() instanceof Map<?, ?> aura)) throw invalid();
                rejectUnknown(aura, Set.of("variantId"));
                out.put(k, Map.of("variantId", requiredText(aura.get("variantId"))));
            } else out.put(k, requiredText(entry.getValue()));
        }
        return out;
    }

    public static SealPolicies.Verdict evaluate(Map<String, Object> model, SealTier tier, List<WardrobeItem> pieces, Map<String, Object> lookBackground) {
        if (!(tier.name().equals(model.get("tier")) || "PERFIL".equals(model.get("tier"))
                && (tier.name().equals(model.get("target")) || "BOTH".equals(model.get("target")))) || pieces.isEmpty()) return no();
        int min = ((Number) model.get("minPieces")).intValue();
        Integer max = model.get("maxPieces") instanceof Number n ? n.intValue() : null;
        if (pieces.size() < min || max != null && pieces.size() > max) return no();
        Map<String, Object> actualBackground = tier == SealTier.PECA ? backgroundOf(Json.map(pieces.get(0).getBackgroundConfigJson())) : backgroundOf(lookBackground);
        if (!subset(model.get("background"), actualBackground)) return no();
        List<UUID> support = new ArrayList<>();
        int holds = 0;
        for (Object item : (List<?>) model.get("pieces")) {
            @SuppressWarnings("unchecked") Map<String, Object> p = (Map<String, Object>) item;
            List<WardrobeItem> pass = pieces.stream().filter(w -> matches(p, w)).toList();
            int count = ((Number) p.get("count")).intValue();
            boolean hit = switch (String.valueOf(p.get("quantifier"))) {
                case "ALL" -> pass.size() == pieces.size();
                case "NONE" -> pass.isEmpty();
                case "EXACTLY" -> pass.size() == count;
                default -> pass.size() >= count;
            };
            if (hit) {
                holds++;
                pass.stream().map(WardrobeItem::getId).filter(Objects::nonNull).forEach(support::add);
            }
        }
        boolean matched = "ANY".equals(model.get("match")) ? holds > 0 : holds == ((List<?>) model.get("pieces")).size();
        return matched ? new SealPolicies.Verdict(true, support.stream().distinct().toList(), String.valueOf(model.get("description"))) : no();
    }

    private static boolean matches(Map<String, Object> p, WardrobeItem w) {
        Map<String, Object> actual = new HashMap<>();
        actual.put("category", w.getCategory()); actual.put("subcategory", w.getSubcategory());
        actual.put("material", w.getMaterial()); actual.put("variation", w.getVariationCode());
        actual.put("sex", w.getSex()); actual.put("size", w.getSizeLabel()); actual.put("market", w.getMarket());
        String brand = w.getBrandName() != null ? w.getBrandName() : w.getBrand() != null ? w.getBrand().getName()
                : w.getBrandProfile() != null ? w.getBrandProfile().getBrandName() : null;
        for (String field : FIELDS) {
            Object wanted = p.get(field);
            if (wanted == null) continue;
            if ("color".equals(field)) { if (!SealPolicies.colorMatches(String.valueOf(wanted), w.getColor())) return false; }
            else if ("brand".equals(field)) {
                if (brand == null || !LocalAdvisors.normalize(String.valueOf(wanted)).equals(LocalAdvisors.normalize(brand))) return false;
            } else if (actual.get(field) == null || !String.valueOf(wanted).equalsIgnoreCase(String.valueOf(actual.get(field)))) return false;
        }
        Map<String, List<String>> attrs = TaxonomyAttribute.toMap(w.getAttributes(), Set.of());
        attrs.put("COLOR", w.getColor() == null ? List.of() : List.of(w.getColor().toUpperCase(Locale.ROOT)));
        attrs.put("MATERIAL", w.getMaterial() == null ? List.of() : List.of(w.getMaterial()));
        attrs.put("GENDER", w.getSex() == null ? List.of() : List.of(w.getSex()));
        attrs.put("STYLE", Json.csv(w.getStyleTags())); attrs.put("OCCASION", Json.csv(w.getOccasionTags()));
        if (p.get("attributes") instanceof Map<?, ?> required) {
            for (var entry : required.entrySet()) if (!attrs.getOrDefault(entry.getKey(), List.of()).containsAll((List<?>) entry.getValue())) return false;
        }
        return subset(p.get("background"), backgroundOf(Json.map(w.getBackgroundConfigJson())));
    }

    public static Map<String, Object> backgroundOf(Map<String, Object> raw) {
        Map<String, Object> out = new LinkedHashMap<>(raw == null ? Map.of() : raw);
        if (out.get("scheme") instanceof Map<?, ?> scheme) scheme.forEach((k, v) -> out.put(String.valueOf(k), v));
        if (out.get("studio") instanceof Map<?, ?> studio) studio.forEach((k, v) -> out.put(String.valueOf(k), v));
        if (out.get("skin") != null) out.putIfAbsent("cardSkin", out.get("skin"));
        if (out.get("anatomy") != null) out.putIfAbsent("layoutAnatomy", out.get("anatomy"));
        if (out.get("aiArt") instanceof Map<?, ?> art) out.put("artUrl", art.get("url"));
        else if (out.get("uploadUrl") != null) out.put("artUrl", out.get("uploadUrl"));
        return out;
    }

    private static boolean subset(Object wanted, Object actual) {
        if (wanted == null) return true;
        if (wanted instanceof Map<?, ?> w) {
            if (!(actual instanceof Map<?, ?> a)) return false;
            return w.entrySet().stream().allMatch(e -> subset(e.getValue(), a.get(e.getKey())));
        }
        return Objects.equals(wanted, actual);
    }
    private static int integer(Object value, int fallback) {
        if (value == null) return fallback;
        if (!(value instanceof Number n) || n.doubleValue() != n.intValue() || n.intValue() < 1 || n.intValue() > 100) throw invalid();
        return n.intValue();
    }
    private static void rejectUnknown(Map<?, ?> m, Set<String> allowed) {
        if (!allowed.containsAll(m.keySet())) throw invalid();
    }
    private static String text(Object value) {
        if (value == null) return null;
        if (!(value instanceof String s) || s.length() > 2048) throw invalid();
        return s.isBlank() ? null : s.trim();
    }
    private static String requiredText(Object value) {
        String s = text(value); if (s == null) throw invalid(); return s;
    }
    private static SealPolicies.Verdict no() { return new SealPolicies.Verdict(false, List.of(), null); }
    private static ApiException invalid() { return ApiException.badRequest("MODELO_SELO_INVALIDO", Msg.t("sealCopilot.modelo_invalido")); }
}
