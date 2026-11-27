package br.com.fashionai.application.flair3d;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Quem entra na cena de um núcleo (BASE_NUCLEOS.md, "Os avatares de cada partida"): no solo desta base, o avatar do
 * perfil (PROPRIO) ou a modelo da casa, e figurantes sem rosto; {@code online} descreve as variações futuras (nulo
 * quando o núcleo não tem). Entradas com o mesmo papel são alternativas (PROPRIO ou MODELO_CASA como PROTAGONISTA).
 */
public record Avatares(List<Solo> solo, Online online) {
    public static final String PROPRIO = "PROPRIO";
    public static final String MODELO_CASA = "MODELO_CASA";
    public static final String OUTRO_JOGADOR = "OUTRO_JOGADOR";
    public static final String FIGURANTE = "FIGURANTE";
    public static final String PROTAGONISTA = "PROTAGONISTA";
    /** Times da cena: A é o da pessoa; B, o do oponente ou adversário. */
    public static final Map<String, String> TIME_POR_PAPEL = Map.of(PROTAGONISTA, "A", "COLEGA", "A", "OPONENTE", "B", "ADVERSARIO", "B");

    public Avatares {
        solo = List.copyOf(solo);
    }

    public record Solo(String tipo, String papel, int quantidade) {
    }

    /** Partida online: mínimo e máximo de outras pessoas e quantas por time (nulo quando não há times). */
    public record Online(int min, int max, Integer porTime) {
    }

    /** Participante gravado na partida: tipo de avatar, papel, time (ou nulo) e a pessoa (só nos avatares de perfil). */
    public record Participante(String tipo, String papel, String time, UUID userId) {
    }

    /** O protagonista (o próprio avatar) e figurantes extras. */
    public static Avatares solo(Online online, Solo... figurantes) {
        List<Solo> out = new ArrayList<>();
        out.add(new Solo(PROPRIO, PROTAGONISTA, 1));
        out.addAll(List.of(figurantes));
        return new Avatares(out, online);
    }

    public static Solo figurante(String papel, int quantidade) {
        return new Solo(FIGURANTE, papel, quantidade);
    }

    /**
     * Participantes da partida solo: o protagonista escolhido (PROPRIO, ou MODELO_CASA quando o núcleo aceita e a pessoa
     * pediu) e um participante por figurante. Entradas opcionais (papel OPCIONAL) ficam de fora.
     */
    public List<Participante> participantes(UUID dono, String escolha) {
        boolean modelo = MODELO_CASA.equals(escolha) && solo.stream().anyMatch(s -> MODELO_CASA.equals(s.tipo()));
        List<Participante> out = new ArrayList<>();
        for (Solo s : solo) {
            if (PROTAGONISTA.equals(s.papel())) {
                if (PROPRIO.equals(s.tipo()) && !modelo) {
                    out.add(new Participante(PROPRIO, PROTAGONISTA, "A", dono));
                } else if (MODELO_CASA.equals(s.tipo()) && modelo) {
                    out.add(new Participante(MODELO_CASA, PROTAGONISTA, "A", null));
                }
            } else if (FIGURANTE.equals(s.tipo())) {
                for (int i = 0; i < s.quantidade(); i++) {
                    out.add(new Participante(FIGURANTE, s.papel(), TIME_POR_PAPEL.get(s.papel()), null));
                }
            }
        }
        return out;
    }
}
