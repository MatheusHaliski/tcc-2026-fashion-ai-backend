package br.com.fashionai.application.flair3d.multi;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Flair3dDuelo;
import br.com.fashionai.application.flair3d.Flair3dFixtures;
import br.com.fashionai.application.flair3d.nucleos.BatalhaLooksDuelo;
import br.com.fashionai.application.flair3d.nucleos.DressFighterDuelo;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Os juízes dos duelos por turnos (puros): só julgam turnos completos, são simétricos (trocar os lados troca o
 * placar), a Batalha cansa a peça repetida, o Dress Fighter acaba no nocaute e o Sports conta gols.
 */
class Flair3dDuelosTest {
    private static Contexto ctx(String rodada) {
        return Flair3dFixtures.naRodada(rodada, 2026L);
    }

    private static Map<String, CbcRules.Card> carta(CbcRules.Card c) {
        return Map.of(Flair3dDuelo.CARTA, c);
    }

    @Test
    void batalhaSoJulgaTurnosCompletosESimetrica() {
        BatalhaLooksDuelo b = new BatalhaLooksDuelo();
        CbcRules.Card azulSup = Flair3dFixtures.card("SUP", "color:blue", "occasion:formal");
        CbcRules.Card azulInf = Flair3dFixtures.card("INF", "color:blue", "occasion:formal");
        CbcRules.Card vermelho = Flair3dFixtures.card("SUP", "color:red");
        List<Map<String, CbcRules.Card>> de = List.of(Map.of("SUP", azulSup, "INF", azulInf));
        List<Map<String, CbcRules.Card>> para = new ArrayList<>();
        Flair3dDuelo.Placar meio = b.julgar(ctx(b.rodada()), new Flair3dDuelo.Lado(List.of(), de), new Flair3dDuelo.Lado(List.of(), para));
        assertThat(meio.turnos()).isEmpty();
        assertThat(meio.encerrado()).isFalse();
        para.add(Map.of("SUP", vermelho));
        Flair3dDuelo.Placar um = b.julgar(ctx(b.rodada()), new Flair3dDuelo.Lado(List.of(), de), new Flair3dDuelo.Lado(List.of(), para));
        Flair3dDuelo.Placar trocado = b.julgar(ctx(b.rodada()), new Flair3dDuelo.Lado(List.of(), para), new Flair3dDuelo.Lado(List.of(), de));
        assertThat(um.de()).isEqualTo(trocado.para());
        assertThat(um.para()).isEqualTo(trocado.de());
        assertThat(BatalhaLooksDuelo.desafios(ctx(b.rodada()))).hasSize(3).doesNotHaveDuplicates();
    }

    @Test
    void batalhaCansaAPecaQueDesfilouNaRodadaAnterior() {
        BatalhaLooksDuelo b = new BatalhaLooksDuelo();
        CbcRules.Card sup = Flair3dFixtures.card("SUP", "color:blue", "occasion:formal", "material:wool");
        CbcRules.Card outra = Flair3dFixtures.card("SUP", "color:blue", "occasion:formal", "material:wool");
        List<Map<String, CbcRules.Card>> repete = List.of(Map.of("SUP", sup), Map.of("SUP", sup), Map.of("SUP", sup));
        List<Map<String, CbcRules.Card>> alterna = List.of(Map.of("SUP", sup), Map.of("SUP", outra), Map.of("SUP", sup));
        Flair3dDuelo.Placar p = b.julgar(ctx(b.rodada()), new Flair3dDuelo.Lado(List.of(), repete), new Flair3dDuelo.Lado(List.of(), alterna));
        assertThat(p.encerrado()).isTrue();
        assertThat(p.para()).isGreaterThanOrEqualTo(p.de());
        assertThat(p.vencedor()).isIn(Flair3dDuelo.DE, Flair3dDuelo.PARA);
    }

    @Test
    void dressFighterAteONocauteOuOFimDosLances() {
        DressFighterDuelo d = new DressFighterDuelo();
        CbcRules.Card forte = Flair3dFixtures.card("SUP", "color:red", "material:metal", "ovr:90");
        CbcRules.Card guarda = Flair3dFixtures.card("SUP", "color:black", "ovr:40");
        List<CbcRules.Card> deckDe = List.of(forte);
        List<CbcRules.Card> deckPara = List.of(guarda);
        List<Map<String, CbcRules.Card>> de = new ArrayList<>(Collections.nCopies(d.turnos(), carta(forte)));
        List<Map<String, CbcRules.Card>> para = new ArrayList<>(Collections.nCopies(d.turnos(), Map.<String, CbcRules.Card>of()));
        Flair3dDuelo.Placar p = d.julgar(ctx(null), new Flair3dDuelo.Lado(deckDe, de), new Flair3dDuelo.Lado(deckPara, para));
        assertThat(p.encerrado()).isTrue();
        assertThat(p.vencedor()).isEqualTo(Flair3dDuelo.DE);
        assertThat(p.de()).isEqualTo(100);
        assertThat(p.para()).isLessThan(100);
        Flair3dDuelo.Placar meio = d.julgar(ctx(null), new Flair3dDuelo.Lado(deckDe, de.subList(0, 2)), new Flair3dDuelo.Lado(deckPara, para.subList(0, 1)));
        assertThat(meio.turnos()).hasSize(1);
        assertThat(meio.encerrado()).isFalse();
    }

    @Test
    void fashionSportsContaGolsEAlternaOAtaque() {
        FashionSportsDuelo f = new FashionSportsDuelo();
        CbcRules.Card craque = Flair3dFixtures.card("CAL", "sub:sneakers", "material:metal", "ovr:99");
        List<Map<String, CbcRules.Card>> de = new ArrayList<>(Collections.nCopies(f.turnos(), carta(craque)));
        List<Map<String, CbcRules.Card>> para = new ArrayList<>(Collections.nCopies(f.turnos(), Map.<String, CbcRules.Card>of()));
        Flair3dDuelo.Placar p = f.julgar(ctx(null), new Flair3dDuelo.Lado(List.of(craque), de), new Flair3dDuelo.Lado(List.of(), para));
        assertThat(p.encerrado()).isTrue();
        assertThat(p.de()).isEqualTo(3);
        assertThat(p.vencedor()).isEqualTo(Flair3dDuelo.DE);
        assertThat(p.turnos().get(1)).containsEntry("atacante", Flair3dDuelo.PARA);
    }
}
