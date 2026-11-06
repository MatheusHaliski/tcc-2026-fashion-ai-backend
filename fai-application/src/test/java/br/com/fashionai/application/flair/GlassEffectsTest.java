package br.com.fashionai.application.flair;

import br.com.fashionai.application.flair.GlassEffects.Effect;
import br.com.fashionai.application.flair.GlassEffects.Kind;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Glass Empire — efeito por vaga (Comum, Metamorfose, Impersonation), bônus por vaga e total. */
class GlassEffectsTest {
    private static CbcRules.SlotResult slot(String key, boolean filled, int sintonia) {
        return new CbcRules.SlotResult(key, "SUP", filled ? UUID.randomUUID() : null, sintonia > 0, sintonia > 1, sintonia > 2, sintonia);
    }

    @Test
    void tipoDoEfeitoPorPermissaoESintonia() {
        assertThat(GlassEffects.of(slot("a", true, 3), null, false, false).kind()).isEqualTo(Kind.COMUM);
        assertThat(GlassEffects.of(slot("a", true, 1), null, true, false).kind()).isEqualTo(Kind.COMUM);
        assertThat(GlassEffects.of(slot("a", true, 2), null, true, false).kind()).isEqualTo(Kind.METAMORFOSE);
        assertThat(GlassEffects.of(slot("a", true, 3), null, true, false).kind()).isEqualTo(Kind.METAMORFOSE);
        // impersonação pronta vence, mesmo sem sintonia (o chamador já conferiu nível e aura)
        assertThat(GlassEffects.of(slot("a", true, 0), null, false, true).kind()).isEqualTo(Kind.IMPERSONATION);
        assertThat(GlassEffects.of(slot("a", true, 3), null, true, true).kind()).isEqualTo(Kind.IMPERSONATION);
        // vaga vazia: comum, sem bônus, mesmo com bônus configurado
        Effect vazia = GlassEffects.of(slot("a", false, 0), Map.of("comum", 5), true, true);
        assertThat(vazia).isEqualTo(new Effect("a", Kind.COMUM, 0));
        assertThat(GlassEffects.of(null, null, true, true)).isEqualTo(new Effect(null, Kind.COMUM, 0));
    }

    @Test
    void bonusPadraoEDaVaga() {
        assertThat(GlassEffects.of(slot("a", true, 1), null, true, false).bonus()).isZero();
        assertThat(GlassEffects.of(slot("a", true, 2), null, true, false).bonus()).isEqualTo(1);
        assertThat(GlassEffects.of(slot("a", true, 2), Map.of(), false, true).bonus()).isEqualTo(2);
        Map<String, Object> bonus = Map.of("comum", 1, "metamorfose", 2, "impersonation", 3);
        assertThat(GlassEffects.of(slot("a", true, 1), bonus, true, false).bonus()).isEqualTo(1);
        assertThat(GlassEffects.of(slot("a", true, 2), bonus, true, false).bonus()).isEqualTo(2);
        assertThat(GlassEffects.of(slot("a", true, 2), bonus, true, true).bonus()).isEqualTo(3);
        // só a chave em minúsculas vale; valor não numérico ou negativo cai no padrão / em zero
        assertThat(GlassEffects.bonusOf(Map.of("METAMORFOSE", 9), Kind.METAMORFOSE)).isEqualTo(1);
        assertThat(GlassEffects.bonusOf(Map.of("metamorfose", "9"), Kind.METAMORFOSE)).isEqualTo(1);
        assertThat(GlassEffects.bonusOf(Map.of("impersonation", -4), Kind.IMPERSONATION)).isZero();
        assertThat(GlassEffects.bonusOf(null, Kind.IMPERSONATION)).isEqualTo(2);
        assertThat(GlassEffects.DEFAULT_BONUS).containsEntry(Kind.COMUM, 0).containsEntry(Kind.METAMORFOSE, 1).containsEntry(Kind.IMPERSONATION, 2);
    }

    @Test
    void todasAsVagasPreenchidasNaOrdemETotal() {
        List<CbcRules.SlotResult> results = List.of(slot("a", true, 3), slot("b", false, 0), slot("c", true, 1), slot("d", true, 2));
        Map<String, Map<String, Object>> bonusBySlot = Map.of("a", Map.of("metamorfose", 4), "d", Map.of("impersonation", 6));

        List<Effect> loft = GlassEffects.all(results, bonusBySlot, true, Set.of("d"));
        assertThat(loft).extracting(Effect::slot).containsExactly("a", "c", "d");
        assertThat(loft).extracting(Effect::kind).containsExactly(Kind.METAMORFOSE, Kind.COMUM, Kind.IMPERSONATION);
        assertThat(loft).extracting(Effect::bonus).containsExactly(4, 0, 6);
        assertThat(GlassEffects.total(loft)).isEqualTo(10);

        List<Effect> estreia = GlassEffects.all(results, bonusBySlot, false, null);
        assertThat(estreia).extracting(Effect::kind).containsOnly(Kind.COMUM);
        assertThat(GlassEffects.total(estreia)).isZero();

        List<Effect> semBonus = GlassEffects.all(results, null, true, Set.of("a", "zz"));
        assertThat(semBonus).extracting(Effect::kind).containsExactly(Kind.IMPERSONATION, Kind.COMUM, Kind.METAMORFOSE);
        assertThat(GlassEffects.total(semBonus)).isEqualTo(3);
        assertThat(GlassEffects.all(null, null, true, null)).isEmpty();
        assertThat(GlassEffects.total(null)).isZero();
        assertThat(loft.get(0).toMap()).containsEntry("slot", "a").containsEntry("kind", "METAMORFOSE").containsEntry("bonus", 4);
    }
}
