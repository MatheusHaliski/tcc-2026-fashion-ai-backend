package br.com.fashionai.application.flair;

import br.com.fashionai.application.flair.FlairEngine.Card;
import br.com.fashionai.application.flair.FlairLooks.Look;
import br.com.fashionai.application.flair.FlairLooks.Theme;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;

import static br.com.fashionai.application.flair.FlairLookScoring.score;

/**
 * FLAIR Draft e Deck Battle no {@link FlairLooks}: a ordem de escolha em serpente e o melhor look de uma mão.
 */
final class FlairDraftRules {
    private FlairDraftRules() {
    }

    // ------------------------------------------------------------------ Draft e Deck Battle

    /** Ordem de escolha em serpente: A, B, B, A, A, B, B, A… */
    public static String draftTurn(int pick) {
        int block = (pick + 1) / 2;
        return pick == 0 ? "A" : block % 2 == 1 ? "B" : "A";
    }

    /** Melhor look de até 5 cartas de uma mão para o tema (a IA do oponente e a dica do jogador usam isso). */
    public static List<Card> bestLook(List<Card> hand, Theme t, Function<List<Card>, Look> lookOf) {
        List<Card> best = List.of();
        double bestScore = -1;
        List<Card> tops = hand.stream().filter(c -> "upper_piece".equals(c.category()) || "full_body_piece".equals(c.category())).toList();
        List<Card> bottoms = hand.stream().filter(c -> "lower_piece".equals(c.category())).toList();
        List<Card> shoes = hand.stream().filter(c -> "shoes_piece".equals(c.category())).toList();
        List<Card> accs = hand.stream().filter(c -> "accessory_piece".equals(c.category())).toList();
        for (Card top : tops.isEmpty() ? List.<Card>of() : tops) {
            List<Card> bs = "full_body_piece".equals(top.category()) || bottoms.isEmpty() ? java.util.Collections.singletonList(null) : bottoms;
            for (Card bot : bs) {
                for (Card sh : shoes.isEmpty() ? java.util.Collections.<Card>singletonList(null) : shoes) {
                    for (Card ac : accs.isEmpty() ? java.util.Collections.<Card>singletonList(null) : java.util.stream.Stream.concat(accs.stream(), java.util.stream.Stream.of((Card) null)).toList()) {
                        List<Card> look = new ArrayList<>();
                        look.add(top);
                        if (bot != null) look.add(bot);
                        if (sh != null) look.add(sh);
                        if (ac != null) look.add(ac);
                        double s = score(lookOf.apply(look), t).total();
                        if (s > bestScore) {
                            bestScore = s;
                            best = look;
                        }
                    }
                }
            }
        }
        return best.isEmpty() ? hand.stream().limit(3).toList() : best;
    }
}
