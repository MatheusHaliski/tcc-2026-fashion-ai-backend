package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.common.Json;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Andamento de uma partida (coluna {@code estado_json}): quantas entregas já foram apresentadas, contando a atual, e os
 * acionamentos feitos depois da entrega, na ordem. O núcleo recalcula a partida inteira a partir da semente, da entrega e
 * deste andamento, então o resultado de cada etapa é sempre o mesmo.
 */
public record Andamento(int tentativas, List<Acionamento> acionamentos, List<Etapa> anteriores) {
    /** Primeira entrega, sem acionamento. */
    public static final Andamento INICIO = new Andamento(1, List.of());

    /** Uma entrega anterior da mesma partida (FASHION_DETECTIVE: um salão já jogado): o look e o que foi acionado nele. */
    public record Etapa(Map<String, UUID> cartas, List<Acionamento> acionamentos) {
        public Etapa {
            cartas = cartas == null ? Map.of() : Map.copyOf(cartas);
            acionamentos = acionamentos == null ? List.of() : List.copyOf(acionamentos);
        }
    }

    public Andamento {
        acionamentos = acionamentos == null ? List.of() : List.copyOf(acionamentos);
        anteriores = anteriores == null ? List.of() : List.copyOf(anteriores);
    }

    public Andamento(int tentativas, List<Acionamento> acionamentos) {
        this(tentativas, acionamentos, List.of());
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
        return new Andamento(tentativas + 1, List.of(), anteriores);
    }

    /** A próxima entrega, guardando a que veio antes (nula na primeira) como etapa já jogada. */
    public Andamento proximaTentativa(Entrega anterior) {
        if (tentativas == 0 || anterior == null) {
            return proximaTentativa();
        }
        List<Etapa> out = new ArrayList<>(anteriores);
        out.add(new Etapa(anterior.cartas(), acionamentos));
        return new Andamento(tentativas + 1, List.of(), out);
    }

    public Andamento com(Acionamento novo) {
        List<Acionamento> out = new ArrayList<>(acionamentos);
        out.add(novo);
        return new Andamento(tentativas, out, anteriores);
    }

    /** Todas as cartas usadas nos acionamentos e nas etapas anteriores. */
    public List<UUID> cartas() {
        List<UUID> out = new ArrayList<>();
        for (Etapa e : anteriores) {
            out.addAll(e.cartas().values());
            e.acionamentos().forEach(a -> out.addAll(a.cartas()));
        }
        acionamentos.forEach(a -> out.addAll(a.cartas()));
        return out;
    }
}
