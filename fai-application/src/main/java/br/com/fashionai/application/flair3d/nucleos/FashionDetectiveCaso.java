package br.com.fashionai.application.flair3d.nucleos;

import java.util.List;
import java.util.Set;

/**
 * O caso do FASHION_DETECTIVE (docs/flair/flair-3d/CORES_E_ACOES.md, 2.2): 6 salões fixos, um look por salão. Cada salão
 * tem um código de vestimenta (ocasiões), um limite para o desafio automático e uma carta de pista, que aponta uma peça
 * pela cor e pelo lugar no corpo; quando a pista está guardada num móvel, só quem abre gavetas chega a ela. O mercado
 * fica no mapa entre o salão 3 e o salão 4.
 */
final class FashionDetectiveCaso {
    static final int SALAO_DO_MERCADO = 3;
    static final Set<String> CIMA = Set.of("SUP", "VES");
    static final Set<String> QUALQUER = Set.of("SUP", "INF", "CAL", "ACE", "VES");

    /** Um salão: código, ocasiões aceitas, limite do desafio, cor e vagas da peça da pista, e se a pista está num móvel. */
    record Salao(String codigo, Set<String> ocasioes, int desafio, String cor, Set<String> vagas, boolean movel) {
    }

    static final List<Salao> SALOES = List.of(
            new Salao("ENTRADA_DA_GALA", Set.of("formal", "party"), 50, "Branco", CIMA, true),
            new Salao("SALAO_PRINCIPAL", Set.of("formal", "party", "ceremony"), 55, "Vermelho", QUALQUER, false),
            new Salao("CAMARIM", Set.of("work", "business", "casual"), 50, "Amarelo", Set.of("CAL"), true),
            new Salao("CLUBE_UNDERGROUND", Set.of("night_out", "party", "festival"), 60, "Preto", CIMA, false),
            new Salao("ATELIE", Set.of("work", "business", "casual"), 55, "Azul", Set.of("INF"), true),
            new Salao("ARQUIVO", Set.of("formal", "business", "work"), 65, "Verde", QUALQUER, true));

    private FashionDetectiveCaso() {
    }

    /** O salão de número dado (1 a 6). */
    static Salao salao(int numero) {
        return SALOES.get(numero - 1);
    }
}
