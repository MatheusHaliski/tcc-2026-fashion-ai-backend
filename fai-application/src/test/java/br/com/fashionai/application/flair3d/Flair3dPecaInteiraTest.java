package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.nucleos.Boutique3dNucleo;
import br.com.fashionai.application.flair3d.nucleos.DressTheStarNucleo;
import br.com.fashionai.application.flair3d.nucleos.FashionSportsNucleo;
import br.com.fashionai.application.flair3d.nucleos.PersonagemFilmeNucleo;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.flair3d.Flair3dFixtures.card;
import static br.com.fashionai.application.flair3d.Flair3dFixtures.contexto;
import static br.com.fashionai.application.flair3d.Flair3dFixtures.vestir;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

/**
 * A peça inteira (auditoria dos jogos, PF-1 e mudança 8): no Personagem de Filme o vestido veste e conta como a parte
 * de cima e a de baixo; o deck recusa a carta de uma posição que o jogo não tem onde vestir, dizendo qual é; no Fashion
 * Sports toda carta entra (fora do uniforme, ela é jogada na mão). A nota do futebol é só o placar: a coesão do
 * uniforme é atributo do time, não regra de 0 ponto (ESP-2).
 */
class Flair3dPecaInteiraTest {
    private final PersonagemFilmeNucleo filme = new PersonagemFilmeNucleo();

    private static Map<UUID, CbcRules.Card> porId(CbcRules.Card... cartas) {
        Map<UUID, CbcRules.Card> m = new LinkedHashMap<>();
        for (CbcRules.Card c : cartas) {
            m.put(c.id(), c);
        }
        return m;
    }

    private static double pontosDa(Resultado r, CbcRules.Card c) {
        return r.cartas().stream().filter(x -> x.cardId().equals(c.id())).findFirst().orElseThrow().pontos();
    }

    @Test
    void oVestidoPretoVesteOFigurinoNoirEContaComoCimaEBaixo() {
        CbcRules.Card vestido = card("VES", "color:black");
        CbcRules.Card bota = card("CAL", "color:black");
        assertThat(filme.definicao().vagas()).contains("VES");
        Entrega e = new Entrega(vestir(vestido, bota).cartas(), null, null, PersonagemFilmeNucleo.CERTO);
        Resultado r = filme.pontuar(e, contexto(1L, vestido, bota));
        // título 50 + cima 12,5 + baixo 12,5 (o vestido) + calçado 12,5
        assertThat(r.pontos()).isEqualTo(88);
        assertThat(r.regras()).extracting(Resultado.RegraResultado::codigo)
                .containsExactly("TITULO", "FIGURINO_SUP", "FIGURINO_INF", "FIGURINO_CAL", "FIGURINO_ACE");
        assertThat(r.regras()).extracting(Resultado.RegraResultado::ok).containsExactly(true, true, true, true, false);
        assertThat(pontosDa(r, vestido)).isEqualTo(25);
        assertThat(pontosDa(r, bota)).isEqualTo(12.5);
        assertThat(filme.efeitos(vestido, contexto(1L, vestido))).containsExactly(new Efeito("FIGURINO", 25));
    }

    @Test
    void comBlusaPorCimaOVestidoContaSoComoAParteDeBaixo() {
        CbcRules.Card vestido = card("VES", "color:black");
        CbcRules.Card amarela = card("SUP", "color:yellow");
        Entrega e = new Entrega(vestir(vestido, amarela).cartas(), null, null, PersonagemFilmeNucleo.CERTO);
        Resultado r = filme.pontuar(e, contexto(1L, vestido, amarela));
        // a parte de cima é a blusa amarela (fora do figurino); o vestido vale a parte de baixo
        assertThat(r.pontos()).isEqualTo(63);
        assertThat(pontosDa(r, vestido)).isEqualTo(12.5);
        assertThat(pontosDa(r, amarela)).isZero();
        // a prévia soma as mesmas partes, sem o título
        Resultado previa = filme.previa(e, contexto(1L, vestido, amarela).naRodada(PersonagemFilmeNucleo.DECADA));
        assertThat(previa.regras()).extracting(Resultado.RegraResultado::codigo)
                .containsExactly("FIGURINO_SUP", "FIGURINO_INF", "FIGURINO_CAL", "FIGURINO_ACE");
    }

    @Test
    void oDeckDoFilmeAceitaOVestidoNoLugarDaParteDeCima() {
        CbcRules.Card vestido = card("VES", "color:black");
        Definicao.Deck deck = filme.definicao().deck();
        assertThat(deck.posicoes()).containsExactly("SUP", "INF", "CAL", "ACE", "VES");
        Flair3dDeck.validar(deck, List.of(vestido.id()), porId(vestido));
    }

    @Test
    void oDeckRecusaACartaQueOJogoNaoTemOndeVestirEDizQualE() {
        CbcRules.Card sup = card("SUP");
        CbcRules.Card inf = card("INF");
        CbcRules.Card vestido = card("VES");
        CbcRules.Card colar = card("ACE");
        Definicao.Deck estrela = new DressTheStarNucleo().definicao().deck();
        ApiException recusa = (ApiException) catchThrowable(
                () -> Flair3dDeck.validar(estrela, List.of(sup.id(), inf.id(), vestido.id()), porId(sup, inf, vestido)));
        assertThat(recusa.status()).isEqualTo(422);
        assertThat(recusa.code()).isEqualTo("DECK_INVALIDO");
        assertThat(recusa.details().get("semVaga")).isEqualTo(List.of(Map.of("cardId", vestido.id(), "posicao", "VES")));
        // a Boutique só veste cima, baixo e calçado: o acessório também fica de fora
        Definicao.Deck boutique = new Boutique3dNucleo().definicao().deck();
        assertThat(Flair3dDeck.semVaga(boutique, porId(sup, inf, colar, vestido))).extracting(m -> m.get("posicao")).containsExactly("ACE", "VES");
        // sem a carta recusada, o deck abre
        Flair3dDeck.validar(estrela, List.of(sup.id(), inf.id()), porId(sup, inf));
    }

    @Test
    void noFashionSportsTodaCartaEntraNoDeckEANotaESoOPlacar() {
        FashionSportsNucleo esporte = new FashionSportsNucleo();
        CbcRules.Card vestido = card("VES");
        CbcRules.Card colar = card("ACE");
        assertThat(Flair3dDeck.semVaga(esporte.definicao().deck(), porId(vestido, colar))).isEmpty();
        assertThat(esporte.definicao().objetivo().regras()).extracting(Definicao.Regra::codigo).containsExactly("VITORIA", "EMPATE");
        // a coesão continua à vista como atributo do time, na prévia
        CbcRules.Card sup = card("SUP");
        assertThat(esporte.previa(vestir(sup), contexto(1L, sup)).eventos()).extracting(Resultado.Evento::codigo).contains("COESAO");
    }
}
