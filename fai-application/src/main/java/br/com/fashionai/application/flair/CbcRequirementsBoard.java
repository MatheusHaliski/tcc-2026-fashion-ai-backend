package br.com.fashionai.application.flair;

import br.com.fashionai.application.flair.CbcRules.Card;
import br.com.fashionai.application.flair.CbcRules.RequirementResult;
import br.com.fashionai.application.flair.CbcRules.Slot;

import java.util.List;
import java.util.Locale;
import java.util.Map;

import static br.com.fashionai.application.flair.CbcRules.TIERS;
import static br.com.fashionai.application.flair.CbcRules.intOf;
import static br.com.fashionai.application.flair.CbcRules.positionOk;
import static br.com.fashionai.application.flair.CbcRules.tier;

/**
 * Requisitos que olham a mesa: nível, nota, sintonia, posição, contagem de cartas e "mala" (peso das cartas colocadas).
 * {@code n} = vagas não opcionais. Devolve {@code null} quando o tipo não é deste grupo.
 */
final class CbcRequirementsBoard {
    private CbcRequirementsBoard() {
    }

    static RequirementResult evaluate(String type, Map<String, Object> r, List<Slot> slots, Map<String, Card> board, List<Card> cards,
                                      int sintonia, int n, Map<String, Object> args) {
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
                return new RequirementResult(type, cards.size() >= n && avg >= min, avg, min, args);
            }
            case "ovrMin" -> {
                // sem "count": todas as cartas; com "count": pelo menos N ("3 cartas com nota acima de 80")
                int min = intOf(r.get("min"), 0);
                int need = intOf(r.get("count"), n);
                int have = (int) cards.stream().filter(c -> c.ovr() >= min).count();
                return new RequirementResult(type, have >= need, have, need, args);
            }
            case "sintonia" -> {
                int min = intOf(r.get("min"), 0);
                return new RequirementResult(type, sintonia >= min, sintonia, min, args);
            }
            case "strictPosition" -> {
                int have = (int) slots.stream().filter(s -> board.get(s.key()) != null && positionOk(s, board.get(s.key()))).count();
                return new RequirementResult(type, have >= n, have, n, args);
            }
            case "cards" -> {
                int need = intOf(r.get("min"), n);
                return new RequirementResult(type, cards.size() >= need, cards.size(), need, args);
            }
            case "mala" -> {
                // "mala" = peso das cartas colocadas (Bronze 1 … Especial 4); o teto limita o luxo, não o número de cartas
                int max = intOf(r.get("max"), Integer.MAX_VALUE);
                int have = cards.stream().mapToInt(CbcRequirementsBoard::weight).sum();
                return new RequirementResult(type, have <= max, have, max, args);
            }
            case "position" -> {
                String position = String.valueOf(r.get("position")).toUpperCase(Locale.ROOT);
                int need = intOf(r.get("count"), 1);
                int have = (int) cards.stream().filter(c -> position.equals(c.position())).count();
                return new RequirementResult(type, have >= need, have, need, args);
            }
            default -> {
                return null;
            }
        }
    }

    /** Peso de uma carta na mala: Bronze 1, Prata 2, Ouro 3, Especial 4 (nível desconhecido = 1). */
    static int weight(Card c) {
        return Math.max(0, TIERS.indexOf(c.tier())) + 1;
    }
}
