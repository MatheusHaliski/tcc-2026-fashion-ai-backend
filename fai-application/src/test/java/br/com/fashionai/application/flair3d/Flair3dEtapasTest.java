package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.nucleos.DressFighterNucleo;
import br.com.fashionai.application.flair3d.nucleos.FashionSportsNucleo;
import br.com.fashionai.application.flair3d.nucleos.LabirintoNucleo;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static br.com.fashionai.application.flair3d.Flair3dFixtures.card;
import static br.com.fashionai.application.flair3d.Flair3dFixtures.contexto;
import static br.com.fashionai.application.flair3d.Flair3dFixtures.vestir;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

/**
 * FLAIR 3D — os núcleos em etapas, direto na estratégia: a luta do DRESS_FIGHTER round a round com a carta Especial, os
 * dois tempos do FASHION_SPORTS com a troca do intervalo e as apresentações do LABIRINTO. Tudo sai da semente, da entrega
 * e do andamento, então repetir a etapa dá o mesmo resultado.
 */
class Flair3dEtapasTest {
    static final Acionamento NADA = Acionamento.NENHUM;
    final CbcRules.Card[] look = {card("SUP"), card("INF"), card("CAL", "sub:casual_sneakers"), card("ACE")};
    final CbcRules.Card especial = card("ACE", "tier:ESPECIAL", "ovr:90");

    Resultado lutar(Acionamento... acionamentos) {
        CbcRules.Card[] todas = {look[0], look[1], look[2], look[3], especial};
        return new DressFighterNucleo().pontuar(vestir(look), contexto(7L, todas).comAndamento(Andamento.de(acionamentos)));
    }

    @SuppressWarnings("unchecked")
    static Map<String, Object> valor(Resultado.Evento e) {
        return (Map<String, Object>) e.valor();
    }

    @Test
    void aEntregaDaLutaJogaSoORound1EFicaEmAcao() {
        Resultado r = lutar();
        assertThat(r.status()).isEqualTo("EM_ACAO");
        assertThat(r.fecha()).isFalse();
        assertThat(r.pontos()).isZero();
        assertThat(r.regras()).isEmpty();
        assertThat(r.eventos()).hasSize(1);
        assertThat(r.eventos().get(0).codigo()).isEqualTo("ROUND");
        assertThat(valor(r.eventos().get(0))).containsEntry("round", 1).containsEntry("atributo", "VELOCIDADE").containsEntry("voce", 44)
                .containsEntry("oponente", 40).containsEntry("atacante", "VOCE").containsEntry("valorAtacante", 44)
                .containsEntry("valorDefensor", 40).containsEntry("venceu", true);
        assertThat(lutar()).isEqualTo(r);
    }

    @Test
    void aCartaEspecialSomaOPoderAoRoundSeguinteEViraALuta() {
        assertThat(DressFighterNucleo.poder(especial)).isEqualTo(29);
        Resultado semEspecial = lutar(NADA, NADA);
        assertThat(semEspecial.pontos()).isEqualTo(50);
        assertThat(semEspecial.resultado()).isEqualTo("DERROTA");
        assertThat(semEspecial.eventos()).hasSize(3).allMatch(e -> e.codigo().equals("ROUND"));
        assertThat(valor(semEspecial.eventos().get(2))).containsEntry("atacante", "OPONENTE").containsEntry("valorAtacante", 40)
                .containsEntry("valorDefensor", 24).containsEntry("venceu", false);

        Resultado round2 = lutar(new Acionamento(especial.id(), null));
        assertThat(round2.status()).isEqualTo("EM_ACAO");
        assertThat(round2.eventos()).extracting(Resultado.Evento::codigo).containsExactly("ROUND", "ESPECIAL", "ROUND");
        assertThat(valor(round2.eventos().get(1))).containsEntry("round", 2).containsEntry("carta", especial.id())
                .containsEntry("atributo", "ATAQUE").containsEntry("poder", 29);
        assertThat(valor(round2.eventos().get(2))).containsEntry("voce", 53).containsEntry("atacante", "VOCE").containsEntry("venceu", true);

        Resultado fim = lutar(new Acionamento(especial.id(), null), NADA);
        assertThat(fim.fecha()).isTrue();
        assertThat(fim.pontos()).isEqualTo(100);
        assertThat(fim.resultado()).isEqualTo("VITORIA");
        assertThat(fim.eventos()).hasSize(4);
        assertThat(fim.cartas()).hasSize(4).extracting(Resultado.CartaPontos::vaga).containsExactly("SUP", "INF", "CAL", "ACE");
        assertThat(fim.cartas().stream().mapToDouble(Resultado.CartaPontos::pontos).sum()).isCloseTo(100, org.assertj.core.data.Offset.offset(0.05));
        assertThat(fim.cartas().get(2).pontos()).isGreaterThan(fim.cartas().get(0).pontos());
    }

