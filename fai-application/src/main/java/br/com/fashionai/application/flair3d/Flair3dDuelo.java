package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.flair.CbcRules;

import java.util.Collection;
import java.util.List;
import java.util.Map;

/**
 * Duelo por turnos entre duas pessoas num jogo do FLAIR 3D (PLANO A1, modo TURNOS). Strategy por jogo: o servidor
 * refaz o duelo inteiro a partir dos lances gravados dos dois lados (como a retomada refaz a partida pelos
 * acionamentos), então o julgamento é determinístico, não depende da ordem em que os lances chegaram e nenhum lado
 * escolhe a nota. Cada lance é um mapa vaga → carta (Batalha: o look da rodada; Dress Fighter e Sports: a carta do
 * lance na vaga {@value #CARTA}). Implementações puras.
 */
public interface Flair3dDuelo {
    /** A vaga única dos jogos de uma carta por lance. */
    String CARTA = "CARTA";
    String DE = "DE";
    String PARA = "PARA";
    String EMPATE = "EMPATE";

    /** O código do núcleo. */
    String jogo();

    /** A rodada do núcleo em que o duelo acontece (o deck da sala segue as regras dela). */
    String rodada();

    /** Quantos turnos tem o duelo (pode acabar antes, como no nocaute). */
    int turnos();

    /** As vagas aceitas num lance. */
    List<String> vagas();

    /** Quantas cartas o lance precisa, no mínimo (0 = pode passar a vez sem carta). */
    int minimo();

    /** A carta pode voltar num turno seguinte? (nos de uma carta por lance, cada carta vale uma vez) */
    boolean repete();

    /** Julga os turnos completos (os dois lados lançaram) e diz se o duelo acabou e quem venceu. */
    Placar julgar(Contexto contexto, Lado de, Lado para);

    /** Um lado do duelo: o deck que a pessoa levou para a sala e os lances gravados, em ordem. */
    record Lado(Collection<CbcRules.Card> deck, List<Map<String, CbcRules.Card>> lances) {
    }

    /**
     * O duelo julgado: um item por turno com o que a tela mostra dos dois lados; os pontos de cada lado (a soma da
     * Batalha, a vida do Dress Fighter, os gols do Sports); se acabou e quem venceu (DE, PARA ou EMPATE).
     */
    record Placar(List<Map<String, Object>> turnos, int de, int para, boolean encerrado, String vencedor) {
    }
}
