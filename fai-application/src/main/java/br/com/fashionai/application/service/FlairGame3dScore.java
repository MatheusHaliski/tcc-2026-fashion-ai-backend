package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair.Flair3dEffects;
import br.com.fashionai.application.flair.Flair3dHype;
import br.com.fashionai.application.flair.Flair3dPenalties;
import br.com.fashionai.domain.model.FlairChallenge;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * FLAIR 3D MAKE UP — o resultado "flair3d" de uma partida, sem I/O: por vaga preenchida a faixa de Hype da carta, o bônus de
 * jogada, o efeito (Comum/Metamorfose/Impersonation) e a faixa de partida; totais, pontuação e "perfeito" (R2:
 * requisitos cumpridos e sintonia ≥ 2 por vaga obrigatória). Erros do jogador
 * (Flair3dPenalties) descontam do placar, que nunca fica negativo; carta fora da posição não aciona Metamorfose nem
 * Impersonation. Quem chama já leu as cartas, as peças e as auras.
 */
final class FlairGame3dScore {
    private FlairGame3dScore() {
    }

    record Score(List<Map<String, Object>> slots, int hypeTotal, int effectTotal, int penaltyTotal, int score, int scoreMax, boolean perfect) {
        Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("slots", slots);
            m.put("hypeTotal", hypeTotal);
            m.put("effectTotal", effectTotal);
            m.put("penaltyTotal", penaltyTotal);
            m.put("score", score);
            m.put("scoreMax", scoreMax);
            m.put("perfect", perfect);
            return m;
        }
    }

    /** Permissões e prontidão já conferidas pelo serviço: Metamorfose e as cartas prontas para Impersonation (nível Loft + aura). */
    record Player(boolean metamorfoseAllowed, Set<UUID> impersonationReady) {
    }

    @SuppressWarnings("unchecked")
    static Score of(FlairChallenge g, Map<String, Object> evaluation, List<CbcRules.SlotResult> results, Map<UUID, CbcRules.Card> models,
                    Player player) {
        Map<String, Object> hype = Json.map(g.getHypeJson());
        Flair3dHype.Band max = Flair3dHype.parse(hype.get("mandatoryMax"), Flair3dHype.Band.VIRAL);
        Map<String, Object> play = hype.get("play") instanceof Map<?, ?> p ? (Map<String, Object>) p : Map.of();
        Map<String, Object> partial = hype.get("partial") instanceof Map<?, ?> p ? (Map<String, Object>) p : Map.of();
        Map<String, Map<String, Object>> raw = FlairGameViews.rawSlots(g);
        boolean complete = Boolean.TRUE.equals(evaluation.get("complete"));
        List<Map<String, Object>> slots = new ArrayList<>();
        int hypeTotal = 0;
        int effectTotal = 0;
        int penaltyTotal = 0;
        for (CbcRules.SlotResult r : results) {
            if (r.cardId() == null) {
                continue;
            }
            Map<String, Object> slot = raw.getOrDefault(r.slot(), Map.of());
            CbcRules.Card card = models.get(r.cardId());
            Flair3dHype.Band band = Flair3dHype.bandOf(card);
            int hypeBonus = Flair3dHype.playBonus(card, play, max);
            boolean placed = r.positionOk();
            Flair3dEffects.Effect effect = Flair3dEffects.of(r, bonus(slot), placed && player.metamorfoseAllowed(), placed && player.impersonationReady().contains(r.cardId()));
            List<Flair3dPenalties.Penalty> penalties = Flair3dPenalties.of(r, band, max);
            int delta = Flair3dHype.partialShift(r, partial, complete);
            hypeTotal += hypeBonus;
            effectTotal += effect.bonus();
            penaltyTotal += Flair3dPenalties.total(penalties);
            Map<String, Object> view = slotView(r, band, hypeBonus, effect, slot, Flair3dHype.shifted(Flair3dHype.clampMax(band, max), delta), delta);
            view.put("penalties", penalties.stream().map(Flair3dPenalties.Penalty::toMap).toList());
            slots.add(view);
        }
        int sintonia = FlairGameViews.intOf(evaluation.get("sintonia"));
        int sintoniaMax = FlairGameViews.intOf(evaluation.get("sintoniaMax"));
        int scoreMax = sintoniaMax + raw.values().stream().mapToInt(s -> playCap(play) + maxEffect(s)).sum();
        boolean perfect = Boolean.TRUE.equals(evaluation.get("ok")) && sintonia >= 2 * requiredSlots(g);
        return new Score(slots, hypeTotal, effectTotal, penaltyTotal, Flair3dPenalties.score(sintonia, hypeTotal, effectTotal, penaltyTotal), scoreMax, perfect);
    }

    static Map<String, Object> slotView(CbcRules.SlotResult r, Flair3dHype.Band band, int hypeBonus, Flair3dEffects.Effect effect,
                                        Map<String, Object> rawSlot, Flair3dHype.Band match, int delta) {
        Map<String, Object> e = new LinkedHashMap<>();
        e.put("kind", effect.kind().name());
        e.put("bonus", effect.bonus());
        e.put("text", FlairGameViews.effects(rawSlot).get(effect.kind().name().toLowerCase(Locale.ROOT)));
        Map<String, Object> v = new LinkedHashMap<>();
        v.put("slot", r.slot());
        v.put("cardId", r.cardId());
        v.put("hypeBand", band.name());
        v.put("hypeBonus", hypeBonus);
        v.put("effect", e);
        v.put("matchBand", match.name());
        v.put("matchDelta", delta);
        return v;
    }

    @SuppressWarnings("unchecked")
    static Map<String, Object> bonus(Map<String, Object> rawSlot) {
        return rawSlot.get("bonus") instanceof Map<?, ?> b ? (Map<String, Object>) b : Map.of();
    }

    /** Maior bônus de jogada possível por carta na regra de Hype do jogo (para {@code scoreMax}). */
    static int playCap(Map<String, Object> play) {
        String mode = String.valueOf(play.getOrDefault("mode", "NONE")).toUpperCase(Locale.ROOT);
        return switch (mode) {
            case "BONUS_ABOVE_RELEVANT", "DIMENSION" -> Math.max(0, FlairGameViews.intOf(play.getOrDefault("cap", Flair3dHype.DEFAULT_CAP)));
            case "LOW_IS_GOOD" -> Math.max(0, FlairGameViews.intOf(play.getOrDefault("bonus", Flair3dHype.DEFAULT_LOW_BONUS)));
            default -> 0;
        };
    }

    static int maxEffect(Map<String, Object> rawSlot) {
        int best = 0;
        for (Flair3dEffects.Kind k : Flair3dEffects.Kind.values()) {
            best = Math.max(best, Flair3dEffects.bonusOf(bonus(rawSlot), k));
        }
        return best;
    }

    /** Vagas obrigatórias do jogo (as opcionais não contam para o "perfeito"). */
    static int requiredSlots(FlairChallenge g) {
        List<CbcRules.Slot> slots = Json.list(g.getSlotsJson()).stream()
                .map(s -> new CbcRules.Slot(String.valueOf(s.get("key")), FlairChallengeService.position(s.get("position")), FlairChallengeService.accepts(s)))
                .toList();
        return CbcRules.requiredSlots(slots);
    }

    /** Carta pronta para Impersonation: a peça viva tem a aura ligada e o retrato pronto (o serviço ainda confere o nível). */
    static boolean impersonationReady(String backgroundConfigJson) {
        Map<String, Object> cfg = Json.map(backgroundConfigJson);
        return Boolean.TRUE.equals(cfg.get("auraImpersonation")) && cfg.get("impersonationData") instanceof Map<?, ?> d
                && "READY".equals(String.valueOf(d.get("status")));
    }
}
