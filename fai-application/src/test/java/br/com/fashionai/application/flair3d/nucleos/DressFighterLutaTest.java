package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Acionamento;
import br.com.fashionai.application.flair3d.Andamento;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.nucleos.DressFighterGolpes.Lutador;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static br.com.fashionai.application.flair3d.Flair3dFixtures.card;
import static br.com.fashionai.application.flair3d.Flair3dFixtures.naRodada;
import static br.com.fashionai.application.flair3d.Flair3dFixtures.vestir;
import static br.com.fashionai.application.flair3d.nucleos.DressFighterGolpes.ESQUIVA;
import static br.com.fashionai.application.flair3d.nucleos.DressFighterGolpes.FOCO;
import static br.com.fashionai.application.flair3d.nucleos.DressFighterGolpes.FOLEGO;
import static br.com.fashionai.application.flair3d.nucleos.DressFighterGolpes.FORTE;
import static br.com.fashionai.application.flair3d.nucleos.DressFighterGolpes.GUARDA;
import static br.com.fashionai.application.flair3d.nucleos.DressFighterGolpes.RAPIDO;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

/**
 * Dress Fighter como jogo de luta (auditoria dos jogos de 15/11): vida das duas, golpe pela cor da carta jogada no
 * lance, a leitura do próximo golpe da oponente, combos, nocaute e a luta que se vence com cartas Bronze jogando bem.
 */
class DressFighterLutaTest {
    final CbcRules.Card vermelha = card("SUP", "color:red", "ovr:55");
    final CbcRules.Card preta = card("INF", "color:black", "ovr:55");
    final CbcRules.Card verde = card("CAL", "color:green", "sub:casual_sneakers", "ovr:55");
    final CbcRules.Card amarela = card("ACE", "color:yellow", "ovr:55");
    final CbcRules.Card azul = card("ACE", "color:blue", "ovr:55");
    final CbcRules.Card branca = card("SUP", "color:white", "ovr:55");
    final CbcRules.Card[] deck = {vermelha, preta, verde, amarela, azul, branca};
    /** o que responde a cada golpe anunciado: esquiva o forte, guarda o rápido, jabs na guarda e na esquiva */
    final Map<String, List<CbcRules.Card>> resposta = Map.of(FORTE, List.of(verde, azul), RAPIDO, List.of(preta, branca),
            GUARDA, List.of(amarela, vermelha), ESQUIVA, List.of(amarela, azul));

    Resultado lutar(String arena, long semente, List<Acionamento> acionamentos) {
        return new DressFighterNucleo().pontuar(vestir(vermelha, preta, verde, amarela),
                naRodada(arena, semente, deck).comAndamento(new Andamento(1, acionamentos, List.of(), arena)));
    }

    @SuppressWarnings("unchecked")
    static Map<String, Object> luta(Resultado r) {
        return (Map<String, Object>) r.eventos().stream().filter(e -> e.codigo().equals("LUTA")).reduce((a, b) -> b).orElseThrow().valor();
    }

    /** Joga a luta inteira lendo o golpe anunciado e respondendo com a carta certa (sem repetir a carta). */
    Resultado jogarBem(String arena, long semente) {
        List<Acionamento> feitos = new ArrayList<>();
        Resultado r = lutar(arena, semente, feitos);
        CbcRules.Card anterior = null;
        while (!r.fecha()) {
            String proximo = (String) luta(r).get("proximo");
            CbcRules.Card c = resposta.get(proximo).get(0) == anterior ? resposta.get(proximo).get(1) : resposta.get(proximo).get(0);
            feitos.add(new Acionamento(c.id(), null));
            anterior = c;
            r = lutar(arena, semente, feitos);
        }
        return r;
    }

    @Test
    void aEntregaAbreALutaComAsDuasVidasCheiasEALeituraDoPrimeiroGolpe() {
        Resultado r = lutar(null, 7L, List.of());
        assertThat(r.status()).isEqualTo("EM_ACAO");
        assertThat(luta(r)).containsEntry("vidaVoce", 100).containsEntry("vidaOponente", 100).containsEntry("lance", 0)
                .containsEntry("round", 1);
        assertThat(luta(r).get("proximo")).isIn(FORTE, RAPIDO, GUARDA, ESQUIVA);
        assertThat(lutar(null, 7L, List.of())).isEqualTo(r);
    }

