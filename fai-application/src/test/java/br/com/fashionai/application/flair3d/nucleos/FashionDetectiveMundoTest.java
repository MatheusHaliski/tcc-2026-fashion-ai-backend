package br.com.fashionai.application.flair3d.nucleos;

import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * O mundo refeito do FASHION_DETECTIVE (docs/flair/flair-3d/FASHION_DETECTIVE_HISTORIA.md): nove salas, cinco chaves em
 * armários, o jogo sempre se completa (com as chaves dos armários ou com a ajuda da casa) e a acusação decidida aqui.
 */
class FashionDetectiveMundoTest {

    @Test
    void noveSalasCincoChavesEmArmariosCadaUmaAbrindoUmaPortaTrancada() {
        assertThat(FashionDetectiveMundo.SALAS).hasSize(9).contains(FashionDetectiveMundo.INICIO, FashionDetectiveMundo.FINAL);
        assertThat(FashionDetectiveMundo.CHAVES).hasSize(5);
        for (FashionDetectiveMundo.Chave c : FashionDetectiveMundo.CHAVES) {
            assertThat(FashionDetectiveMundo.PORTAS.stream().filter(p -> c.codigo().equals(p.chave()))).hasSize(1);
            assertThat(FashionDetectiveMundo.chaveNoArmario(c.sala(), c.armario())).contains(c);
        }
        assertThat(FashionDetectiveMundo.PORTAS.stream().filter(p -> p.chave() != null)).allMatch(p -> p.ajuda() != null);
    }

    @Test
    void comAsChavesDosArmariosChegaATodasAsSalasEAtePassarela() {
        assertThat(FashionDetectiveMundo.alcancaveis(Set.of(), false, true)).containsExactlyInAnyOrderElementsOf(FashionDetectiveMundo.SALAS);
    }

    @Test
    void semChaveNenhumaAPassarelaFicaFechadaMasAAjudaDaCasaAbreTudo() {
        assertThat(FashionDetectiveMundo.alcancaveis(Set.of(), false, false)).doesNotContain(FashionDetectiveMundo.FINAL);
        assertThat(FashionDetectiveMundo.alcancaveis(Set.of(), true, false)).containsExactlyInAnyOrderElementsOf(FashionDetectiveMundo.SALAS);
    }

    @Test
    void qualquerChaveQueFalteAindaDeixaOJogoCompletavelComAjuda() {
        for (FashionDetectiveMundo.Chave falta : FashionDetectiveMundo.CHAVES) {
            Set<String> tenho = new HashSet<>();
            FashionDetectiveMundo.CHAVES.stream().filter(c -> c != falta).forEach(c -> tenho.add(c.codigo()));
            assertThat(FashionDetectiveMundo.alcancaveis(tenho, true, false)).contains(FashionDetectiveMundo.FINAL);
        }
    }

    @Test
    void cadaChaveFicaNumaSalaAQueSeChegaAntesDaPortaQueElaAbre() {
        for (FashionDetectiveMundo.Chave c : FashionDetectiveMundo.CHAVES) {
            Set<String> semEla = new HashSet<>(List.of("K1", "K2", "K3", "K4", "K5"));
            semEla.remove(c.codigo());
            assertThat(FashionDetectiveMundo.alcancaveis(semEla, false, false)).contains(c.sala());
        }
    }

    @Test
    void acusacaoCulpadoComProvasEhCompletoComPoucasEhParcialErradoRevisaUmaVez() {
        assertThat(FashionDetectiveAcusacao.decidir(2, 9, 1)).isEqualTo(FashionDetectiveAcusacao.Final.COMPLETO);
        assertThat(FashionDetectiveAcusacao.decidir(2, 5, 1)).isEqualTo(FashionDetectiveAcusacao.Final.PARCIAL);
        assertThat(FashionDetectiveAcusacao.decidir(4, 12, 1)).isEqualTo(FashionDetectiveAcusacao.Final.ERRADO_REVER);
        assertThat(FashionDetectiveAcusacao.decidir(4, 12, 2)).isEqualTo(FashionDetectiveAcusacao.Final.ERRADO_REVELA);
        assertThat(FashionDetectiveAcusacao.encerra(FashionDetectiveAcusacao.Final.ERRADO_REVER)).isFalse();
        assertThat(FashionDetectiveAcusacao.encerra(FashionDetectiveAcusacao.Final.PARCIAL)).isTrue();
        assertThatThrownBy(() -> FashionDetectiveAcusacao.decidir(1, 3, 1)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> FashionDetectiveAcusacao.decidir(2, 13, 1)).isInstanceOf(IllegalArgumentException.class);
    }
}
