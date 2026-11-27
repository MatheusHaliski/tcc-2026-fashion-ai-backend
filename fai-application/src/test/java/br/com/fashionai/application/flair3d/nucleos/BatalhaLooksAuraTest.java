package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Andamento;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Flair3dFixtures;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A Aura dentro da rodada da Batalha de Looks (8g): o júri pela faixa de Hype entra na nota da rodada (na comparação
 * com a casa), o trunfo soma na rodada em que foi chamado e ganha o empate, e a carta Especial com Aura Metamorfose
 * vale na regra de qualquer desafio.
 */
class BatalhaLooksAuraTest {
    private static final BatalhaLooksRodadas.Desafio AZUL = BatalhaLooksRodadas.MONOCROMATICOS.get(0);

    private static CbcRules.Card comHype(String posicao, Integer hyp, String... etiquetas) {
        CbcRules.Card c = Flair3dFixtures.card(posicao, etiquetas);
        return new CbcRules.Card(c.id(), c.position(), c.tier(), c.ovr(), c.brand(), c.originType(), c.styles(), c.colors(), c.occasions(),
                c.materials(), hyp == null ? Map.of() : Map.of("HYP", hyp.doubleValue()), null, null, c.category(), c.subcategory());
    }

    @Test
    void oJuriEOTrunfoEntramNaNotaDaRodada() {
        CbcRules.Card sup = comHype("SUP", 80, "color:blue");
        CbcRules.Card inf = comHype("INF", 80, "color:blue");
        Map<String, CbcRules.Card> look = Map.of("SUP", sup, "INF", inf);
        Contexto ctx = Flair3dFixtures.contexto(3, sup, inf);
        BatalhaLooksPlacar.DaPessoa voce = BatalhaLooksPlacar.daPessoa(AZUL, look, look, List.of(), 1, ctx);
        assertThat(voce.nota().aura()).isEqualTo(4);
        assertThat(voce.nota().total()).isEqualTo(voce.nota().regra() + voce.nota().look() + 4);
        assertThat(voce.nota().paraTela()).containsEntry("aura", 4);
        // o trunfo chamado na etapa 1 vale na rodada 2, não na 1
        Contexto comTrunfo = ctx.comAndamento(Andamento.INICIO.comHype(new Andamento.TrunfoDeHype(sup.id(), "p", 1)));
        assertThat(BatalhaLooksPlacar.daPessoa(AZUL, look, look, List.of(), 1, comTrunfo).nota().aura()).isEqualTo(4);
        assertThat(BatalhaLooksPlacar.daPessoa(AZUL, look, look, List.of(), 2, comTrunfo).nota().aura()).isEqualTo(4 + 4);
        assertThat(BatalhaLooksVoto.venceu(100, 100, comTrunfo)).isTrue();
        assertThat(BatalhaLooksVoto.evento(true, comTrunfo).valor()).isEqualTo("HYPE");
    }

    @Test
    void aMetamorfoseDaCartaEspecialValeNaRegraDeQualquerDesafio() {
        CbcRules.Card especial = comHype("SUP", null, "color:red", "tier:ESPECIAL");
        Map<String, CbcRules.Card> look = Map.of("SUP", especial);
        Contexto sem = Flair3dFixtures.contexto(3, especial);
        Contexto com = sem.comAuras(Map.<UUID, String>of(especial.id(), "METAMORPHOSE"));
        assertThat(BatalhaLooksPlacar.daPessoa(AZUL, look, look, List.of(), 1, sem).nota().regra()).isZero();
        assertThat(BatalhaLooksPlacar.daPessoa(AZUL, look, look, List.of(), 1, com).nota().regra()).isEqualTo(25);
        // cansada (desfilou na rodada anterior), não vale: é a recarga do poder
        assertThat(BatalhaLooksPlacar.daPessoa(AZUL, look, Map.of(), List.of(), 2, com).nota().regra()).isZero();
    }
}
