package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Resultado.Evento;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * A jogada de cena (pedido da dona: cartas como ação dentro da mecânica, não só para vestir), nos jogos em que as cartas
 * só vestiam: Passarela, Dress the Star, Boutique e Around the World. Depois do look avaliado, a partida fica EM_ACAO e
 * a cena faz um pedido de cor (sorteado da semente: os flashes, o holofote, a cliente que sorri, o sol da tarde); a
 * pessoa joga uma carta do deck que não está no look, e a cor dela dispara a ação de cena da tabela de
 * {@link Flair3dCores}. A cor pedida soma {@link #BONUS} pontos; outra cor só faz a cena; seguir sem carta fecha a
 * partida como estava. O servidor continua a única fonte da nota. Decorator sobre o núcleo do jogo
 * (docs/refactoring/gof/R90-flair3d-nucleos.md).
 */
public final class Flair3dJogadaDeCena implements Flair3dNucleo {
    public static final Set<String> JOGOS = Set.of("PASSARELA", "DRESS_THE_STAR", "BOUTIQUE_3D", "AROUND_THE_WORLD");
    public static final int BONUS = 10;

    private final Flair3dNucleo jogo;

    public Flair3dJogadaDeCena(Flair3dNucleo jogo) {
        this.jogo = jogo;
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
    public Resultado previa(Entrega entrega, Contexto contexto) {
        return jogo.previa(entrega, contexto);
    }

    @Override
    public Map<String, Object> abertura(Contexto contexto) {
        return jogo.abertura(contexto);
    }

    @Override
    public List<Efeito> efeitos(CbcRules.Card carta, Contexto contexto) {
        return jogo.efeitos(carta, contexto);
    }

    @Override
    public Resultado comExecucao(Resultado look, Resultado comNota, int execucao, Contexto contexto) {
        return jogo.comExecucao(look, comNota, execucao, contexto);
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        Resultado look = jogo.pontuar(entrega, contexto);
        Map<String, String> tabela = Flair3dCores.tabelaDe(codigo());
        if (!look.fecha() || tabela == null) {
            return look;
        }
        String pedida = contexto.sortear("cena", Flair3dCores.FAMILIAS);
        Map<String, Object> pedido = new LinkedHashMap<>();
        pedido.put("familia", pedida);
        pedido.put("acao", tabela.get(pedida));
        List<Evento> eventos = new ArrayList<>(look.eventos());
        eventos.add(new Evento("PEDIDO_DE_CENA", pedido));
        List<Acionamento> jogadas = contexto.andamento().acionamentos();
        if (jogadas.isEmpty()) {
            return Resultado.parcial(Resultado.EM_ACAO, Resultado.EM_ACAO, look.regras(), eventos);
        }
        UUID id = jogadas.get(0).carta();
        if (id == null) {
            return Resultado.of(look.pontos(), look.resultado(), look.regras(), eventos).comCartas(look.cartas());
        }
        CbcRules.Card carta = contexto.deck().get(id);
        if (carta == null || entrega.cartas().containsValue(id)) {
            throw Flair3dErros.invalido("CARTA_NO_LOOK", "carta_no_look");
        }
        String familia = Flair3dCores.familia(tabela, carta);
        boolean acertou = pedida.equals(familia);
        Map<String, Object> jogada = new LinkedHashMap<>();
        jogada.put("carta", id);
        jogada.put("familia", familia);
        jogada.put("acao", familia == null ? null : tabela.get(familia));
        jogada.put("acertou", acertou);
        eventos.add(new Evento("JOGADA_DE_CENA", jogada));
        List<RegraResultado> regras = new ArrayList<>(look.regras());
        regras.add(RegraResultado.de("JOGADA_DE_CENA", acertou, BONUS));
        double pontos = look.pontos() + (acertou ? BONUS : 0);
        String resultado = rotulo(look.resultado(), pontos);
        return Resultado.of(pontos, resultado, regras, eventos).comCartas(look.cartas());
    }

    /** Aprovado e reprovado seguem a nota nova (60); os outros desfechos ficam como o jogo disse. */
    static String rotulo(String antes, double pontos) {
        if ("APROVADO".equals(antes) || "REPROVADO".equals(antes)) {
            return pontos >= 60 ? "APROVADO" : "REPROVADO";
        }
        return antes;
    }
}
