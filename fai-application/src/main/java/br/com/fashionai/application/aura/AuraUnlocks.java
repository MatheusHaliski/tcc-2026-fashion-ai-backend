package br.com.fashionai.application.aura;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeStatus;

/**
 * Circuito Aura (docs/aura/CIRCUITO_AURA.md) — "O que este card destrava": modelo de leitura puro. Recebe o estado do
 * Hype do card e os candidatos já levantados (cupons, campanhas de selo, faixa no FLAIR, pontos de marco, recompensas
 * de Aura) e separa o que já está destravado do que vem a seguir, com a distância até a próxima faixa.
 *
 * <p>Só lê: nada aqui grava sinal de Hype nem muda a nota. A escala é sempre a do {@code HypeScoreConfig} recebida em
 * {@code thresholds}; Hype privado ou desatualizado não destrava nada, e nota desconhecida nunca vira zero.</p>
 */
public final class AuraUnlocks {
    private AuraUnlocks() {
    }

    /** O que o item destrava. AURA_REWARD = arte/borda de Aura (Metamorfose) concedida por um marco, cupom ou selo. */
    public enum Kind { COUPON, SEAL_CAMPAIGN, FLAIR_BAND, MILESTONE_POINTS, AURA_REWARD }

    /** Família de Aura a que o item pertence (lib/aura-fashion.ts mais a Aura Impersonation). */
    public enum Family { COMMON, ELECTRO, SPLASH, HYPE, METAMORPHOSE, IMPERSONATION }

    /**
     * Estado do Hype do card. {@code status} nulo = ainda não calculado. {@code fresh} = calculado na versão atual do
     * algoritmo e dentro do prazo; {@code publicEligible} = item público e aprovado.
     */
    public record State(HypeStatus status, Double score, HypeLevel level, boolean publicEligible, boolean fresh) {
        /** Há nota para mostrar (INSUFFICIENT_DATA e NOT_CALCULATED não têm: nunca aparecem como zero). */
        public boolean scored() {
            return status == HypeStatus.AVAILABLE && score != null && level != null;
        }

        /** O Hype conta para destravar cupom, selo e faixa de jogo: precisa de nota, ser público e estar atualizado. */
        public boolean counts() {
            return scored() && publicEligible && fresh;
        }

        /** Faixa que vale para destravar; nula quando o Hype não conta. */
        public HypeLevel effectiveLevel() {
            return counts() ? level : null;
        }

        public Map<String, Object> view() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("status", status == null ? "NOT_CALCULATED" : status.name());
            m.put("score", scored() ? score : null);
            m.put("level", scored() ? level.name() : null);
            m.put("publicEligible", publicEligible);
            m.put("stale", scored() && !fresh);
            m.put("counts", counts());
            return m;
        }
    }

    public record Item(Kind kind, Family family, String title, String detail, String href, HypeLevel requiredLevel, boolean met) {
        public Map<String, Object> view() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("kind", kind.name());
            m.put("family", family.name());
            m.put("title", title);
            m.put("detail", detail);
            m.put("href", href);
            m.put("requiredLevel", requiredLevel == null ? null : requiredLevel.name());
            m.put("met", met);
            return m;
        }
    }

    public record NextLevel(HypeLevel level, double missingPoints) {
        public Map<String, Object> view() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("level", level.name());
            m.put("missingPoints", missingPoints);
            return m;
        }
    }

    public record Result(State state, List<Item> unlocked, List<Item> next, NextLevel nextLevel) {
        public Map<String, Object> view() {
            Map<String, Object> m = new LinkedHashMap<>(state.view());
            m.put("unlocked", unlocked.stream().map(Item::view).toList());
            m.put("next", next.stream().map(Item::view).toList());
            m.put("nextLevel", nextLevel == null ? null : nextLevel.view());
            return m;
        }
    }

    /** A faixa atual atende à exigida? Sem exigência atende sempre; sem faixa que conte, nunca. */
    public static boolean meets(HypeLevel required, HypeLevel current) {
        return required == null || current != null && current.ordinal() >= required.ordinal();
    }

    /** Item condicionado à faixa: {@code met} sai do Hype que conta (público e atualizado). */
    public static Item byLevel(Kind kind, Family family, String title, String detail, String href, HypeLevel required, State state) {
        return new Item(kind, family, title, detail, href, required, meets(required, state.effectiveLevel()));
    }

    /**
     * Próxima faixa e quantos pontos faltam, pelos limiares do HypeScoreConfig ({@code thresholds[i]} abre a faixa
     * {@code i + 1}). Nulo sem nota (não se inventa distância a partir de zero) e na última faixa.
     */
    public static NextLevel nextLevel(State state, int[] thresholds) {
        if (!state.scored() || thresholds == null) {
            return null;
        }
        HypeLevel[] levels = HypeLevel.values();
        for (int i = 0; i < thresholds.length && i + 1 < levels.length; i++) {
            if (state.score() < thresholds[i]) {
                double missing = Math.round((thresholds[i] - state.score()) * 10) / 10.0;
                return new NextLevel(levels[i + 1], Math.max(0.1, missing));
            }
        }
        return null;
    }

    /** Separa os candidatos: atendidos em {@code unlocked} (ordem de chegada) e os demais em {@code next}, da faixa mais próxima à mais distante. */
    public static Result assemble(State state, int[] thresholds, List<Item> candidates) {
        List<Item> unlocked = new ArrayList<>();
        List<Item> next = new ArrayList<>();
        for (Item item : candidates) {
            (item.met() ? unlocked : next).add(item);
        }
        next.sort(Comparator.comparingInt(i -> i.requiredLevel() == null ? Integer.MAX_VALUE : i.requiredLevel().ordinal()));
        return new Result(state, List.copyOf(unlocked), List.copyOf(next), nextLevel(state, thresholds));
    }
}
