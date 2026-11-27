package br.com.fashionai.application.flair3d;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Corpo da entrega de uma partida: cartas por vaga, zonas do editor (cor hex e acabamento), maquiagem por área (família
 * e acabamento) e a resposta (PERSONAGEM_FILME: o título; SUPER_HEROI: o emblema). Tudo opcional.
 */
public record Entrega(Map<String, UUID> cartas, Map<String, Zona> zonas, Map<String, Maquiagem> maquiagem, String resposta) {
    public Entrega {
        cartas = cartas == null ? Map.of() : new LinkedHashMap<>(cartas);
        zonas = zonas == null ? Map.of() : new LinkedHashMap<>(zonas);
        maquiagem = maquiagem == null ? Map.of() : new LinkedHashMap<>(maquiagem);
    }

    /** Cor (hex, #RRGGBB) e acabamento (FOSCO, BRILHANTE, METALICO, ESPELHADO) de uma zona. */
    public record Zona(String cor, String acabamento) {
    }

    /** Família de cor (CORAL, NUDE...) e acabamento (FOSCO, CETIM, GLOSS) de uma área do rosto. */
    public record Maquiagem(String familia, String acabamento) {
    }
}
