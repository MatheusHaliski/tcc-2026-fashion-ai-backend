package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.Resultado.Evento;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * O fim da Batalha de Looks depois da execução do desfile final (rodada 8g). Antes, a execução só mexia na média das
 * rodadas e o desfecho continuava o da soma sem ela: quem seguia sem executar via "30 pontos", nenhuma estrela e
 * "Vitória" ao lado de uma tabela 127 × 79. Agora:
 *
 * <ul>
 *   <li>a execução (de -15 a +15) entra na soma da pessoa, que é o que se compara com a soma da casa;</li>
 *   <li>no empate, o voto da plateia (da semente, ou o trunfo do Hype, {@link BatalhaLooksVoto});</li>
 *   <li>a nota da partida continua a média das rodadas mais a execução, mas segue o desfecho: a vitória vale ao menos
 *       {@value #NOTA_DA_VITORIA} (uma estrela) e a derrota no máximo {@value #NOTA_DA_DERROTA}.</li>
 * </ul>
 *
 * O evento SOMA_DA_BATALHA passa a dizer {voce, adversario, rodadas, execucao}: a soma da pessoa já com a execução.
 * Puro.
 */
final class BatalhaLooksFecho {
    static final String SOMA = "SOMA_DA_BATALHA";
    static final String VOTO = "VOTO_DA_PLATEIA";
    static final int NOTA_DA_VITORIA = 60;
    static final int NOTA_DA_DERROTA = 59;

    private BatalhaLooksFecho() {
    }

    static Resultado comExecucao(Resultado look, Resultado comNota, int execucao, Contexto contexto) {
        Integer adversario = adversario(look);
        if (adversario == null) {
            return comNota;
        }
        int rodadas = rodadas(look);
        int voce = rodadas + execucao;
        boolean venceu = BatalhaLooksVoto.venceu(voce, adversario, contexto);
        List<Evento> eventos = new ArrayList<>(comNota.eventos());
        eventos.removeIf(e -> SOMA.equals(e.codigo()) || VOTO.equals(e.codigo()));
        Map<String, Object> soma = new LinkedHashMap<>();
        soma.put("voce", voce);
        soma.put("adversario", adversario);
        soma.put("rodadas", rodadas);
        soma.put("execucao", execucao);
        eventos.add(new Evento(SOMA, soma));
        if (voce == adversario) {
            eventos.add(BatalhaLooksVoto.evento(venceu, contexto));
        }
        double pontos = venceu ? Math.max(NOTA_DA_VITORIA, comNota.pontos()) : Math.min(NOTA_DA_DERROTA, comNota.pontos());
        return Resultado.of(pontos, venceu ? "VITORIA" : "DERROTA", comNota.regras(), eventos).comCartas(comNota.cartas());
    }

    /** A soma da casa: a do fecho das 3 rodadas ou, no treino, a nota do adversário; nula fora da comparação. */
    private static Integer adversario(Resultado look) {
        Map<?, ?> soma = soma(look);
        if (soma != null) {
            return ((Number) soma.get("adversario")).intValue();
        }
        return look.eventos().stream().filter(e -> "ADVERSARIO".equals(e.codigo()) && e.valor() instanceof Number)
                .map(e -> ((Number) e.valor()).intValue()).findFirst().orElse(null);
    }

    /** A soma das rodadas da pessoa, sem a execução (no treino, a nota da rodada única). */
    private static int rodadas(Resultado look) {
        Map<?, ?> soma = soma(look);
        return soma == null ? look.pontos() : ((Number) soma.get("voce")).intValue();
    }

    private static Map<?, ?> soma(Resultado look) {
        return look.eventos().stream().filter(e -> SOMA.equals(e.codigo()) && e.valor() instanceof Map<?, ?>)
                .map(e -> (Map<?, ?>) e.valor()).findFirst().orElse(null);
    }
}
