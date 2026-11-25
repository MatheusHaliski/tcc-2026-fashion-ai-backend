package br.com.fashionai.application.flair3d.detetive;

import br.com.fashionai.application.flair3d.Acionamento;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Flair3dErros;
import br.com.fashionai.application.flair3d.nucleos.FashionDetectiveAcusacao;
import br.com.fashionai.application.flair3d.nucleos.FashionDetectiveMundo;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * A investigação do caso "A Coleção Maré" jogada passo a passo (docs/flair/flair-3d/FASHION_DETECTIVE_HISTORIA.md): cada
 * acionamento é um passo, com o alvo ("IR:ponto", "PORTA:sala", "AJUDA:sala", "ABRIR:armario", "ESCONDER",
 * "BOLSO:vigia", "CONFRONTO:vigia", "VIDA", "COMPLETAR:pista", "MERCADO:acao", "TROCAR", "ENIGMA:opcao", "ACUSAR:numero") e, quando
 * a ação pede, a carta da cor certa (verde abre, preto esconde e tira do bolso, azul vence o confronto, amarelo devolve
 * vida, branco completa a pista, vermelho paga o mercado; trocar descarta qualquer carta para girar a mão). Andar, resolver o enigma e acusar não gastam carta. Depois de
 * cada passo os vigias andam: quem é visto é perseguido até se esconder ou sair do alcance, e quem é pego perde uma marca
 * de vida e 30 segundos e volta à porta da sala ({@link DetetivePerseguicao}). Tudo sai
 * da semente, do look e dos passos, na ordem: refazer a partida dá sempre o mesmo estado.
 */
public final class DetetivePartida {
    static final int SEGUNDOS_POR_PASSO = 10;
    static final int SEGUNDOS_POR_ACAO = 15;
    static final int SEGUNDOS_DE_PENALIDADE = 30;

    private final DetetiveEstado e = new DetetiveEstado();
    private final DetetiveMao mao;

    public DetetivePartida(Contexto contexto, Collection<UUID> noLook) {
        this(contexto, noLook, DetetiveDoLook.NEUTRO);
    }

    /** Com o que o look muda no corpo da detetive: vida máxima, cone dos vigias e tempo do passo. */
    public DetetivePartida(Contexto contexto, Collection<UUID> noLook, DetetiveDoLook doLook) {
        mao = new DetetiveMao(contexto, noLook);
        e.doLook = doLook;
        e.vida = doLook.vidaMaxima();
    }

    public DetetivePartida jogar(List<Acionamento> passos) {
        for (Acionamento a : passos) {
            passo(a);
        }
        return this;
    }

    public boolean encerrada() {
        return e.fim != null;
    }

    public FashionDetectiveAcusacao.Final fim() {
        return e.fim;
    }

    public int pistas() {
        return e.pistasCompletas();
    }

    public int salasResolvidas() {
        return e.resolvidas.size();
    }

    public int penalidades() {
        return e.penalidades;
    }

    public Map<String, Object> retrato() {
        return e.retrato(mao.cartas(), mao.noBaralho());
    }

    static RuntimeException invalida() {
        return Flair3dErros.invalido("ACAO_INVALIDA", "acao_invalida");
    }

    private void passo(Acionamento a) {
        if (e.fim != null || a == null || a.alvo() == null) {
            throw invalida();
        }
        e.avisos.clear();
        e.cutscene = null;
        String[] partes = a.alvo().split(":", 2);
        String verbo = partes[0];
        String arg = partes.length > 1 ? partes[1] : "";
        String cor = DetetiveAcoes.corPedida(verbo, e, arg);
        if (cor != null) {
            if (a.carta() == null || !(DetetiveAcoes.QUALQUER.equals(cor) || cor.equals(mao.acao(a.carta())))) {
                throw Flair3dErros.invalido("CARTA_DE_OUTRA_COR", "carta_de_outra_cor");
            }
            mao.jogar(a.carta());
        } else if (a.carta() != null) {
            throw invalida();
        }
        boolean andam = DetetiveAcoes.fazer(verbo, arg, e, mao);
        if (andam) {
            e.passo++;
            DetetivePerseguicao.depoisDoPasso(e);
        }
        if (e.tempo >= DetetiveEstado.LIMITE_DE_TEMPO && !"PASSARELA".equals(e.sala) && e.fim == null) {
            DetetiveAcoes.entrar(e, FashionDetectiveMundo.FINAL);
            e.avisos.add("TEMPO_ESGOTADO");
        }
    }

    static void conferir(boolean ok) {
        if (!ok) {
            throw invalida();
        }
    }
}
