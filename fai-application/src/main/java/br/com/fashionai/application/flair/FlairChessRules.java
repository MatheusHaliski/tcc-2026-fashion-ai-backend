package br.com.fashionai.application.flair;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.FlairEngine.Card;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static br.com.fashionai.application.flair.FlairLookColors.dark;
import static br.com.fashionai.application.flair.FlairLookColors.family;
import static br.com.fashionai.application.flair.FlairLookColors.light;
import static br.com.fashionai.application.flair.FlairLookStats.SNEAKERS;
import static br.com.fashionai.application.flair.FlairLookStats.STREET_BOTTOMS;
import static br.com.fashionai.application.flair.FlairLooks.BOARD;
import static br.com.fashionai.application.flair.FlairLooks.OUTERWEAR;

/**
 * FLAIR Chess no {@link FlairLooks}: o tabuleiro 3×3 (encaixe por posição, HERO, SUPPORT e bônus de adjacência) e a
 * montagem automática do melhor tabuleiro.
 */
final class FlairChessRules {
    private FlairChessRules() {
    }

    // ------------------------------------------------------------------ Chess (Fashion Strategy)

    static boolean fits(String slot, Card c) {
        return switch (slot) {
            case "ACCESSORY_L", "ACCESSORY_R" -> "accessory_piece".equals(c.category());
            case "TOP" -> "upper_piece".equals(c.category()) && !OUTERWEAR.contains(c.subcategory()) || "full_body_piece".equals(c.category());
            case "OUTERWEAR" -> OUTERWEAR.contains(c.subcategory());
            case "BOTTOM" -> "lower_piece".equals(c.category()) || "full_body_piece".equals(c.category());
            case "SHOES_L", "SHOES_R" -> "shoes_piece".equals(c.category());
            default -> true;
        };
    }

    static List<Integer> neighbors(int i) {
        List<Integer> n = new ArrayList<>();
        int r = i / 3, c = i % 3;
        if (r > 0) n.add(i - 3);
        if (r < 2) n.add(i + 3);
        if (c > 0) n.add(i - 1);
        if (c < 2) n.add(i + 1);
        return n;
    }

    /** Avalia o tabuleiro 3×3: poder das cartas na posição certa, HERO ×1,25, SUPPORT e bônus de adjacência. */
    public static Map<String, Object> chess(Map<String, Card> board) {
        List<Map<String, Object>> cells = new ArrayList<>();
        List<String> bonuses = new ArrayList<>();
        double total = 0;
        for (int i = 0; i < BOARD.size(); i++) {
            String slot = BOARD.get(i);
            Card c = board.get(slot);
            if (c == null) {
                cells.add(Map.of("slot", slot, "empty", true));
                continue;
            }
            boolean ok = fits(slot, c);
            double v = c.power() / 10.0 * (ok ? 1 : 0.5) * ("HERO".equals(slot) ? 1.25 : 1);
            total += v;
            cells.add(Map.of("slot", slot, "card", c.name(), "fits", ok, "value", Math.round(v * 10) / 10.0));
        }
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < BOARD.size(); i++) {
            Card a = board.get(BOARD.get(i));
            if (a == null) {
                continue;
            }
            for (int j : neighbors(i)) {
                Card b = board.get(BOARD.get(j));
                if (b == null || !seen.add(Math.min(i, j) + ":" + Math.max(i, j))) {
                    continue;
                }
                total += adjacency(a, b, bonuses);
            }
            if ("SUPPORT".equals(BOARD.get(i))) {
                long n = neighbors(i).stream().filter(j -> board.get(BOARD.get(j)) != null).count();
                total += 3 * n;
                if (n > 0) {
                    bonuses.add(Msg.t("flairLooks.support_para_as_vizinhas", a.name(), (3 * n)));
                }
            }
        }
        return Map.of("total", Math.round(total * 10) / 10.0, "cells", cells, "bonuses", bonuses);
    }

    static double adjacency(Card a, Card b, List<String> log) {
        double s = 0;
        String fa = family(a.colorHex()), fb = family(b.colorHex());
        if (light(a.colorHex()) && "upper_piece".equals(a.category()) && dark(b.colorHex()) && "lower_piece".equals(b.category())
                || light(b.colorHex()) && "upper_piece".equals(b.category()) && dark(a.colorHex()) && "lower_piece".equals(a.category())) {
            s += 5;
            log.add(Msg.k("flairLooks.claro_calca_escura", a.name(), b.name()));
        } else if (fa.equals(fb) && !"neutral".equals(fa)) {
            s += 3;
            log.add(Msg.k("flairLooks.mesma_familia_de_cor", a.name(), b.name()));
        } else if ("neutral".equals(fa) || "neutral".equals(fb)) {
            s += 2;
        }
        boolean street = (SNEAKERS.contains(a.subcategory()) && STREET_BOTTOMS.contains(b.subcategory())) || (SNEAKERS.contains(b.subcategory()) && STREET_BOTTOMS.contains(a.subcategory()));
        if (street) {
            s += 8;
            log.add(Msg.k("flairLooks.tenis_cargo_jeans"));
        }
        if (("blazer".equals(a.subcategory()) && "tailored_pants".equals(b.subcategory())) || ("blazer".equals(b.subcategory()) && "tailored_pants".equals(a.subcategory()))) {
            s += 6;
            log.add(Msg.k("flairLooks.blazer_alfaiataria"));
        }
        if (a.styles().stream().anyMatch(b.styles()::contains)) {
            s += 4;
        }
        if (a.brandName() != null && a.brandName().equalsIgnoreCase(b.brandName())) {
            s += 3;
            log.add(Msg.k("flairLooks.mesma_marca", a.brandName()));
        }
        return s;
    }

    /** Monta o melhor tabuleiro possível com um conjunto de cartas (IA do oponente e sugestão para o jogador). */
    public static Map<String, Card> autoBoard(List<Card> pool) {
        Map<String, Card> board = new LinkedHashMap<>();
        List<Card> left = new ArrayList<>(pool);
        left.sort(Comparator.comparingInt(Card::power).reversed());
        for (String slot : List.of("TOP", "BOTTOM", "OUTERWEAR", "SHOES_L", "SHOES_R", "ACCESSORY_L", "ACCESSORY_R")) {
            left.stream().filter(c -> fits(slot, c)).findFirst().ifPresent(c -> {
                board.put(slot, c);
                left.remove(c);
            });
        }
        if (!left.isEmpty()) {
            board.put("HERO", left.remove(0));
        }
        if (!left.isEmpty()) {
            board.put("SUPPORT", left.remove(0));
        }
        return board;
    }
}
