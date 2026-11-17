package br.com.fashionai.application.atelierproject;

import br.com.fashionai.application.atelierproject.AtelierProjectViews.Measurement;
import br.com.fashionai.application.atelierproject.AtelierProjectViews.Specification;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Ficha técnica completa: família, modelagem, tecido e medidas com ponto, protocolo e valor positivo. */
class TechPackCompletenessTest {

    private static Specification spec(String family, String modeling, String fabric, List<Measurement> measurements) {
        return new Specification(family, modeling, fabric, null, null, null, null, null, null, null, null, null, null, null, measurements);
    }

    private static Measurement tórax(String cm) {
        return new Measurement("Tórax", "meia circunferência a 2 cm da cava", cm == null ? null : new BigDecimal(cm));
    }

    @Test
    void fichaCompletaNaoTemPendencias() {
        assertThat(TechPackCompleteness.missing(spec("Camisa", "Reta", "Tricoline", List.of(tórax("56.5"))))).isEmpty();
    }

    @Test
    void fichaVaziaApontaTudoNaOrdem() {
        assertThat(TechPackCompleteness.missing(spec(null, " ", "", null)))
                .containsExactly("family", "modeling", "fabric", "measurements");
    }

    @Test
    void listaDeMedidasVaziaContaComoPendente() {
        assertThat(TechPackCompleteness.missing(spec("Camisa", "Reta", "Tricoline", List.of()))).containsExactly("measurements");
    }

    @Test
    void umaMedidaIncompletaBastaParaPendenciaDeMedidas() {
        List<Measurement> zero = List.of(tórax("56.5"), tórax("0"));
        List<Measurement> negativa = List.of(tórax("-1"));
        List<Measurement> semValor = List.of(tórax(null));
        List<Measurement> semProtocolo = List.of(new Measurement("Tórax", " ", new BigDecimal("50")));
        List<Measurement> comNula = new ArrayList<>();
        comNula.add(null);
        for (List<Measurement> medidas : List.of(zero, negativa, semValor, semProtocolo, comNula)) {
            assertThat(TechPackCompleteness.missing(spec("Camisa", "Reta", "Tricoline", medidas))).containsExactly("measurements");
        }
    }
}
