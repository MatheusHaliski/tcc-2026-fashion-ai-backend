package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Resultado.Evento;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Rodada em etapas (um look por etapa: a cliente da vez, a região, o espelho, a rodada da batalha). Cada entrega tenta a
 * etapa da vez; quando passa, a partida segue ABERTA na etapa seguinte, e a última fecha com a média das etapas. Nada é
 * guardado além das entregas: o percurso inteiro é refeito da semente a cada chamada, então a prévia nunca gasta nada e a
 * revisão dá sempre o mesmo resultado.
 */
public final class Flair3dPercurso {
    public static final String CUMPRIDA = "ETAPA_CUMPRIDA";
    public static final String NAO_CUMPRIDA = "ETAPA_NAO_CUMPRIDA";

    /** O que a etapa diz do look: se a partida avança, a nota da etapa (0 a 100), as regras e os eventos dela. */
    public record Avaliacao(boolean passa, double pontos, List<RegraResultado> regras, List<Evento> eventos) {
        public Avaliacao {
            regras = List.copyOf(regras);
            eventos = List.copyOf(eventos);
        }
    }

    /** O look apresentado numa etapa: as peças, o look da etapa anterior (nulo na primeira), a tentativa e a resposta. */
    public record Look(int etapa, int tentativa, Map<String, CbcRules.Card> pecas, Map<String, CbcRules.Card> anterior, String resposta) {
    }

    /** As etapas de uma rodada. */
    public interface Etapas {
        int total();

        /** Código da etapa (1 a total): o nome dela na tela e a regra dela no resultado final. */
        String codigo(int etapa);

        Avaliacao avaliar(Look look);

        /** O resultado final, quando a rodada não é só "aprovado com 60" (a batalha diz quem venceu). */
        default String resultado(double pontos, List<Passo> passos) {
            return pontos >= 60 ? "APROVADO" : "REPROVADO";
        }

        /** Eventos do resultado final, depois dos de cada etapa (o placar da batalha, a colocação). */
        default List<Evento> fecho(List<Passo> passos) {
            return List.of();
        }
    }

    /** Uma etapa já fechada: quantas tentativas levou, a avaliação que a fechou e o look que a fechou. */
    public record Passo(int etapa, String codigo, int tentativas, Avaliacao avaliacao, Map<String, CbcRules.Card> pecas) {
    }

    private record Andado(List<Passo> fechadas, Avaliacao ultima, boolean passou, int etapa, int tentativa, Map<String, CbcRules.Card> anterior) {
    }

    private Flair3dPercurso() {
    }

    private static Map<String, CbcRules.Card> pecas(Map<String, java.util.UUID> cartas, Contexto contexto) {
        return contexto.vestidas(new Entrega(cartas, null, null, null));
    }

    /** Refaz o percurso com as entregas dadas, na ordem. */
    private static Andado andar(List<Andamento.Etapa> entregas, Contexto contexto, Etapas etapas) {
        List<Passo> fechadas = new ArrayList<>();
        Avaliacao ultima = null;
        boolean passou = false;
        int etapa = 1;
        int tentativa = 1;
        Map<String, CbcRules.Card> anterior = null;
        for (Andamento.Etapa e : entregas) {
            if (etapa > etapas.total()) {
                break;
            }
            Map<String, CbcRules.Card> look = pecas(e.cartas(), contexto);
            ultima = etapas.avaliar(new Look(etapa, tentativa, look, anterior, e.resposta()));
            passou = ultima.passa();
            if (passou) {
                fechadas.add(new Passo(etapa, etapas.codigo(etapa), tentativa, ultima, look));
                etapa++;
                tentativa = 1;
                anterior = look;
            } else {
                tentativa++;
            }
        }
        return new Andado(fechadas, ultima, passou, etapa, tentativa, anterior);
    }

