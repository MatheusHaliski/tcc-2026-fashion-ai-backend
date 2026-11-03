package br.com.fashionai.application.flair;

import br.com.fashionai.application.flair.CbcRules.Slot;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import static br.com.fashionai.application.flair.CbcRules.ACCEPT_KEYS;
import static br.com.fashionai.application.flair.CbcRules.HYPE_DIMS;
import static br.com.fashionai.application.flair.CbcRules.MAX_SLOTS;
import static br.com.fashionai.application.flair.CbcRules.MIN_SLOTS;
import static br.com.fashionai.application.flair.CbcRules.POSITIONS;
import static br.com.fashionai.application.flair.CbcRules.TAG_FIELDS;
import static br.com.fashionai.application.flair.CbcRules.TIERS;
import static br.com.fashionai.application.flair.CbcRules.TYPES;
import static br.com.fashionai.application.flair.CbcValues.strings;
import static br.com.fashionai.application.flair.CbcValues.tier;

/**
 * Validação de forma dos desafios na administração ({@link CbcRules#validate}) e as perguntas sobre os requisitos
 * (nível aberto a todos, A1; tem requisito de tema).
 */
final class CbcValidation {
    private CbcValidation() {
    }

    /** A1: o desafio não exige nível acima de Bronze (aberto a quem tem só peças baratas). */
    public static boolean levelOpen(List<Map<String, Object>> requirements) {
        for (Map<String, Object> r : requirements == null ? List.<Map<String, Object>>of() : requirements) {
            if (!"tier".equals(r.get("type"))) {
                continue;
            }
            if (r.get("min") != null && TIERS.indexOf(tier(r.get("min"))) > 0) {
                return false;
            }
            if (r.get("exact") != null && TIERS.indexOf(tier(r.get("exact"))) > 0) {
                return false;
            }
            if (r.get("only") != null && TIERS.indexOf(tier(r.get("only"))) > 0) {
                return false;
            }
        }
        return true;
    }

    // ================================================================== validação (administração)
    /** Erros de forma das vagas e requisitos (lista vazia = válido). */
    public static List<String> validate(List<Slot> slots, List<Map<String, Object>> requirements) {
        List<String> errors = new ArrayList<>();
        if (slots == null || slots.size() < MIN_SLOTS || slots.size() > MAX_SLOTS) {
            errors.add("slots.count");
            return errors;
        }
        Set<String> keys = new HashSet<>();
        for (Slot s : slots) {
            if (s.key() == null || !s.key().matches("[a-z0-9_-]{1,40}") || !keys.add(s.key())) {
                errors.add("slots.key:" + s.key());
            }
            if (s.position() != null && !POSITIONS.contains(s.position())) {
                errors.add("slots.position:" + s.position());
            }
            for (String k : s.accepts().keySet()) {
                if (!ACCEPT_KEYS.contains(k)) {
                    errors.add("slots.accepts:" + k);
                }
            }
        }
        for (Map<String, Object> r : requirements == null ? List.<Map<String, Object>>of() : requirements) {
            Object type = r.get("type");
            if (!(type instanceof String t) || !TYPES.contains(t)) {
                errors.add("requirements.type:" + type);
                continue;
            }
            if ("tier".equals(t)) {
                Object v = r.get("only") != null ? r.get("only") : r.get("max") != null ? r.get("max") : r.get("exact") != null ? r.get("exact") : r.get("min");
                if (v == null || !TIERS.contains(String.valueOf(v).toUpperCase(Locale.ROOT))) {
                    errors.add("requirements.tier");
                }
            }
            if ("tag".equals(t) && (!TAG_FIELDS.contains(String.valueOf(r.get("field"))) || strings(r.get("anyOf")).isEmpty())) {
                errors.add("requirements.tag");
            }
            if ("brand".equals(t) && strings(r.get("anyOf")).isEmpty()) {
                errors.add("requirements.brand");
            }
            if ("hype".equals(t) && !HYPE_DIMS.contains(String.valueOf(r.getOrDefault("dim", "HYP")).toUpperCase(Locale.ROOT))) {
                errors.add("requirements.hype");
            }
            Object count = r.get("count");
            if (count instanceof Number c && (c.intValue() < 1 || c.intValue() > slots.size())) {
                errors.add("requirements.count:" + t);
            }
        }
        return errors;
    }

    public static boolean hasTheme(List<Map<String, Object>> requirements) {
        return requirements != null && requirements.stream().anyMatch(r -> "theme".equals(r.get("type")));
    }
}
