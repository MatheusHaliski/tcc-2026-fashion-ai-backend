package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.nucleos.AroundTheWorldNucleo;
import br.com.fashionai.application.flair3d.nucleos.BatalhaLooksNucleo;
import br.com.fashionai.application.flair3d.nucleos.Boutique3dNucleo;
import br.com.fashionai.application.flair3d.nucleos.DressTheStarNucleo;
import br.com.fashionai.application.flair3d.nucleos.LabirintoNucleo;
import br.com.fashionai.application.flair3d.nucleos.PassarelaNucleo;
import br.com.fashionai.application.flair3d.nucleos.PersonagemFilmeNucleo;
import br.com.fashionai.application.flair3d.nucleos.RoadToGloryNucleo;
import org.junit.jupiter.api.Test;

import java.util.List;

import static br.com.fashionai.application.flair3d.Flair3dFixtures.card;
import static br.com.fashionai.application.flair3d.Flair3dFixtures.comMaquiagem;
import static br.com.fashionai.application.flair3d.Flair3dFixtures.contexto;
import static br.com.fashionai.application.flair3d.Flair3dFixtures.vestir;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * FLAIR 3D — {@code cartas:[{vaga, cardId, pontos}]} do resultado (quanto cada carta vestida rendeu) e o motivo de uma
 * carta não pontuar no efeito da tela do deck.
 */
class Flair3dCartasPontosTest {

    static List<Resultado.CartaPontos> cartas(Flair3dNucleo n, Entrega e, CbcRules.Card... cartas) {
        return n.pontuar(e, contexto(7L, cartas)).cartas();
    }

    static List<Resultado.CartaPontos> cartas(Flair3dNucleo n, CbcRules.Card... cartas) {
        return cartas(n, vestir(cartas), cartas);
    }

    static Resultado.CartaPontos de(CbcRules.Card c, double pontos) {
        return new Resultado.CartaPontos(c.position(), c.id(), pontos);
    }

    @Test
    void passarelaDivideOBonusEntreAsBrasileirasJaNaEscalaDe100() {
        CbcRules.Card sup = card("SUP", "brand:Farm");
        CbcRules.Card inf = card("INF", "brand:Osklen");
        CbcRules.Card cal = card("CAL", "brand:Farm");
        assertThat(cartas(new PassarelaNucleo(), sup, inf, cal)).containsExactly(de(sup, 23.81), de(inf, 23.81), de(cal, 23.81));
        CbcRules.Card gucci = card("INF", "brand:Gucci");
        assertThat(cartas(new PassarelaNucleo(), sup, gucci)).containsExactly(de(sup, 14.29), de(gucci, 0));
    }

    @Test
    void nucleosDePontoPorPecaDaoOValorDaRegraACadaCartaQueBate() {
        CbcRules.Card y2k = card("SUP", "style:y2k");
        CbcRules.Card classica = card("INF", "style:classic", "color:black");
        assertThat(cartas(new DressTheStarNucleo(), y2k, classica)).containsExactly(de(y2k, 25), de(classica, 0));
        CbcRules.Card casaco = card("SUP", "sub:coat");
        CbcRules.Card amarela = card("INF", "color:yellow");
        Entrega comTitulo = new Entrega(vestir(casaco, amarela).cartas(), null, null, PersonagemFilmeNucleo.CERTO);
        assertThat(cartas(new PersonagemFilmeNucleo(), comTitulo, casaco, amarela)).containsExactly(de(casaco, 12.5), de(amarela, 0));
        CbcRules.Card azul = card("SUP", "color:blue");
        CbcRules.Card vermelha = card("INF", "color:red");
        assertThat(cartas(new BatalhaLooksNucleo(), azul, vermelha)).containsExactly(de(azul, 25), de(vermelha, 0));
        CbcRules.Card[] festa = {card("SUP", "occasion:party", "color:black"), card("INF", "occasion:party", "color:black"),
                card("CAL", "occasion:night_out", "color:black")};
        assertThat(cartas(new Boutique3dNucleo(), festa)).containsExactly(de(festa[0], 33.33), de(festa[1], 33.33), de(festa[2], 33.33));
        assertThat(cartas(new Boutique3dNucleo(), festa[0], vermelha)).containsExactly(de(festa[0], 33), de(vermelha, 0));
    }

    @Test
    void regrasDoLookInteiroSaoDivididasEntreAsCartasQueAsCumprem() {
        CbcRules.Card sup = card("SUP", "occasion:casual", "material:linen");
        CbcRules.Card inf = card("INF", "occasion:beach", "material:leather");
        Entrega ensaio = comMaquiagem(vestir(sup, inf), "LABIOS", "CORAL", "GLOSS");
        assertThat(cartas(new RoadToGloryNucleo(), ensaio, sup, inf)).containsExactly(de(sup, 12.5), de(inf, 12.5));

        CbcRules.Card cima = card("SUP", "material:linen", "color:red", "brand:Farm");
        CbcRules.Card baixo = card("INF", "material:cotton", "color:orange");
        assertThat(cartas(new AroundTheWorldNucleo(), cima, baixo)).containsExactly(de(cima, 62.5), de(baixo, 37.5));

        CbcRules.Card[] azuis = {card("SUP", "color:navy"), card("INF", "color:blue"), card("CAL", "color:cobalt"), card("ACE", "color:red")};
        assertThat(cartas(new LabirintoNucleo(), azuis)).containsExactly(de(azuis[0], 33.33), de(azuis[1], 33.33), de(azuis[2], 33.33),
                de(azuis[3], 0));
    }

    @Test
    void cartaQueNaoPontuaDizOMotivoNoEfeito() {
        CbcRules.Card gucci = card("SUP", "brand:Gucci", "color:red");
        Contexto ctx = contexto(1L, gucci);
        assertThat(Efeito.motivo("MARCA_NAO_BR")).isEqualTo(new Efeito("MARCA_NAO_BR", 0, true));
        assertThat(new Efeito("MARCA_BR", 10).motivo()).isFalse();
        assertThat(new PassarelaNucleo().efeitos(gucci, ctx)).containsExactly(Efeito.motivo("MARCA_NAO_BR"));
        assertThat(new BatalhaLooksNucleo().efeitos(gucci, ctx)).containsExactly(Efeito.motivo("FORA_DA_FAMILIA"));
        assertThat(new DressTheStarNucleo().efeitos(gucci, ctx)).containsExactly(Efeito.motivo("FORA_DO_FIGURINO"));
        assertThat(new PersonagemFilmeNucleo().efeitos(gucci, ctx)).containsExactly(Efeito.motivo("FORA_DO_FIGURINO"));
        assertThat(new Boutique3dNucleo().efeitos(gucci, ctx)).containsExactly(Efeito.motivo("FORA_DO_PEDIDO"));
        assertThat(new LabirintoNucleo().efeitos(card("SUP"), ctx)).containsExactly(Efeito.motivo("SEM_FAMILIA_DE_COR"));
    }
}
