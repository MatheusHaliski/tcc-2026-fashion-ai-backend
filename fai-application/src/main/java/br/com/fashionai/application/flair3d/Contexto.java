package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.flair.CbcRules;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Random;
import java.util.UUID;
import java.util.function.Function;

/**
 * O que o núcleo recebe além da entrega: as cartas da pessoa no formato do motor (por id), o país de uma marca (código
 * ISO de 2 letras, ou nulo), o sorteio da partida, semeado com a semente dela, e o andamento (tentativa e acionamentos).
 */
public record Contexto(Map<UUID, CbcRules.Card> cartas, Function<String, String> paisDaMarca, Random sorteio, Andamento andamento) {
    public static final String BRASIL = "BR";

    public Contexto(Map<UUID, CbcRules.Card> cartas, Function<String, String> paisDaMarca, Random sorteio) {
        this(cartas, paisDaMarca, sorteio, Andamento.INICIO);
    }

    public Contexto {
        cartas = cartas == null ? Map.of() : cartas;
        paisDaMarca = paisDaMarca == null ? marca -> null : paisDaMarca;
        sorteio = sorteio == null ? new Random(0) : sorteio;
        andamento = andamento == null ? Andamento.INICIO : andamento;
    }

    public Contexto comAndamento(Andamento novo) {
        return new Contexto(cartas, paisDaMarca, sorteio, novo);
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
