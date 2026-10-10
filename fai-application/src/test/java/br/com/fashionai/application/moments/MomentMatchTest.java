package br.com.fashionai.application.moments;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Momentos §13–§15 — MomentMatch é um grau com razões, nunca um veredito; a leitura própria do tema conta a favor. */
class MomentMatchTest {
    private final MomentMatch.Context halloween = MomentMatch.context(
            List.of("edgy", "grunge", "vintage", "glam", "minimalist"), List.of("black", "orange", "purple"), List.of("party", "night_out"), List.of(),
            List.of(MomentMatch.interpretation("dark", List.of("edgy", "grunge"), List.of("black")),
                    MomentMatch.interpretation("orange-black", List.of(), List.of("orange", "black")),
                    MomentMatch.interpretation("minimal", List.of("minimalist"), List.of("black"))));

    @Test
    void lookDarkMinimalTemAssociacaoForteEExplicada() {
        MomentMatch.Result r = MomentMatch.score(halloween, MomentMatch.subject(List.of("minimalist", "edgy"), List.of("black", "orange"), List.of("party"), List.of()));
        assertThat(r).isNotNull();
        assertThat(r.score()).isGreaterThanOrEqualTo(80);
        assertThat(r.parts()).containsKeys("styleMatch", "colorMatch", "occasionMatch", "themeMatch");
        assertThat(r.interpretation()).isIn("dark", "minimal", "orange-black");
        assertThat(r.reasons()).anyMatch(x -> x.startsWith("color:"));
    }

    @Test
    void lookDePraiaTemAssociacaoFracaMasNuncaErrado() {
        MomentMatch.Result r = MomentMatch.score(halloween, MomentMatch.subject(List.of("resort", "boho"), List.of("white", "yellow"), List.of("beach"), List.of()));
        assertThat(r).isNotNull();
        assertThat(r.score()).isLessThan(MomentPointsPolicy.RELATED_THRESHOLD);
        assertThat(r.interpretation()).isNull();
    }

    @Test
    void interpretacaoCriativaPremiaEstiloProprioForaDoTema() {
        MomentMatch.Result copy = MomentMatch.score(halloween, MomentMatch.subject(List.of("edgy"), List.of("black"), List.of("party"), List.of()));
        MomentMatch.Result own = MomentMatch.score(halloween, MomentMatch.subject(List.of("edgy", "streetwear", "sporty"), List.of("black"), List.of("party"), List.of()));
        assertThat(own.parts().get("creativeInterpretation")).isGreaterThan(copy.parts().get("creativeInterpretation"));
        assertThat(own.reasons()).anyMatch(x -> x.startsWith("creative:"));
    }

    @Test
    void semBaseDeComparacaoDevolveNulo() {
        assertThat(MomentMatch.score(halloween, MomentMatch.subject(List.of(), List.of(), List.of(), List.of()))).isNull();
        assertThat(MomentMatch.score(MomentMatch.context(List.of(), List.of(), List.of(), List.of(), List.of()), MomentMatch.subject(List.of("edgy"), List.of(), List.of(), List.of()))).isNull();
    }

    @Test
    void hypeContextualDerivaDoGlobalSemSobrescrever() {
        assertThat(MomentService.contextualHype(67.0, 98)).isEqualTo(91);
        assertThat(MomentService.contextualHype(67.0, 31)).isEqualTo(58);
        assertThat(MomentService.contextualHype(null, 90)).isNull();
        assertThat(MomentService.contextualHype(95.0, 100)).isEqualTo(100);
    }
}
