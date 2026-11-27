package br.com.fashionai.application.flair3d.recurso;

import br.com.fashionai.application.flair3d.Andamento.UsoDeRecurso;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.Resultado.Evento;
import br.com.fashionai.application.flair3d.recurso.PecaRecurso.Recurso;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * O recurso-vida que as decisões da partida gastam (reauditoria de 25/11/2026: "os recursos só sobem; usar é sempre o
 * certo"). Cada jogo diz o que gasta e quanto — a apresentação errada no Labirinto, a tentativa reprovada na viagem, a
 * peça fora do tema na Passarela, a peça fora do pedido na Boutique — e aqui isso sai da reserva: a inicial do jogo mais
 * as peças usadas como recurso. A reserva zerada fecha a partida em derrota ({@link #ESGOTOU}); o que sobra é a reserva
 * com que a execução no percurso começa (Flair3dExecucao), que segue gastando nos erros. Recalculado do zero a cada
 * chamada, como o resto da partida: o mesmo andamento dá o mesmo desgaste. Puro.
 */
public record Flair3dDesgaste(Recurso recurso, int reserva, Map<String, Integer> motivos) {
    public static final String EVENTO = "DESGASTE";
    /** Resultado da partida que zerou a reserva com as decisões (a execução tem o próprio: ESGOTADO). */
    public static final String ESGOTOU = "DERROTA";
    /** O que cada apresentação errada custa no Labirinto e na viagem: três erros sem usar peça zeram a reserva inicial. */
    public static final int POR_FALHA = 15;

    /** Quanto uma falha custa e de qual recurso (as rodadas em etapas que gastam a cada apresentação que não passa). */
    public record Falha(Recurso recurso, int custo, String motivo) {
    }

    public Flair3dDesgaste {
        motivos = Map.copyOf(motivos);
    }

    /** A reserva do recurso na partida (a inicial mais as peças usadas), ainda sem gasto. */
    public static Flair3dDesgaste de(Recurso recurso, List<UsoDeRecurso> usos) {
        return new Flair3dDesgaste(recurso, Flair3dRecursoEstado.de(usos).get(recurso), Map.of());
    }

    /** O recurso-vida do jogo (moedas não se perdem errando: onde a vida seria moeda, o erro tira o FOCO). */
    public static Recurso vidaDo(String jogo) {
        Recurso r = Flair3dRecursoPerfil.doJogo(jogo).map(Flair3dRecursoPerfil.PerfilDoJogo::vida).orElse(Recurso.FOCO);
        return r == Recurso.MOEDAS ? Recurso.FOCO : r;
    }

    /** O mesmo desgaste com mais {@code vezes} × {@code custo} pelo motivo dado (zero vez não muda nada). */
    public Flair3dDesgaste com(String motivo, int vezes, int custo) {
        if (vezes <= 0 || custo <= 0) {
            return this;
        }
        Map<String, Integer> out = new LinkedHashMap<>(motivos);
        out.merge(motivo, vezes * custo, Integer::sum);
        return new Flair3dDesgaste(recurso, reserva, out);
    }

    public int gasto() {
        return motivos.values().stream().mapToInt(Integer::intValue).sum();
    }

    public int restante() {
        return Math.max(0, reserva - gasto());
    }

    /** As decisões gastaram a reserva inteira: a partida fecha em derrota. */
    public boolean esgotou() {
        return gasto() > 0 && restante() == 0;
    }

    /** {recurso, reserva, gasto, restante, motivos:{PECA_FORA_DO_TEMA: 20}}: o medidor da tela e a reserva da execução. */
    public Evento evento() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("recurso", recurso.name());
        m.put("reserva", reserva);
        m.put("gasto", gasto());
        m.put("restante", restante());
        m.put("motivos", new TreeMap<>(motivos));
        return new Evento(EVENTO, m);
    }

    /** A reserva que sobrou no resultado (o evento {@link #EVENTO}), ou -1 quando o jogo não gasta nada com as decisões. */
    @SuppressWarnings("unchecked")
    public static int restanteEm(Resultado r) {
        return r.eventos().stream().filter(e -> EVENTO.equals(e.codigo())).map(e -> (Map<String, Object>) e.valor())
                .mapToInt(m -> ((Number) m.get("restante")).intValue()).reduce((a, b) -> b).orElse(-1);
    }
}
