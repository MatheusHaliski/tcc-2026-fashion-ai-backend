package br.com.fashionai.application.aura;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import br.com.fashionai.application.aura.AuraUnlocks.Family;
import br.com.fashionai.application.aura.AuraUnlocks.Item;
import br.com.fashionai.application.aura.AuraUnlocks.Kind;
import br.com.fashionai.application.aura.AuraUnlocks.Result;
import br.com.fashionai.application.aura.AuraUnlocks.State;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeStatus;

import static org.assertj.core.api.Assertions.assertThat;

/** Circuito Aura — modelo de leitura "O que este card destrava": cada tipo de item, cada estado do Hype e a próxima faixa. */
class AuraUnlocksTest {
    private static final int[] THRESHOLDS = HypeScoreConfig.defaults().levelThresholds();

    static State hot() {
        return new State(HypeStatus.AVAILABLE, 64.0, HypeLevel.HOT, true, true);
    }

    @Test
    void separaODestravadoDoQueVemASeguirEOrdenaPelaFaixaMaisProxima() {
        State state = hot();
        List<Item> candidates = List.of(
                AuraUnlocks.byLevel(Kind.COUPON, Family.HYPE, "Cupom viral", "d", "/coupons", HypeLevel.VIRAL, state),
                AuraUnlocks.byLevel(Kind.COUPON, Family.HYPE, "Cupom em alta", "d", "/coupons", HypeLevel.HOT, state),
                AuraUnlocks.byLevel(Kind.SEAL_CAMPAIGN, Family.HYPE, "Campanha", "d", "/brands/x", HypeLevel.TRENDING, state),
                new Item(Kind.FLAIR_BAND, Family.HYPE, "Joga como Em alta", "d", "/flair/3d", null, true),
                new Item(Kind.MILESTONE_POINTS, Family.HYPE, "+20", "d", "/points", HypeLevel.HOT, true),
                new Item(Kind.AURA_REWARD, Family.METAMORPHOSE, "Prisma âmbar", "d", "/arts-store", HypeLevel.TRENDING, false));

        Result r = AuraUnlocks.assemble(state, THRESHOLDS, candidates);

        assertThat(r.unlocked()).extracting(Item::title).containsExactly("Cupom em alta", "Joga como Em alta", "+20");
        assertThat(r.next()).extracting(Item::title).containsExactly("Campanha", "Prisma âmbar", "Cupom viral");
        assertThat(r.next()).extracting(Item::kind).contains(Kind.AURA_REWARD);
        assertThat(r.nextLevel().level()).isEqualTo(HypeLevel.TRENDING);
        assertThat(r.nextLevel().missingPoints()).isEqualTo(11.0);
    }

    @Test
    void aVisaoLevaTipoFamiliaFaixaExigidaEEstado() {
        State state = hot();
        Map<String, Object> view = AuraUnlocks.assemble(state, THRESHOLDS,
                List.of(AuraUnlocks.byLevel(Kind.AURA_REWARD, Family.METAMORPHOSE, "Prisma", "arte", "/arts-store", HypeLevel.VIRAL, state))).view();

        assertThat(view).containsEntry("status", "AVAILABLE").containsEntry("level", "HOT").containsEntry("score", 64.0)
                .containsEntry("counts", true).containsEntry("stale", false);
        assertThat(view.get("unlocked")).isEqualTo(List.of());
        @SuppressWarnings("unchecked")
        Map<String, Object> item = ((List<Map<String, Object>>) view.get("next")).get(0);
        assertThat(item).containsEntry("kind", "AURA_REWARD").containsEntry("family", "METAMORPHOSE").containsEntry("requiredLevel", "VIRAL")
                .containsEntry("met", false).containsEntry("href", "/arts-store");
    }

    @Test
    void dadosInsuficientesOuNaoCalculadoNuncaViramZero() {
        State insuficiente = new State(HypeStatus.INSUFFICIENT_DATA, 0.0, null, true, true);
        State semLinha = new State(null, null, null, false, false);

        for (State s : List.of(insuficiente, semLinha)) {
            Map<String, Object> view = AuraUnlocks.assemble(s, THRESHOLDS, List.of()).view();
            assertThat(view.get("score")).isNull();
            assertThat(view.get("level")).isNull();
            assertThat(view.get("nextLevel")).isNull();
            assertThat(s.counts()).isFalse();
        }
        assertThat(insuficiente.view()).containsEntry("status", "INSUFFICIENT_DATA");
        assertThat(semLinha.view()).containsEntry("status", "NOT_CALCULATED");
    }

    @Test
    void hypePrivadoOuDesatualizadoNaoDestravaMasMostraAFaixaPessoal() {
        State privado = new State(HypeStatus.AVAILABLE, 80.0, HypeLevel.TRENDING, false, true);
        State velho = new State(HypeStatus.AVAILABLE, 80.0, HypeLevel.TRENDING, true, false);

        for (State s : List.of(privado, velho)) {
            assertThat(s.effectiveLevel()).isNull();
            assertThat(AuraUnlocks.byLevel(Kind.COUPON, Family.HYPE, "c", "d", "/coupons", HypeLevel.HOT, s).met()).isFalse();
            assertThat(s.view()).containsEntry("level", "TRENDING").containsEntry("counts", false);
        }
        assertThat(velho.view()).containsEntry("stale", true);
        assertThat(privado.view()).containsEntry("publicEligible", false);
    }

    @Test
    void proximaFaixaUsaOsLimiaresRecebidosEAcabaNoViral() {
        assertThat(AuraUnlocks.nextLevel(new State(HypeStatus.AVAILABLE, 12.3, HypeLevel.LOW_SIGNAL, true, true), THRESHOLDS))
                .isEqualTo(new AuraUnlocks.NextLevel(HypeLevel.NICHE, 7.7));
        assertThat(AuraUnlocks.nextLevel(new State(HypeStatus.AVAILABLE, 95.0, HypeLevel.VIRAL, true, true), THRESHOLDS)).isNull();
        // escala configurada diferente da padrão: nada de segunda régua fixa no código
        int[] outra = {10, 30, 50, 70, 85};
        assertThat(AuraUnlocks.nextLevel(hot(), outra)).isEqualTo(new AuraUnlocks.NextLevel(HypeLevel.TRENDING, 6.0));
    }

    @Test
    void semExigenciaAtendeSempreESemFaixaNuncaAtende() {
        assertThat(AuraUnlocks.meets(null, null)).isTrue();
        assertThat(AuraUnlocks.meets(HypeLevel.NICHE, null)).isFalse();
        assertThat(AuraUnlocks.meets(HypeLevel.HOT, HypeLevel.VIRAL)).isTrue();
        assertThat(AuraUnlocks.meets(HypeLevel.VIRAL, HypeLevel.HOT)).isFalse();
    }
}
