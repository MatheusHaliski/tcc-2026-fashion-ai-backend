package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.common.Json;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Andamento de uma partida (coluna {@code estado_json}): quantas entregas já foram apresentadas, contando a atual, e os
 * acionamentos feitos depois da entrega, na ordem. O núcleo recalcula a partida inteira a partir da semente, da entrega e
 * deste andamento, então o resultado de cada etapa é sempre o mesmo.
 */
public record Andamento(int tentativas, List<Acionamento> acionamentos) {
    /** Primeira entrega, sem acionamento. */
    public static final Andamento INICIO = new Andamento(1, List.of());

    public Andamento {
        acionamentos = acionamentos == null ? List.of() : List.copyOf(acionamentos);
    }

    /** O andamento gravado na partida; partida nova ainda não tem tentativa. */
    public static Andamento ler(String json) {
        Andamento a = Json.read(json, Andamento.class);
        return a == null ? new Andamento(0, List.of()) : a;
    }

    /** Com os acionamentos dados, na primeira tentativa (partidas em etapas). */
    public static Andamento de(Acionamento... acionamentos) {
        return new Andamento(1, List.of(acionamentos));
    }

    public Andamento proximaTentativa() {
        return new Andamento(tentativas + 1, List.of());
    }

    public Andamento com(Acionamento novo) {
        List<Acionamento> out = new ArrayList<>(acionamentos);
        out.add(novo);
        return new Andamento(tentativas, out);
    }

    /** Todas as cartas usadas nos acionamentos. */
    public List<UUID> cartas() {
        return acionamentos.stream().flatMap(a -> a.cartas().stream()).toList();
    }
}