    private static Map<String, Object> etapaDaVez(Andado a, Etapas etapas) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("etapa", a.etapa());
        m.put("codigo", etapas.codigo(a.etapa()));
        m.put("total", etapas.total());
        m.put("tentativa", a.tentativa());
        return m;
    }

    /** A primeira etapa, para a abertura da partida: {etapa, codigo, total, tentativa}. */
    public static Map<String, Object> primeira(Etapas etapas) {
        return etapaDaVez(new Andado(List.of(), null, false, 1, 1, null), etapas);
    }

    /** A entrega de agora, depois das anteriores: a partida segue ABERTA até a última etapa fechar. */
    public static Resultado pontuar(Entrega entrega, Contexto contexto, Etapas etapas) {
        List<Andamento.Etapa> entregas = new ArrayList<>(contexto.andamento().anteriores());
        entregas.add(new Andamento.Etapa(entrega.cartas(), List.of(), entrega.resposta()));
        Andado a = andar(entregas, contexto, etapas);
        List<Evento> eventos = new ArrayList<>(a.ultima().eventos());
        if (a.etapa() <= etapas.total()) {
            if (a.passou()) {
                eventos.add(new Evento("PONTOS_DA_ETAPA", Math.round(a.ultima().pontos())));
            }
            eventos.add(new Evento("PROXIMA_ETAPA", etapaDaVez(a, etapas)));
            return Resultado.parcial(Resultado.ABERTA, a.passou() ? CUMPRIDA : NAO_CUMPRIDA, a.ultima().regras(), eventos);
        }
        double pontos = a.fechadas().stream().mapToDouble(p -> p.avaliacao().pontos()).average().orElse(0);
        List<RegraResultado> regras = new ArrayList<>();
        List<Evento> fim = new ArrayList<>();
        for (Passo p : a.fechadas()) {
            double parte = p.avaliacao().pontos() / etapas.total();
            regras.add(new RegraResultado(p.codigo(), p.avaliacao().pontos() >= 60, Math.round(parte * 100) / 100.0));
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("etapa", p.etapa());
            m.put("codigo", p.codigo());
            m.put("pontos", Math.round(p.avaliacao().pontos()));
            m.put("tentativas", p.tentativas());
            fim.add(new Evento("ETAPA", m));
        }
        fim.addAll(etapas.fecho(a.fechadas()));
        return Resultado.of(pontos, etapas.resultado(pontos, a.fechadas()), regras, fim).comCartas(cartas(a.fechadas(), etapas.total()));
    }

    /**
     * Os pontos de cada carta no resultado final: em cada etapa, a regra de uma vaga cumprida ("NA_REGRA_SUP") vale para a
     * carta dessa vaga, com o mesmo peso da etapa na média (1/total); a mesma carta em mais de uma etapa soma. Sem isso a
     * tela mostrava "vale conforme o pedido da vez" no lugar dos pontos (auditoria 3).
     */
    static List<Resultado.CartaPontos> cartas(List<Passo> passos, int total) {
        Map<java.util.UUID, Resultado.CartaPontos> out = new LinkedHashMap<>();
        for (Passo p : passos) {
            for (RegraResultado r : p.avaliacao().regras()) {
                int corte = r.codigo().lastIndexOf('_');
                CbcRules.Card carta = corte < 0 ? null : p.pecas().get(r.codigo().substring(corte + 1));
                if (carta == null || !r.ok() || r.pontos() <= 0) {
                    continue;
                }
                double parte = r.pontos() / total;
                String vaga = r.codigo().substring(corte + 1);
                out.merge(carta.id(), new Resultado.CartaPontos(vaga, carta.id(), parte),
                        (a, b) -> new Resultado.CartaPontos(a.vaga(), a.cardId(), a.pontos() + b.pontos()));
            }
        }
        return out.values().stream().map(c -> new Resultado.CartaPontos(c.vaga(), c.cardId(), Math.round(c.pontos() * 100) / 100.0)).toList();
    }

    /** Prévia: a nota da etapa da vez com o look de agora, sem avançar nem contar tentativa. */
    public static Resultado previa(Entrega entrega, Contexto contexto, Etapas etapas) {
        Andado a = andar(contexto.andamento().anteriores(), contexto, etapas);
        int etapa = Math.min(a.etapa(), etapas.total());
        Avaliacao v = etapas.avaliar(new Look(etapa, a.tentativa(), contexto.vestidas(entrega), a.anterior(), entrega.resposta()));
        return Resultado.of(v.pontos(), Resultado.EM_PREPARO, v.regras(), List.of());
    }
}
