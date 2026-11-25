package br.com.fashionai.application.flair3d.recurso;

import br.com.fashionai.application.flair3d.recurso.PecaRecurso.Atributo;
import br.com.fashionai.application.flair3d.recurso.PecaRecurso.Recurso;

import java.util.Map;
import java.util.Optional;

/**
 * Como cada jogo lê a regra peça-recurso: os atributos do look que pesam na nota (com o peso de cada um) e o recurso
 * que é a "vida" do jogo. Fora desta tabela ficam a Batalha de Looks (a nota é comparada com a do adversário), os jogos
 * com motor próprio de atributos (Dress Fighter, Fashion Detective, Fashion Sports: etapa 14 do plano) e os de zonas,
 * que não têm cartas. Puro.
 */
public final class Flair3dRecursoPerfil {
    private Flair3dRecursoPerfil() {
    }

    /** Teto do bônus na nota: o look ajuda, mas não substitui o objetivo do jogo. */
    public static final int TETO_DOS_ATRIBUTOS = 10;
    public static final int TETO_DO_RECURSO = 5;

    public record PerfilDoJogo(Map<Atributo, Integer> pesos, Recurso vida) {
    }

    static final Map<String, PerfilDoJogo> JOGOS = Map.of(
            "PASSARELA", new PerfilDoJogo(Map.of(Atributo.CARISMA, 2, Atributo.AGILIDADE, 1), Recurso.FOCO),
            "DRESS_THE_STAR", new PerfilDoJogo(Map.of(Atributo.CARISMA, 1), Recurso.FOCO),
            "PERSONAGEM_FILME", new PerfilDoJogo(Map.of(Atributo.CARISMA, 1, Atributo.FURTIVIDADE, 1, Atributo.AGILIDADE, 1, Atributo.FORCA, 1), Recurso.FOCO),
            "BOUTIQUE_3D", new PerfilDoJogo(Map.of(Atributo.CARISMA, 1), Recurso.MOEDAS),
            "AROUND_THE_WORLD", new PerfilDoJogo(Map.of(Atributo.RESISTENCIA, 1, Atributo.AGILIDADE, 1), Recurso.ENERGIA),
            "LABIRINTO", new PerfilDoJogo(Map.of(Atributo.AGILIDADE, 1, Atributo.FURTIVIDADE, 1), Recurso.ENERGIA),
            "ROAD_TO_GLORY", new PerfilDoJogo(Map.of(Atributo.CARISMA, 1, Atributo.RESISTENCIA, 1), Recurso.ENERGIA));

    public static Optional<PerfilDoJogo> doJogo(String codigo) {
        return Optional.ofNullable(JOGOS.get(codigo));
    }
}
