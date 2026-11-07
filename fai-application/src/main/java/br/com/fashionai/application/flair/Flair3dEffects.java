package br.com.fashionai.application.flair;

import br.com.fashionai.application.flair.CbcRules.SlotResult;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import static br.com.fashionai.application.flair.CbcRules.intOf;

/**
 * FLAIR 3D MAKE UP — o efeito de cada vaga preenchida, puro: IMPERSONATION quando a carta está pronta para impersonação (o
 * chamador já conferiu o nível e a permissão da aura), senão METAMORFOSE quando a Metamorfose é permitida e a vaga tem
 * sintonia ≥ 2, senão COMUM. O bônus vem de {@code slots_json[].bonus[kind]} (padrão comum 0, metamorfose 1,
 * impersonation 2). Vaga vazia = COMUM sem bônus.
 */
public final class Flair3dEffects {
    private Flair3dEffects() {
    }

    public enum Kind { COMUM, METAMORFOSE, IMPERSONATION }

    public static final Map<Kind, Integer> DEFAULT_BONUS = Map.of(Kind.COMUM, 0, Kind.METAMORFOSE, 1, Kind.IMPERSONATION, 2);

    public record Effect(String slot, Kind kind, int bonus) {
        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("slot", slot);
            m.put("kind", kind.name());
            m.put("bonus", bonus);
            return m;
        }
    }

    public static Effect of(SlotResult r, Map<String, Object> slotBonus, boolean metamorfoseAllowed, boolean impersonationReady) {
        if (r == null || r.cardId() == null) {
            return new Effect(r == null ? null : r.slot(), Kind.COMUM, 0);
        }
        Kind kind = impersonationReady ? Kind.IMPERSONATION
                : metamorfoseAllowed && r.sintonia() >= 2 ? Kind.METAMORFOSE
                : Kind.COMUM;
        return new Effect(r.slot(), kind, bonusOf(slotBonus, kind));
    }

    public static int bonusOf(Map<String, Object> slotBonus, Kind kind) {
        Object v = slotBonus == null ? null : slotBonus.get(kind.name().toLowerCase(Locale.ROOT));
        return Math.max(0, intOf(v, DEFAULT_BONUS.get(kind)));
    }

    /**
     * Efeitos das vagas preenchidas, na ordem das vagas. {@code bonusBySlot} = chave da vaga → {@code bonus} da vaga;
     * {@code impersonationReadySlots} = vagas cuja carta está pronta para impersonação (já com nível e aura conferidos).
     */
    public static List<Effect> all(List<SlotResult> results, Map<String, Map<String, Object>> bonusBySlot, boolean metamorfoseAllowed,
                                   Set<String> impersonationReadySlots) {
        List<Effect> out = new ArrayList<>();
        Set<String> ready = impersonationReadySlots == null ? Set.of() : impersonationReadySlots;
        for (SlotResult r : results == null ? List.<SlotResult>of() : results) {
            if (r.cardId() == null) {
                continue;
            }
            Map<String, Object> bonus = bonusBySlot == null ? null : bonusBySlot.get(r.slot());
            out.add(of(r, bonus, metamorfoseAllowed, ready.contains(r.slot())));
        }
        return out;
    }

    public static int total(List<Effect> effects) {
        return effects == null ? 0 : effects.stream().mapToInt(Effect::bonus).sum();
    }
}
