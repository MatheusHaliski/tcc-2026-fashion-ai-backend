package br.com.fashionai.application.hype;

import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeMomentum;
import br.com.fashionai.domain.model.enums.HypeStatus;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** RF53 — Selos de Hype FashionAI: códigos derivados do HypeScore v2 atual, limiares e prioridade. */
class HypeSealsTest {

    static HypeScoreCurrent row(double score, HypeLevel level, HypeMomentum momentum, Double longevity, Double rarity) {
        HypeScoreCurrent c = new HypeScoreCurrent();
        c.setEntityType(HypeEntityType.PIECE);
        c.setEntityId(UUID.randomUUID());
        c.setAlgorithmVersion("HYPE_V2");
        c.setStatus(HypeStatus.AVAILABLE);
        c.setScore(BigDecimal.valueOf(score));
        c.setLevel(level);
        c.setMomentum(momentum);
        c.setPublicEligible(true);
        c.getDimensions().setLongevity(longevity == null ? null : BigDecimal.valueOf(longevity));
        c.getDimensions().setRarity(rarity == null ? null : BigDecimal.valueOf(rarity));
        c.setCalculatedAt(Instant.now());
        c.setWindowStart(Instant.now());
        c.setWindowEnd(Instant.now());
        return c;
    }

    @Test
    void viralETrending() {
        assertThat(HypeSeals.of(row(93, HypeLevel.VIRAL, HypeMomentum.STABLE, null, null))).containsExactly("VIRAL");
        assertThat(HypeSeals.of(row(65, HypeLevel.HOT, HypeMomentum.RISING, null, null))).containsExactly("TRENDING");
        assertThat(HypeSeals.of(row(80, HypeLevel.TRENDING, HypeMomentum.EMERGING, null, null))).containsExactly("TRENDING");
        // em alta mas sem subir não é TRENDING
        assertThat(HypeSeals.of(row(65, HypeLevel.HOT, HypeMomentum.STABLE, null, null))).isEmpty();
        // VIRAL não ganha TRENDING (faixa fora de HOT/TRENDING)
        assertThat(HypeSeals.of(row(95, HypeLevel.VIRAL, HypeMomentum.RISING, null, null))).containsExactly("VIRAL");
    }

    @Test
    void emergenteSoQuandoNaoEhViralNemTrending() {
        assertThat(HypeSeals.of(row(45, HypeLevel.RELEVANT, HypeMomentum.EMERGING, null, null))).containsExactly("EMERGING");
        assertThat(HypeSeals.of(row(70, HypeLevel.HOT, HypeMomentum.EMERGING, null, null))).containsExactly("TRENDING");
        assertThat(HypeSeals.of(row(92, HypeLevel.VIRAL, HypeMomentum.EMERGING, null, null))).containsExactly("VIRAL");
    }

    @Test
    void classicoPeloMomentoOuPelaLongevidadeComFaixaMinima() {
        assertThat(HypeSeals.of(row(25, HypeLevel.NICHE, HypeMomentum.CLASSIC, null, null))).containsExactly("CLASSIC");
        assertThat(HypeSeals.of(row(45, HypeLevel.RELEVANT, HypeMomentum.STABLE, HypeSeals.CLASSIC_LONGEVITY_MIN, null))).containsExactly("CLASSIC");
        assertThat(HypeSeals.of(row(30, HypeLevel.NICHE, HypeMomentum.STABLE, 90.0, null))).isEmpty();          // faixa abaixo de RELEVANT
        assertThat(HypeSeals.of(row(70, HypeLevel.HOT, HypeMomentum.STABLE, 69.9, null))).isEmpty();            // longevidade abaixo do limiar
    }

    @Test
    void raroPelaRaridadeComFaixaMinima() {
        assertThat(HypeSeals.of(row(22, HypeLevel.NICHE, HypeMomentum.STABLE, null, HypeSeals.RARE_RARITY_MIN))).containsExactly("RARE");
        assertThat(HypeSeals.of(row(10, HypeLevel.LOW_SIGNAL, HypeMomentum.STABLE, null, 99.0))).isEmpty();      // raro mas sem tração
        assertThat(HypeSeals.of(row(50, HypeLevel.RELEVANT, HypeMomentum.STABLE, null, 74.9))).isEmpty();
    }

    @Test
    void prioridadeEMaximoNoCard() {
        HypeScoreCurrent all = row(70, HypeLevel.HOT, HypeMomentum.RISING, 80.0, 90.0);
        assertThat(HypeSeals.of(all)).containsExactly("TRENDING", "CLASSIC", "RARE");
        assertThat(HypeSeals.forCard(all)).containsExactly("TRENDING", "CLASSIC");
        assertThat(HypeSeals.CARD_MAX).isEqualTo(2);
        assertThat(HypeSeals.of(row(96, HypeLevel.VIRAL, HypeMomentum.CLASSIC, 75.0, 80.0))).containsExactly("VIRAL", "CLASSIC", "RARE");
        assertThat(HypeSeals.CODES).containsExactly("VIRAL", "TRENDING", "EMERGING", "CLASSIC", "RARE");
    }

    @Test
    void semHypePublicoDisponivelNaoHaSelo() {
        HypeScoreCurrent priv = row(95, HypeLevel.VIRAL, HypeMomentum.RISING, 90.0, 90.0);
        priv.setPublicEligible(false);                                   // peça privada: score estrutural, sem selo
        assertThat(HypeSeals.of(priv)).isEmpty();
        HypeScoreCurrent insufficient = row(0, HypeLevel.VIRAL, HypeMomentum.RISING, null, null);
        insufficient.setStatus(HypeStatus.INSUFFICIENT_DATA);
        insufficient.setScore(null);
        assertThat(HypeSeals.of(insufficient)).isEmpty();
        assertThat(HypeSeals.of(null)).isEmpty();
    }

    @Test
    void progressoTrazTodosOsCodigosComCriterioTraduzido() {
        int[] t = HypeScoreConfig.defaults().levelThresholds();
        List<Map<String, Object>> p = HypeSeals.progress(row(65, HypeLevel.HOT, HypeMomentum.RISING, null, 80.0), t);
        assertThat(p).extracting(m -> m.get("code")).containsExactly("VIRAL", "TRENDING", "EMERGING", "CLASSIC", "RARE");
        assertThat(p).extracting(m -> m.get("earned")).containsExactly(false, true, false, false, true);
        assertThat(p.get(0).get("criteria")).isEqualTo("Nível Viral (≥ 90)");
        assertThat(p.get(1).get("criteria")).isEqualTo("Nível Em alta ou Tendência (≥ 60) e em crescimento ou emergente");
        assertThat(p.get(3).get("criteria")).isEqualTo("Momento clássico, ou longevidade ≥ 70 com nível Relevante ou acima (≥ 40)");
        assertThat(p.get(4).get("criteria")).isEqualTo("Raridade ≥ 75 com nível Nicho ou acima (≥ 20)");
        // sem Hype: nada conquistado, critérios continuam visíveis ("o que falta")
        assertThat(HypeSeals.progress(null, t)).extracting(m -> m.get("earned")).containsOnly(false);
    }
}
