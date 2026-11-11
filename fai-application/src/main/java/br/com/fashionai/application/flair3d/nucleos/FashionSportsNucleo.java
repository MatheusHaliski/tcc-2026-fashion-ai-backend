package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Avatares;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Definicao;
import br.com.fashionai.application.flair3d.Definicao.Deck;
import br.com.fashionai.application.flair3d.Definicao.Obrigatoria;
import br.com.fashionai.application.flair3d.Definicao.Regra;
import br.com.fashionai.application.flair3d.Efeito;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dAtributos;
import br.com.fashionai.application.flair3d.Flair3dNucleo;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.Resultado.Evento;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;

import java.util.List;

/**
 * Núcleo 14 — futebol de 5: um uniforme (camisa, calção e chuteira) para os 4 de linha contra o time-padrão. Coesão 100%
 * (uniforme único). A força do time é a média de velocidade, técnica, resistência e defesa do uniforme; a do time-padrão
 * sai do sorteio da partida (20 a 30). Mais de 1 ponto acima = vitória (100); até 1 de diferença = empate (60);
 * abaixo = derrota (0).
 */
public class FashionSportsNucleo implements Flair3dNucleo {
    public static final List<String> VAGAS = List.of("SUP", "INF", "CAL");
    public static final int PADRAO_MIN = 20;
    public static final int PADRAO_FAIXA = 11;

    @Override
    public String codigo() {
        return "FASHION_SPORTS";
    }

    @Override
    public int numero() {
        return 14;
    }

    @Override
    public Definicao definicao() {
        return Definicao.cartas(codigo(), numero(), Definicao.objetivo("FUTEBOL_DE_5", new Regra("VITORIA", 100),
                new Regra("EMPATE", 60), new Regra("COESAO", 0)), List.of(Definicao.CARTAS), VAGAS,
                Deck.ate(6, Obrigatoria.uma("SUP"), Obrigatoria.uma("INF"), Obrigatoria.uma("CAL")), false)
                .comAvatares(Avatares.solo(new Avatares.Online(2, 10, 5), Avatares.figurante("COLEGA", 4), Avatares.figurante("ADVERSARIO", 5)));
    }

    public static int forca(Flair3dAtributos a) {
        return Math.round((a.velocidade() + a.tecnica() + a.resistencia() + a.defesa()) / 4f);
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        int nos = forca(Flair3dAtributos.soma(contexto.vestidas(entrega).values()));
        int eles = PADRAO_MIN + contexto.sorteio().nextInt(PADRAO_FAIXA);
        int diferenca = nos - eles;
        boolean vitoria = diferenca > 1;
        boolean empate = Math.abs(diferenca) <= 1;
        String placar = vitoria ? "2-1" : empate ? "1-1" : "0-2";
        List<RegraResultado> regras = List.of(RegraResultado.de("VITORIA", vitoria, 100), RegraResultado.de("EMPATE", empate, 60),
                RegraResultado.de("COESAO", true, 0));
        List<Evento> eventos = List.of(new Evento("FORCA_TIME", nos), new Evento("FORCA_ADVERSARIO", eles),
                new Evento("COESAO", 100), new Evento("PLACAR", placar));
        return Resultado.of(vitoria ? 100 : empate ? 60 : 0, vitoria ? "VITORIA" : empate ? "EMPATE" : "DERROTA", regras, eventos);
    }

    @Override
    public List<Efeito> efeitos(CbcRules.Card carta, Contexto contexto) {
        Flair3dAtributos a = Flair3dAtributos.daCarta(carta);
        return List.of(new Efeito("VELOCIDADE", a.velocidade()), new Efeito("TECNICA", a.tecnica()),
                new Efeito("RESISTENCIA", a.resistencia()), new Efeito("DEFESA", a.defesa()));
    }
}
