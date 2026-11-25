package br.com.fashionai.application.flair3d.detetive;

import br.com.fashionai.application.flair.CbcRules;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static br.com.fashionai.application.flair3d.Flair3dFixtures.card;
import static org.assertj.core.api.Assertions.assertThat;

/** O look da gala muda o corpo da detetive no caso: vida máxima, cone dos vigias e tempo do passo. */
class DetetiveDoLookTest {
    @Test
    void semLookFicaComoSempre() {
        assertThat(DetetiveDoLook.de(Map.of())).isEqualTo(DetetiveDoLook.NEUTRO);
        assertThat(DetetiveDoLook.NEUTRO.vidaMaxima()).isEqualTo(DetetiveEstado.VIDA);
    }

    @Test
    void oLookMudaOCorpoDaDetetive() {
        CbcRules.Card tenis = card("CAL", "sub:sneakers", "color:black");
        CbcRules.Card casaco = card("SUP", "sub:coat", "color:black", "material:wool");
        DetetiveDoLook look = DetetiveDoLook.de(Map.of("CAL", tenis, "SUP", casaco));
        // a mudança vem só dos atributos da regra peça-recurso: algo tem de mudar com um look escuro e de tênis
        assertThat(look).isNotEqualTo(DetetiveDoLook.NEUTRO);
        assertThat(look.alcance()).isBetween(DetetiveVigias.ALCANCE * 0.85, DetetiveVigias.ALCANCE * 1.15);
        assertThat(look.segundosPorPasso()).isBetween(DetetivePartida.SEGUNDOS_POR_PASSO - 2, DetetivePartida.SEGUNDOS_POR_PASSO + 2);
    }
}