    @Test
    void aCorDaCartaEhOGolpeEALeituraDizOGolpeDaOponente() {
        Resultado antes = lutar(null, 7L, List.of());
        Resultado depois = lutar(null, 7L, List.of(new Acionamento(vermelha.id(), null)));
        @SuppressWarnings("unchecked")
        Map<String, Object> lance = (Map<String, Object>) depois.eventos().get(0).valor();
        assertThat(lance).containsEntry("golpe", FORTE).containsEntry("golpeOponente", luta(antes).get("proximo"));
        assertThat((int) lance.get("vidaOponente")).isEqualTo(100 - (int) lance.get("dano"));
        assertThat(DressFighterLuta.golpeDa(branca, false)).isEqualTo(FOCO);
        assertThat(DressFighterLuta.golpeDa(azul, false)).isEqualTo(FOLEGO);
        assertThat(DressFighterLuta.golpeDa(null, false)).isEqualTo(DressFighterGolpes.GUARDA_BASICA);
    }

    @Test
    void guardaSeguraOForteEsquivaEvitaEFocoDevolve() {
        Lutador a = new Lutador(40, 20, 20);
        Lutador d = new Lutador(40, 40, 40);
        assertThat(DressFighterGolpes.dano(FORTE, a, 0, "NENHUMA", d)).isEqualTo(16);
        assertThat(DressFighterGolpes.dano(FORTE, a, 0, GUARDA, d)).isEqualTo(4);
        assertThat(DressFighterGolpes.dano(FORTE, a, 0, ESQUIVA, d)).isZero();
        assertThat(DressFighterGolpes.dano(RAPIDO, a, 0, ESQUIVA, d)).isEqualTo(6);
        assertThat(DressFighterGolpes.dano(RAPIDO, a, 0, GUARDA, d)).isEqualTo(8);
        assertThat(DressFighterGolpes.contraAtaque(a)).isEqualTo(12);
    }

    @Test
    void combosFecham() {
        assertThat(DressFighterCombos.fechado(List.of(GUARDA, RAPIDO, RAPIDO, FORTE))).isEqualTo(DressFighterCombos.RELAMPAGO);
        assertThat(DressFighterCombos.fechado(List.of(ESQUIVA, FORTE))).isEqualTo(DressFighterCombos.CONTRAGOLPE);
        assertThat(DressFighterCombos.fechado(List.of(GUARDA, FOCO))).isEqualTo(DressFighterCombos.MURALHA);
        assertThat(DressFighterCombos.fechado(List.of(FORTE, FORTE))).isNull();
        assertThat(DressFighterCombos.bonus(DressFighterCombos.RELAMPAGO)).isEqualTo(10);
    }

    @Test
    void mesmaCartaEmDoisLancesSeguidosNaoEntra() {
        Acionamento v = new Acionamento(vermelha.id(), null);
        ApiException e = catchThrowableOfType(ApiException.class, () -> lutar(null, 7L, List.of(v, v)));
        assertThat(e.status()).isEqualTo(422);
        assertThat(e.code()).isEqualTo("CARTA_CANSADA");
    }

    @Test
    void comCartasBronzeQuemLeAOponenteVenceNasTresArenasEQuemSoSegueNaoVence() {
        List<Acionamento> nada = java.util.Collections.nCopies(DressFighterLuta.LANCES, Acionamento.NENHUM);
        for (String arena : new String[]{null, DressFighterNucleo.ARENA_VELOZ, DressFighterNucleo.ARENA_BLINDADA}) {
            int jogandoBem = 0;
            int soSeguindo = 0;
            for (long s = 1; s <= 20; s++) {
                jogandoBem += "VITORIA".equals(jogarBem(arena, s).resultado()) ? 1 : 0;
                soSeguindo += "VITORIA".equals(lutar(arena, s, nada).resultado()) ? 1 : 0;
            }
            // medido: 14, 12 e 13 de 20 jogando bem; nenhuma só seguindo
            assertThat(jogandoBem).as(String.valueOf(arena)).isGreaterThanOrEqualTo(10);
            assertThat(soSeguindo).as(String.valueOf(arena)).isZero();
        }
    }

    @Test
    void semJogarCartaALutaAcabaEmNoveLancesComTresRounds() {
        List<Acionamento> nada = new ArrayList<>();
        for (int i = 0; i < DressFighterLuta.LANCES; i++) {
            nada.add(Acionamento.NENHUM);
        }
        Resultado fim = lutar(null, 7L, nada);
        assertThat(fim.fecha()).isTrue();
        assertThat(fim.eventos().stream().filter(e -> e.codigo().equals("ROUND"))).hasSize(3);
        assertThat(fim.resultado()).isEqualTo("DERROTA");
    }
}
