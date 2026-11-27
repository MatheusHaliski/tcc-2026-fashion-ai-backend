package br.com.fashionai.application.flair3d;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;

/**
 * A campanha de um jogo do FLAIR 3D (auditoria de 15/11/2026, mudança 9): as rodadas na ordem da definição, quais já
 * foram vencidas, as estrelas de cada uma, o total do jogo e o que abre a seguir. Sai só das partidas fechadas da
 * pessoa: nada é pago, a primeira rodada está sempre aberta e a seguinte abre quando a anterior é vencida (ou depois de
 * três tentativas nela, para ninguém ficar preso). Também diz
 * em que ponto da história a pessoa está (abertura, transição depois da última partida, fecho), sempre pelo resultado
 * que o servidor gravou. Puro: quem lê o banco é o {@link Flair3dProgresso}.
 */
public final class Flair3dCampanha {
    public static final String ABERTURA = "ABERTURA";
    public static final String TRANSICAO = "TRANSICAO";
    public static final String FECHO = "FECHO";
    /** Estrelas possíveis por rodada. */
    public static final int ESTRELAS_POR_RODADA = 3;
    /**
     * Saída para quem não tem carta para vencer uma rodada (a conta sem marca brasileira no tema Brasil): depois de
     * tantas partidas fechadas nela sem vencer, a seguinte abre mesmo assim. A rodada continua sem a marca de vencida.
     */
    public static final int TENTATIVAS_QUE_ABREM = 3;

    /**
     * Jogos em que a rodada seguinte só abre com a anterior vencida. Os outros já recebem as marcas e as estrelas, com
     * todas as rodadas abertas; para ligar a sequência num jogo, basta incluir o código aqui.
     */
    static final Set<String> EM_SEQUENCIA = Set.of("PASSARELA", "DRESS_FIGHTER", "DRESS_THE_STAR", "PERSONAGEM_FILME",
            "FASHION_DETECTIVE", "BOUTIQUE_3D", "LABIRINTO", "AROUND_THE_WORLD", "BATALHA_LOOKS");
    /** Jogos de uma rodada só em que a trilha são as opções da resposta (as modalidades do Fashion Sports), todas abertas. */
    static final Set<String> POR_RESPOSTA = Set.of("FASHION_SPORTS");
    /** Resultados que nunca contam como rodada vencida, mesmo com estrela (empate de 60 pontos, derrota por pouco). */
    private static final Set<String> NAO_VENCE = Set.of("DERROTA", "EMPATE", "REPROVADO", "NAO_ABRE", "DESFAVORAVEL", "INCOMPLETO");

    private Flair3dCampanha() {
    }

    /** Uma partida fechada: a rodada (ou a opção) jogada, a nota, o resultado e quando fechou. */
    public record Jogada(String rodada, int pontos, int estrelas, String resultado, Instant quando) {
    }

    /** A rodada na campanha: se está aberta, se já foi vencida, o melhor que a pessoa fez nela e o que a abre. */
    public record Etapa(String codigo, int ordem, boolean aberta, boolean vencida, int estrelas, int pontos, int partidas,
                        String vencidaEm, String abreCom) {
    }

    /** A última partida fechada, como o servidor a gravou: é o que a frase de transição cita. */
    public record Ultima(String rodada, int pontos, int estrelas, String resultado, boolean venceu, String quando) {
    }

    /** O ponto da história: ABERTURA (nada jogado), TRANSICAO (cita a última partida) ou FECHO (tudo vencido). */
    public record Enredo(String momento, String proxima) {
    }

    public record Progresso(String nucleo, boolean emSequencia, boolean porResposta, int estrelas, int maximo, int vencidas,
                            int total, boolean completo, List<Etapa> rodadas, Ultima ultima, Enredo enredo) {
        /** A rodada pode ser aberta agora? Código fora da trilha não é barrado aqui. */
        public boolean aberta(String codigo) {
            return rodadas.stream().filter(e -> e.codigo().equals(codigo)).findFirst().map(Etapa::aberta).orElse(true);
        }
    }

    /** Os códigos da trilha, na ordem em que a tela os mostra. */
    static List<String> trilha(Definicao d) {
        if (POR_RESPOSTA.contains(d.codigo()) && !d.opcoes().isEmpty()) {
            return d.opcoes();
        }
        return d.rodadas().stream().map(Definicao.Rodada::codigo).toList();
    }

    /** Rodada artística, sem placar (nenhuma regra vale pontos): concluir já conta como vencida. */
    static boolean semPlacar(Definicao d, String codigo) {
        List<Definicao.Regra> regras = d.rodada(codigo).map(r -> r.objetivo().regras()).orElse(d.objetivo().regras());
        return !regras.isEmpty() && regras.stream().allMatch(r -> r.pontos() == 0);
    }

    static boolean venceu(Definicao d, Jogada j) {
        if (j.resultado() != null && NAO_VENCE.contains(j.resultado())) {
            return false;
        }
        return j.estrelas() >= 1 || semPlacar(d, j.rodada());
    }

    public static Progresso de(Definicao d, List<Jogada> fechadas) {
        boolean sequencia = EM_SEQUENCIA.contains(d.codigo());
        List<String> codigos = trilha(d);
        List<Etapa> etapas = new ArrayList<>();
        boolean anteriorVencida = true;
        for (int i = 0; i < codigos.size(); i++) {
            String codigo = codigos.get(i);
            List<Jogada> dela = fechadas.stream().filter(j -> codigo.equals(j.rodada())).toList();
            Instant vitoria = dela.stream().filter(j -> venceu(d, j)).map(Jogada::quando).min(Comparator.naturalOrder()).orElse(null);
            boolean vencida = vitoria != null;
            boolean aberta = !sequencia || i == 0 || anteriorVencida || vencida;
            etapas.add(new Etapa(codigo, i + 1, aberta, vencida, dela.stream().mapToInt(Jogada::estrelas).max().orElse(0),
                    dela.stream().mapToInt(Jogada::pontos).max().orElse(0), dela.size(), vencida ? vitoria.toString() : null,
                    aberta ? null : codigos.get(i - 1)));
            anteriorVencida = vencida || dela.size() >= TENTATIVAS_QUE_ABREM;
        }
        int vencidas = (int) etapas.stream().filter(Etapa::vencida).count();
        boolean completo = !etapas.isEmpty() && vencidas == etapas.size();
        Ultima ultima = fechadas.stream().filter(j -> codigos.contains(j.rodada())).max(Comparator.comparing(Jogada::quando))
                .map(j -> new Ultima(j.rodada(), j.pontos(), j.estrelas(), j.resultado(), venceu(d, j), j.quando().toString())).orElse(null);
        String proxima = etapas.stream().filter(e -> e.aberta() && !e.vencida()).map(Etapa::codigo).findFirst().orElse(null);
        String momento = completo ? FECHO : ultima == null ? ABERTURA : TRANSICAO;
        return new Progresso(d.codigo(), sequencia, POR_RESPOSTA.contains(d.codigo()), etapas.stream().mapToInt(Etapa::estrelas).sum(),
                etapas.size() * ESTRELAS_POR_RODADA, vencidas, etapas.size(), completo, List.copyOf(etapas), ultima, new Enredo(momento, proxima));
    }
}
