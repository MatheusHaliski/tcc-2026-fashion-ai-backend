package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair3d.Flair3dAtributos;

import java.util.List;

/**
 * Modalidades do FASHION_SPORTS (docs/flair/flair-3d/CORES_E_ACOES.md, 1.3). A cor mantém o mesmo papel em todo esporte
 * (preto defende, verde finaliza, amarelo engana, azul desloca, vermelho liga, branco guarda); o que muda é o peso de
 * cada atributo do uniforme na força do time. A pessoa escolhe a modalidade na entrega; sem escolha, vale o futebol de 5.
 */
public record FashionSportsModalidade(String codigo, int velocidade, int tecnica, int resistencia, int defesa) {
    public static final FashionSportsModalidade FUTEBOL = new FashionSportsModalidade("FUTEBOL", 1, 1, 1, 1);
    public static final List<FashionSportsModalidade> TODAS = List.of(FUTEBOL,
            new FashionSportsModalidade("BASQUETE", 1, 2, 0, 1), new FashionSportsModalidade("VOLEI", 0, 2, 1, 1),
            new FashionSportsModalidade("TENIS", 1, 2, 1, 0), new FashionSportsModalidade("CORRIDA", 2, 0, 2, 0),
            new FashionSportsModalidade("SKATE", 1, 2, 1, 0));
    public static final List<String> CODIGOS = TODAS.stream().map(FashionSportsModalidade::codigo).toList();

    /** A modalidade da resposta da entrega; nula ou desconhecida = futebol de 5. */
    public static FashionSportsModalidade de(String resposta) {
        return TODAS.stream().filter(m -> m.codigo.equals(resposta)).findFirst().orElse(FUTEBOL);
    }

    /**
     * O placar no jeito da modalidade, a partir dos lances convertidos de cada lado (quem converte mais continua na
     * frente): gols no futebol, chegadas na corrida, pontos no basquete (12 de base e 3 por lance), nota no skate (60 de
     * base e 10 por lance) e sets no vôlei e no tênis (no fim, 2 para quem venceu e no máximo 1 para o outro; 1 a 1 no
     * empate).
     */
    public String placar(int nos, int eles, boolean fim) {
        return switch (codigo) {
            case "BASQUETE" -> (12 + 3 * nos) + "-" + (12 + 3 * eles);
            case "SKATE" -> (60 + 10 * nos) + "-" + (60 + 10 * eles);
            case "VOLEI", "TENIS" -> sets(nos, eles, fim);
            default -> nos + "-" + eles;
        };
    }

    private static String sets(int nos, int eles, boolean fim) {
        if (!fim || nos == eles) {
            return Math.min(nos, 1) + "-" + Math.min(eles, 1);
        }
        return nos > eles ? "2-" + Math.min(eles, 1) : Math.min(nos, 1) + "-2";
    }

    /** Força do time: média dos atributos do uniforme com os pesos da modalidade. */
    public int forca(Flair3dAtributos a) {
        int pesos = velocidade + tecnica + resistencia + defesa;
        return Math.round((a.velocidade() * velocidade + a.tecnica() * tecnica + a.resistencia() * resistencia + a.defesa() * defesa)
                / (float) pesos);
    }
}
