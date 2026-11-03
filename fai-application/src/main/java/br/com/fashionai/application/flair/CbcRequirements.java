package br.com.fashionai.application.flair;

import br.com.fashionai.application.flair.CbcRules.Card;
import br.com.fashionai.application.flair.CbcRules.Context;
import br.com.fashionai.application.flair.CbcRules.RequirementResult;
import br.com.fashionai.application.flair.CbcRules.Slot;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import static br.com.fashionai.application.flair.CbcRules.REDISCOVERY_DAYS;
import static br.com.fashionai.application.flair.CbcRules.TIERS;
import static br.com.fashionai.application.flair.CbcSintonia.idleDays;
import static br.com.fashionai.application.flair.CbcSintonia.positionOk;
import static br.com.fashionai.application.flair.CbcSintonia.tagMatch;
import static br.com.fashionai.application.flair.CbcSintonia.themeAny;
import static br.com.fashionai.application.flair.CbcValues.intOf;
import static br.com.fashionai.application.flair.CbcValues.norm;
import static br.com.fashionai.application.flair.CbcValues.strings;
import static br.com.fashionai.application.flair.CbcValues.tier;

/**
 * Requisitos do desafio de montagem ({@link CbcRules#evaluate}): cada tipo de requisito (nível, nota, marca, sintonia,
 * tags, tema, Hype, origem, sem compras, redescoberta, posição estrita) vira um {@link RequirementResult} com o que a
 * montagem tem e o que precisa.
 */
final class CbcRequirements {
    private CbcRequirements() {
    }

    static RequirementResult requirement(Map<String, Object> r, List<Slot> slots, Map<String, Card> board, List<Card> cards, int sintonia, Context ctx) {
        String type = String.valueOf(r.get("type"));
        int n = slots.size();
        Map<String, Object> args = new LinkedHashMap<>(r);
        args.remove("type");
        switch (type) {
            case "tier" -> {
                if (r.get("only") != null) {
                    String only = tier(r.get("only"));
                    int have = (int) cards.stream().filter(c -> only.equals(c.tier())).count();
                    return new RequirementResult(type, have >= n, have, n, args);
                }
                if (r.get("max") != null) {
                    int max = TIERS.indexOf(tier(r.get("max")));
                    int have = (int) cards.stream().filter(c -> TIERS.indexOf(c.tier()) <= max).count();
                    return new RequirementResult(type, have >= n, have, n, args);
                }
                if (r.get("exact") != null) {
                    String exact = tier(r.get("exact"));
                    int need = intOf(r.get("count"), 1);
                    int have = (int) cards.stream().filter(c -> exact.equals(c.tier())).count();
                    return new RequirementResult(type, have == need, have, need, args);
                }
                int min = TIERS.indexOf(tier(r.get("min")));
                int need = intOf(r.get("count"), n);
                int have = (int) cards.stream().filter(c -> TIERS.indexOf(c.tier()) >= min).count();
                return new RequirementResult(type, have >= need, have, need, args);
            }
            case "ovrAvg" -> {
                int min = intOf(r.get("min"), 0);
                int avg = cards.isEmpty() ? 0 : (int) Math.round(cards.stream().mapToInt(Card::ovr).average().orElse(0));
                return new RequirementResult(type, cards.size() == n && avg >= min, avg, min, args);
            }
            case "ovrMin" -> {
                // sem "count": todas as cartas; com "count": pelo menos N ("3 cartas com nota acima de 80")
                int min = intOf(r.get("min"), 0);
                int need = intOf(r.get("count"), n);
                int have = (int) cards.stream().filter(c -> c.ovr() >= min).count();
                return new RequirementResult(type, have >= need, have, need, args);
            }
            case "brand" -> {
                // marca específica ("3 cartas da Norte"): quando o desafio é de uma marca, o nome vem do perfil dela
                Set<String> wanted = norm(strings(r.get("anyOf")));
                int need = intOf(r.get("count"), 1);
                int have = (int) cards.stream().filter(c -> c.brand() != null && wanted.contains(c.brand().trim().toLowerCase(Locale.ROOT))).count();
                return new RequirementResult(type, have >= need, have, need, args);
            }
            case "sintonia" -> {
                int min = intOf(r.get("min"), 0);
                return new RequirementResult(type, sintonia >= min, sintonia, min, args);
            }
            case "sameBrand" -> {
                int need = intOf(r.get("count"), 2);
                Map<String, Integer> byBrand = new HashMap<>();
                cards.stream().map(Card::brand).filter(b -> b != null && !b.isBlank())
                        .forEach(b -> byBrand.merge(b.trim().toLowerCase(Locale.ROOT), 1, Integer::sum));
                int have = byBrand.values().stream().max(Integer::compare).orElse(0);
                return new RequirementResult(type, have >= need, have, need, args);
            }
            case "distinctBrands" -> {
                int need = intOf(r.get("count"), 2);
                int have = (int) cards.stream().map(Card::brand).filter(b -> b != null && !b.isBlank())
                        .map(b -> b.trim().toLowerCase(Locale.ROOT)).distinct().count();
                return new RequirementResult(type, have >= need, have, need, args);
            }
            case "tag" -> {
                String field = String.valueOf(r.getOrDefault("field", "style"));
                Set<String> wanted = norm(strings(r.get("anyOf")));
                int need = intOf(r.get("count"), 1);
                int have = (int) cards.stream().filter(c -> tagMatch(c, field, wanted)).count();
                return new RequirementResult(type, have >= need, have, need, args);
            }
            case "theme" -> {
                // P1: qualquer interpretação do Momento (ou as tags do desafio) vale — nunca só a escolhida
                int need = intOf(r.get("count"), 1);
                int have = (int) cards.stream().filter(c -> themeAny(c, ctx)).count();
                return new RequirementResult(type, have >= need, have, need, args);
            }
            case "hype" -> {
                String dim = String.valueOf(r.getOrDefault("dim", "HYP")).toUpperCase(Locale.ROOT);
                int min = intOf(r.get("min"), 0);
                int need = intOf(r.get("count"), 1);
                int have = (int) cards.stream().filter(c -> c.hype().get(dim) != null && c.hype().get(dim) >= min).count();
                return new RequirementResult(type, have >= need, have, need, args);
            }
            case "origin" -> {
                String only = String.valueOf(r.getOrDefault("only", "PIECE")).toUpperCase(Locale.ROOT);
                int have = (int) cards.stream().filter(c -> only.equals(c.originType())).count();
                return new RequirementResult(type, have >= n, have, n, args);
            }
            case "noBuy" -> {
                // C2: a peça já estava no guarda-roupa antes do início (sem início, basta a peça existir)
                int have = (int) cards.stream().filter(c -> c.pieceAddedAt() != null
                        && (ctx.startAt() == null || c.pieceAddedAt().isBefore(ctx.startAt()))).count();
                return new RequirementResult(type, have >= n, have, n, args);
            }
            case "rediscovery" -> {
                int days = intOf(r.get("idleDays"), REDISCOVERY_DAYS);
                int need = intOf(r.get("count"), 1);
                int have = (int) cards.stream().filter(c -> idleDays(c, ctx.today()) >= days).count();
                return new RequirementResult(type, have >= need, have, need, args);
            }
            case "strictPosition" -> {
                int have = (int) slots.stream().filter(s -> board.get(s.key()) != null && positionOk(s, board.get(s.key()))).count();
                return new RequirementResult(type, have >= n, have, n, args);
            }
            default -> {
                return new RequirementResult(type, false, 0, 1, args);
            }
        }
    }
}
