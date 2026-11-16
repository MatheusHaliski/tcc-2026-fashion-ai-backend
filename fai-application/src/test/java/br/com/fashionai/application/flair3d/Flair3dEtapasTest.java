package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.nucleos.DressFighterNucleo;
import br.com.fashionai.application.flair3d.nucleos.FashionSportsNucleo;
import br.com.fashionai.application.flair3d.nucleos.LabirintoNucleo;
import org.junit.jupiter.api.Test;

import java.util.List;

import static br.com.fashionai.application.flair3d.Flair3dFixtures.card;
import static br.com.fashionai.application.flair3d.Flair3dFixtures.contexto;
import static br.com.fashionai.application.flair3d.Flair3dFixtures.vestir;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * FLAIR 3D — os núcleos em etapas, direto na estratégia (a luta do DRESS_FIGHTER está em DressFighterLutaTest): os
 * dois tempos do FASHION_SPORTS com a troca do intervalo e as apresentações do LABIRINTO. Tudo sai da semente, da entrega
 * e do andamento, então repetir a etapa dá o mesmo resultado.
 */
class Flair3dEtapasTest {
    final CbcRules.Card[] look = {card("SUP"), card("INF"), card("CAL", "sub:casual_sneakers"), card("ACE")};

    @Test
    void previaDosJogosAutomaticosSoTrazAtributos() {
        Resultado luta = new DressFighterNucleo().previa(vestir(look), contexto(7L, look));
        assertThat(luta.eventos()).containsExactly(new Resultado.Evento("VELOCIDADE", 44), new Resultado.Evento("ATAQUE", 24),
                new Resultado.Evento("DEFESA", 24));
        assertThat(luta.pontos()).isZero();
        assertThat(luta.regras()).isEmpty();
        CbcRules.Card[] uniforme = {card("SUP", "ovr:90"), card("INF", "ovr:90"), card("CAL", "ovr:90", "sub:casual_sneakers")};
        Resultado jogo = new FashionSportsNucleo().previa(vestir(uniforme), contexto(7L, uniforme));
        assertThat(jogo.eventos()).extracting(Resultado.Evento::codigo)
                .containsExactly("VELOCIDADE", "TECNICA", "RESISTENCIA", "DEFESA", "FISICO", "COESAO");
        assertThat(jogo.resultado()).isEqualTo("PREVIA");
    }

    @Test
    void labirintoPerdeEstrelasACadaApresentacaoMasAbre() {
        CbcRules.Card[] azuis = {card("SUP", "color:navy"), card("INF", "color:blue"), card("CAL", "color:cobalt")};
        LabirintoNucleo n = new LabirintoNucleo();
        int[] pontos = {100, 80, 60, 0, 0};
        int[] estrelas = {3, 2, 1, 0, 0};
        for (int tentativa = 1; tentativa <= 5; tentativa++) {
            Resultado r = n.pontuar(vestir(azuis), contexto(7L, azuis).comAndamento(new Andamento(tentativa, List.of())));
            assertThat(r.pontos()).isEqualTo(pontos[tentativa - 1]);
            assertThat(r.estrelas()).isEqualTo(estrelas[tentativa - 1]);
            assertThat(r.resultado()).isEqualTo("ABRE");
            assertThat(r.fecha()).isTrue();
            assertThat(r.eventos()).contains(new Resultado.Evento("TENTATIVA", tentativa));
        }
        CbcRules.Card vermelha = card("CAL", "color:red");
        Resultado fechado = n.pontuar(vestir(azuis[0], azuis[1], vermelha), contexto(7L, azuis[0], azuis[1], vermelha));
        assertThat(fechado.status()).isEqualTo("ABERTA");
        assertThat(fechado.fecha()).isFalse();
        assertThat(fechado.resultado()).isEqualTo("NAO_ABRE");
        assertThat(fechado.eventos()).contains(new Resultado.Evento("FALTAM_PECAS", 1), new Resultado.Evento("TENTATIVA", 1));
        assertThat(fechado.regras()).containsExactly(new Resultado.RegraResultado("MESMA_FAMILIA", false, 0));
    }
}
