package br.com.fashionai.application.flair3d.recurso;

import br.com.fashionai.application.flair3d.recurso.PecaRecurso.Atributo;
import br.com.fashionai.application.flair3d.recurso.PecaRecurso.Recurso;

import java.util.Map;
import java.util.Optional;

/**
 * Como cada jogo lê a regra peça-recurso: os atributos do look que pesam na nota (com o peso de cada um) e o recurso
 * que é a "vida" do jogo. Fora desta tabela ficam a Batalha de Looks (a nota é comparada com a do adversário), os jogos
 * com motor próprio de atributos (Dress Fighter, Fashion Detective, Fashion Sports: o uso age dentro do motor);
 * e os de zonas leem as zonas pintadas como peças virtuais (Flair3dPecaVirtual). Puro.
 */
public final class Flair3dRecursoPerfil {
    private Flair3dRecursoPerfil() {
    }

    /** Teto do bônus na nota: o look ajuda, mas não substitui o objetivo do jogo. */
    public static final int TETO_DOS_ATRIBUTOS = 10;
    public static final int TETO_DO_RECURSO = 5;

    public record PerfilDoJogo(Map<Atributo, Integer> pesos, Recurso vida) {
    }

    static final Map<String, PerfilDoJogo> JOGOS = Map.ofEntries(
            Map.entry("PASSARELA", new PerfilDoJogo(Map.of(Atributo.CARISMA, 2, Atributo.AGILIDADE, 1), Recurso.FOCO)),
            Map.entry("DRESS_THE_STAR", new PerfilDoJogo(Map.of(Atributo.CARISMA, 1), Recurso.FOCO)),
            Map.entry("PERSONAGEM_FILME", new PerfilDoJogo(Map.of(Atributo.CARISMA, 1, Atributo.FURTIVIDADE, 1, Atributo.AGILIDADE, 1, Atributo.FORCA, 1), Recurso.FOCO)),
            // a vida da loja é a paciência da cliente: cai com peça fora do pedido e com erro na execução
            Map.entry("BOUTIQUE_3D", new PerfilDoJogo(Map.of(Atributo.CARISMA, 1), Recurso.VIDA)),
            Map.entry("AROUND_THE_WORLD", new PerfilDoJogo(Map.of(Atributo.RESISTENCIA, 1, Atributo.AGILIDADE, 1), Recurso.ENERGIA)),
            Map.entry("LABIRINTO", new PerfilDoJogo(Map.of(Atributo.AGILIDADE, 1, Atributo.FURTIVIDADE, 1), Recurso.ENERGIA)),
            Map.entry("ROAD_TO_GLORY", new PerfilDoJogo(Map.of(Atributo.CARISMA, 1, Atributo.RESISTENCIA, 1), Recurso.ENERGIA)),
            // os jogos de zonas: cada zona pintada é uma peça virtual (Flair3dPecaVirtual)
            Map.entry("CLUBE_CORACAO", new PerfilDoJogo(Map.of(Atributo.RESISTENCIA, 1, Atributo.CARISMA, 1), Recurso.ENERGIA)),
            Map.entry("FAVORITE_SINGER", new PerfilDoJogo(Map.of(Atributo.CARISMA, 1), Recurso.FOCO)),
            Map.entry("PILOTO_FAVORITO", new PerfilDoJogo(Map.of(Atributo.AGILIDADE, 1, Atributo.RESISTENCIA, 1), Recurso.ENERGIA)),
            Map.entry("SUPER_HEROI", new PerfilDoJogo(Map.of(Atributo.FORCA, 1, Atributo.AGILIDADE, 1), Recurso.VIDA)));

    /**
     * A Batalha de Looks fica fora da tabela: o bônus dela entra na nota de cada rodada, para a pessoa e para o look da
     * casa (BatalhaLooksPlacar), e não por cima da média final.
     */
    public static final PerfilDoJogo BATALHA = new PerfilDoJogo(Map.of(Atributo.CARISMA, 2, Atributo.AGILIDADE, 1), Recurso.FOCO);

    public static Optional<PerfilDoJogo> doJogo(String codigo) {
        return Optional.ofNullable(JOGOS.get(codigo));
    }
}