    @Test
    void soUmaEspecialPorLutaESoCartaEspecial() {
        Acionamento comEspecial = new Acionamento(especial.id(), null);
        ApiException duas = catchThrowableOfType(ApiException.class, () -> lutar(comEspecial, comEspecial));
        assertThat(duas.status()).isEqualTo(422);
        assertThat(duas.code()).isEqualTo("ESPECIAL_JA_USADA");
        ApiException comum = catchThrowableOfType(ApiException.class, () -> lutar(new Acionamento(look[3].id(), null)));
        assertThat(comum.status()).isEqualTo(422);
        assertThat(comum.code()).isEqualTo("CARTA_NAO_ESPECIAL");
        Resultado noTerceiro = lutar(NADA, comEspecial);
        assertThat(noTerceiro.eventos()).extracting(Resultado.Evento::codigo).containsExactly("ROUND", "ROUND", "ESPECIAL", "ROUND");
        assertThat(noTerceiro.pontos()).isEqualTo(100);
    }

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
                .containsExactly("VELOCIDADE", "TECNICA", "RESISTENCIA", "DEFESA", "FORCA_TIME", "COESAO");
        assertThat(jogo.resultado()).isEqualTo("PREVIA");
    }

    @Test
    void fashionSportsParaNoIntervaloEATrocaValeNoSegundoTempo() {
        CbcRules.Card sup = card("SUP", "ovr:90", "material:linen", "material:leather");
        CbcRules.Card inf = card("INF", "ovr:10");
        CbcRules.Card salto = card("CAL", "ovr:10", "sub:heels");
        CbcRules.Card chuteira = card("CAL", "ovr:90", "sub:casual_sneakers");
        Contexto ctx = contexto(7L, sup, inf, salto, chuteira);
        Entrega uniforme = vestir(sup, inf, salto);
        FashionSportsNucleo n = new FashionSportsNucleo();

        Resultado intervalo = n.pontuar(uniforme, ctx);
        assertThat(intervalo.status()).isEqualTo("EM_ACAO");
        assertThat(intervalo.pontos()).isZero();
        assertThat(intervalo.eventos()).contains(new Resultado.Evento("FORCA_TIME", 13), new Resultado.Evento("INTERVALO", "0-1"));
        assertThat(intervalo.eventos()).extracting(Resultado.Evento::codigo).doesNotContain("PLACAR");

        Resultado semTroca = n.pontuar(uniforme, contexto(7L, sup, inf, salto, chuteira).comAndamento(Andamento.de(NADA)));
        assertThat(semTroca.resultado()).isEqualTo("DERROTA");
        assertThat(semTroca.eventos()).contains(new Resultado.Evento("PLACAR", "0-2"), new Resultado.Evento("FORCA_SEGUNDO_TEMPO", 13));

        Acionamento troca = new Acionamento(null, new Acionamento.Troca("CAL", chuteira.id()));
        Resultado comTroca = n.pontuar(uniforme, contexto(7L, sup, inf, salto, chuteira).comAndamento(Andamento.de(troca)));
        assertThat(comTroca.fecha()).isTrue();
        assertThat(comTroca.resultado()).isEqualTo("EMPATE");
        assertThat(comTroca.pontos()).isEqualTo(60);
        assertThat(comTroca.eventos()).contains(new Resultado.Evento("INTERVALO", "0-1"), new Resultado.Evento("FORCA_SEGUNDO_TEMPO", 32),
                new Resultado.Evento("PLACAR", "1-1"), new Resultado.Evento("TROCA", Map.of("vaga", "CAL", "carta", chuteira.id())));
        assertThat(comTroca.cartas()).extracting(Resultado.CartaPontos::cardId).containsExactly(sup.id(), inf.id(), chuteira.id());
        assertThat(n.pontuar(uniforme, contexto(7L, sup, inf, salto, chuteira).comAndamento(Andamento.de(troca)))).isEqualTo(comTroca);
    }

    @Test
    void trocaPrecisaCaberNaVaga() {
        CbcRules.Card sup = card("SUP");
        CbcRules.Card inf = card("INF");
        CbcRules.Card cal = card("CAL");
        CbcRules.Card ace = card("ACE");
        FashionSportsNucleo n = new FashionSportsNucleo();
        for (Acionamento.Troca t : List.of(new Acionamento.Troca("CAL", inf.id()), new Acionamento.Troca("ACE", ace.id()),
                new Acionamento.Troca("SUP", null))) {
            ApiException e = catchThrowableOfType(ApiException.class, () -> n.pontuar(vestir(sup, inf, cal),
                    contexto(7L, sup, inf, cal, ace).comAndamento(Andamento.de(new Acionamento(null, t)))));
            assertThat(e.status()).isEqualTo(422);
            assertThat(e.code()).isEqualTo("TROCA_INVALIDA");
        }
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
