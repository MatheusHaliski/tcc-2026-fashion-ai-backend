package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Resultado.Evento;
import br.com.fashionai.application.flair3d.recurso.Flair3dDesgaste;
import br.com.fashionai.application.flair3d.recurso.Flair3dRecursoEstado;
import br.com.fashionai.application.flair3d.recurso.PecaRecurso.Recurso;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

/**
 * O orçamento de tinta dos jogos de zonas (reauditoria de 25/11/2026: "a paleta é infinita e repintar é de graça"). Cada
 * zona pintada gasta latas pelo acabamento (fosco 1, brilhante 2, metálico e espelhado 3) e a peça tem
 * {@value #LATAS_POR_ZONA} latas por zona da rodada: dá para um ou dois destaques caros, não para a peça inteira. Passar
 * do orçamento fecha a partida {@value #SEM_TINTA}. A tinta que sobra vira fôlego da fase de uso: cada lata do orçamento
 * soma {@value #RESERVA_POR_LATA} ao recurso-vida do jogo e cada lata gasta tira o mesmo, e a execução no percurso começa
 * com o que restou (Flair3dDesgaste). A prévia mostra o orçamento enquanto a pessoa pinta. Decorator sobre o núcleo do
 * jogo (docs/refactoring/gof/R90-flair3d-nucleos.md).
 */
public final class Flair3dTinta implements Flair3dNucleo {
    public static final int LATAS_POR_ZONA = 2;
    public static final int RESERVA_POR_LATA = 5;
    public static final String SEM_TINTA = "SEM_TINTA";
    public static final String EVENTO = "TINTA";
    static final Map<String, Integer> LATAS = Map.of("FOSCO", 1, "BRILHANTE", 2, "METALICO", 3, "ESPELHADO", 3);

    private final Flair3dNucleo jogo;

    public Flair3dTinta(Flair3dNucleo jogo) {
        this.jogo = jogo;
    }

    /** O orçamento da rodada e as latas que a pintura gastou. */
    public record Conta(int orcamento, int gasto) {
        public boolean passou() {
            return gasto > orcamento;
        }

        Evento evento() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("orcamento", orcamento);
            m.put("gasto", gasto);
            m.put("sobra", Math.max(0, orcamento - gasto));
            return new Evento(EVENTO, m);
        }
    }

    /** Latas de uma zona: só a zona com cor gasta, pelo acabamento (sem acabamento, fosco). */
    static int latas(Entrega.Zona zona) {
        if (Flair3dZonas.hex(zona) == null) {
            return 0;
        }
        return LATAS.getOrDefault(Objects.toString(zona.acabamento(), "FOSCO").toUpperCase(Locale.ROOT), 1);
    }

    /** O orçamento e o gasto da pintura, nas zonas da rodada (o que vier a mais não conta). */
    public Conta conta(Entrega entrega, Contexto contexto) {
        List<String> zonas = definicao().naRodada(contexto.rodada()).zonas();
        int gasto = zonas.stream().mapToInt(z -> latas(entrega.zonas().get(z))).sum();
        return new Conta(zonas.size() * LATAS_POR_ZONA, gasto);
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        Resultado r = jogo.pontuar(entrega, contexto);
        if (!r.fecha()) {
            return r;
        }
        Conta conta = conta(entrega, contexto);
        List<Evento> eventos = new ArrayList<>(r.eventos());
        eventos.add(conta.evento());
        Recurso vida = Flair3dDesgaste.vidaDo(codigo());
        int reserva = Math.min(Flair3dRecursoEstado.MAXIMO,
                Flair3dRecursoEstado.de(contexto.andamento().usos()).get(vida) + conta.orcamento() * RESERVA_POR_LATA);
        if (conta.passou()) {
            // a tinta acabou antes da peça: nada sobra para a fase de uso, e a execução não começa
            eventos.add(new Flair3dDesgaste(vida, reserva, Map.of(EVENTO, reserva)).evento());
            return Resultado.of(Math.min(r.pontos(), Flair3dExecucao.NOTA_DE_QUEM_ESGOTOU), SEM_TINTA, r.regras(), eventos).comCartas(r.cartas());
        }
        eventos.add(new Flair3dDesgaste(vida, reserva, Map.of(EVENTO, conta.gasto() * RESERVA_POR_LATA)).evento());
        return new Resultado(r.pontos(), r.estrelas(), r.resultado(), r.regras(), eventos, r.cartas(), r.status());
    }

    /** A prévia leva o orçamento: a pessoa vê quantas latas ainda tem enquanto pinta. */
    @Override
    public Resultado previa(Entrega entrega, Contexto contexto) {
        Resultado r = jogo.previa(entrega, contexto);
        List<Evento> eventos = new ArrayList<>(r.eventos());
        eventos.add(conta(entrega, contexto).evento());
        return new Resultado(r.pontos(), r.estrelas(), r.resultado(), r.regras(), eventos, r.cartas(), r.status());
    }

    @Override
    public String codigo() {
        return jogo.codigo();
    }

    @Override
    public int numero() {
        return jogo.numero();
    }

    @Override
    public Definicao definicao() {
        return jogo.definicao();
    }

    @Override
    public Map<String, Object> abertura(Contexto contexto) {
        return jogo.abertura(contexto);
    }

    @Override
    public List<Efeito> efeitos(CbcRules.Card carta, Contexto contexto) {
        return jogo.efeitos(carta, contexto);
    }
}
