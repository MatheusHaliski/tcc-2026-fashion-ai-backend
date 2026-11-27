package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.flair.CbcRules;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;
import java.util.function.Function;

/**
 * O que o núcleo recebe além da entrega: as cartas da pessoa no formato do motor (por id), o país de uma marca (código
 * ISO de 2 letras, ou nulo), o sorteio da partida, semeado com a semente dela, o andamento (tentativa, acionamentos e
 * rodada), a própria semente, de onde saem os sorteios por assunto (nula fora de uma partida: a tela do deck), e as
 * cartas do deck da partida (o estoque de onde o jogo tira o look-alvo).
 */
public record Contexto(Map<UUID, CbcRules.Card> cartas, Function<String, String> paisDaMarca, Random sorteio, Andamento andamento,
                       Long semente, Map<UUID, CbcRules.Card> deck) {
    public static final String BRASIL = "BR";

    public Contexto(Map<UUID, CbcRules.Card> cartas, Function<String, String> paisDaMarca, Random sorteio, Andamento andamento) {
        this(cartas, paisDaMarca, sorteio, andamento, null, null);
    }

    public Contexto(Map<UUID, CbcRules.Card> cartas, Function<String, String> paisDaMarca, Random sorteio) {
        this(cartas, paisDaMarca, sorteio, Andamento.INICIO);
    }

    public Contexto {
        cartas = cartas == null ? Map.of() : cartas;
        paisDaMarca = paisDaMarca == null ? marca -> null : paisDaMarca;
        sorteio = sorteio == null ? new Random(0) : sorteio;
        andamento = andamento == null ? Andamento.INICIO : andamento;
        deck = deck == null ? cartas : deck;
    }

    public Contexto comAndamento(Andamento novo) {
        return new Contexto(cartas, paisDaMarca, sorteio, novo, semente, deck);
    }

    /** O mesmo contexto na rodada dada (o andamento guarda a rodada da partida). */
    public Contexto naRodada(String rodada) {
        return comAndamento(andamento.comRodada(rodada));
    }

    public Contexto comSemente(long nova) {
        return new Contexto(cartas, paisDaMarca, new Random(nova), andamento, nova, deck);
    }

    public Contexto comDeck(Map<UUID, CbcRules.Card> novo) {
        return new Contexto(cartas, paisDaMarca, sorteio, andamento, semente, novo);
    }

    /** A rodada da partida; nula quando a partida não escolheu (vale o objetivo mais simples do jogo). */
    public String rodada() {
        return andamento.rodada();
    }

    /** Há uma partida aberta (com semente)? Fora dela, o que depende de sorteio ainda não foi revelado. */
    public boolean emPartida() {
        return semente != null;
    }

    /**
     * Sorteio próprio de um assunto da partida ("tema", "rival"): sai da semente e do nome, então a prévia, a entrega e
     * a revisão tiram sempre os mesmos valores, em qualquer ordem de chamada.
     */
    public Random sorteio(String nome) {
        return new Random(misturar((semente == null ? 0L : semente) * 31 + nome.hashCode()));
    }

    /** Espalha os bits da semente: sementes vizinhas passam a dar sorteios sem relação entre si. */
    static long misturar(long x) {
        long z = x + 0x9E3779B97F4A7C15L;
        z = (z ^ (z >>> 30)) * 0xBF58476D1CE4E5B9L;
        z = (z ^ (z >>> 27)) * 0x94D049BB133111EBL;
        return z ^ (z >>> 31);
    }

    /** Um item da lista, tirado no sorteio do assunto. */
    public <T> T sortear(String nome, List<T> opcoes) {
        return opcoes.get(sorteio(nome).nextInt(opcoes.size()));
    }

    /** Os primeiros {@code quantos} itens da lista embaralhada no sorteio do assunto (sem repetir). */
    public <T> List<T> sortear(String nome, List<T> opcoes, int quantos) {
        List<T> copia = new ArrayList<>(opcoes);
        Collections.shuffle(copia, sorteio(nome));
        return List.copyOf(copia.subList(0, Math.min(quantos, copia.size())));
    }

    /** As cartas entregues por vaga (vagas sem carta conhecida ficam de fora). */
    public Map<String, CbcRules.Card> vestidas(Entrega entrega) {
        Map<String, CbcRules.Card> out = new LinkedHashMap<>();
        entrega.cartas().forEach((vaga, id) -> {
            CbcRules.Card c = id == null ? null : cartas.get(id);
            if (c != null) {
                out.put(vaga, c);
            }
        });
        return out;
    }

    public boolean brasileira(CbcRules.Card c) {
        return c != null && c.brand() != null && BRASIL.equalsIgnoreCase(paisDaMarca.apply(c.brand()));
    }
}
