package br.com.fashionai.application.flair3d.aura;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Definicao;
import br.com.fashionai.application.flair3d.Efeito;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dJogadaDeCena;
import br.com.fashionai.application.flair3d.Flair3dNucleo;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.Resultado.Evento;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * A Aura na partida dos jogos de um look só (Passarela, Dress the Star, Personagem de Filme e Boutique): quando o jogo
 * fecha o look (depois da jogada de cena, onde há), a plateia reage à faixa de Hype das peças vestidas e o trunfo do
 * Hype, se foi chamado, entra como destaque na foto final ({@link Flair3dAuraRegras}). A prévia avisa o que vem. A
 * Batalha de Looks lê as mesmas regras dentro de cada rodada (BatalhaLooksPlacar). Decorator sobre o núcleo do jogo
 * (docs/refactoring/gof/R90-flair3d-nucleos.md).
 */
public final class Flair3dAuraNaPartida implements Flair3dNucleo {
    public static final String PLATEIA = "PLATEIA_DO_HYPE";
    public static final String TRUNFO = "TRUNFO_DO_HYPE";

    private final Flair3dNucleo jogo;

    public Flair3dAuraNaPartida(Flair3dNucleo jogo) {
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

    /**
     * A prévia leva só o aviso do que a plateia e o trunfo vão somar (o evento AURA_NA_PARTIDA): a nota da prévia
     * continua a do jogo, e a Aura entra quando o look fecha (nas rodadas em etapas, só no último).
     */
    @Override
    public Resultado previa(Entrega entrega, Contexto contexto) {
        Resultado r = jogo.previa(entrega, contexto);
        List<Evento> eventos = new ArrayList<>(r.eventos());
        eventos.add(Flair3dAuraEvento.de(contexto.vestidas(entrega).values(), contexto).evento());
        return new Resultado(r.pontos(), r.estrelas(), r.resultado(), r.regras(), eventos, r.cartas(), r.status());
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        Resultado look = jogo.pontuar(entrega, contexto);
        return look.fecha() ? comAura(look, contexto.vestidas(entrega), contexto) : look;
    }

    /** O look com a plateia e o trunfo: as duas regras, o evento AURA_NA_PARTIDA e a nota até 100. */
    static Resultado comAura(Resultado look, Map<String, CbcRules.Card> vestidas, Contexto contexto) {
        Flair3dAuraEvento aura = Flair3dAuraEvento.de(vestidas.values(), contexto);
        List<RegraResultado> regras = new ArrayList<>(look.regras());
        regras.add(RegraResultado.de(PLATEIA, aura.plateia() > 0, aura.plateia()));
        if (aura.trunfo() != null) {
            regras.add(RegraResultado.de(TRUNFO, aura.bonusDoTrunfo() > 0, aura.bonusDoTrunfo()));
        }
        List<Evento> eventos = new ArrayList<>(look.eventos());
        eventos.add(aura.evento());
        double pontos = look.pontos() + aura.plateia() + aura.bonusDoTrunfo();
        Resultado r = Resultado.of(pontos, Flair3dJogadaDeCena.rotulo(look.resultado(), pontos), regras, eventos).comCartas(look.cartas());
        return r.comStatus(look.status());
    }
}
