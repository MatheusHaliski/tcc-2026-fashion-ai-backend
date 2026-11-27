package br.com.fashionai.application.flair;

import br.com.fashionai.application.flair.CbcLinks.Attribute;
import br.com.fashionai.application.flair.CbcLinks.Edge;
import br.com.fashionai.application.flair.CbcLinks.Level;
import br.com.fashionai.application.flair.CbcLinks.Result;
import br.com.fashionai.application.flair.CbcRules.Card;
import br.com.fashionai.application.flair.CbcRules.Slot;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class CbcLinksTest {
    private static Card card(String position, String brand, String category, String subcategory, Set<String> styles, Set<String> colors,
                             Set<String> occasions) {
        return new Card(UUID.randomUUID(), position, "PRATA", 70, brand, "PIECE", styles, colors, occasions, Set.of(), Map.of(), null, null,
                category, subcategory);
    }

    private static final List<Slot> CHAIN = List.of(new Slot("cima", "SUP"), new Slot("baixo", "INF"), new Slot("pe", "CAL"));
    private static final List<Edge> EDGES = List.of(new Edge("cima", "baixo"), new Edge("baixo", "pe"));

    @Test
    void mesmaMarcaAcendeLinhaVerde() {
        Card a = card("SUP", "Atelier Lumi", "top", "shirt", Set.of("classic"), Set.of("red"), Set.of("work"));
        Card b = card("INF", "atelier lumi", "bottom", "jeans", Set.of("street"), Set.of("blue"), Set.of("party"));
        assertThat(CbcLinks.shared(a, b)).containsExactly(Attribute.BRAND);
        assertThat(CbcLinks.level(2)).isEqualTo(Level.GREEN);
    }

    @Test
    void umAtributoEmComumELaranjaENenhumEVermelho() {
        Card a = card("SUP", null, "top", null, Set.of("classic"), Set.of("red"), Set.of("work"));
        Card b = card("INF", null, "bottom", null, Set.of("classic"), Set.of("blue"), Set.of("party"));
        Card c = card("CAL", null, "shoes", null, Set.of("sporty"), Set.of("green"), Set.of("sport"));
        assertThat(CbcLinks.shared(a, b)).containsExactly(Attribute.STYLE);
        assertThat(CbcLinks.level(1)).isEqualTo(Level.ORANGE);
        assertThat(CbcLinks.shared(b, c)).isEmpty();
        assertThat(CbcLinks.level(0)).isEqualTo(Level.RED);
    }

    @Test
    void neutroSoCasaComNeutroNoLink() {
        assertThat(CbcLinks.colorMatch("black", "white")).isTrue();
        assertThat(CbcLinks.colorMatch("black", "red")).isFalse();
        assertThat(CbcLinks.colorMatch("red", "red")).isTrue();
    }

    @Test
    void elencoComLinhasVerdesSomaQuimica() {
        Card a = card("SUP", "Lumi", "top", null, Set.of("classic"), Set.of("black"), Set.of("work"));
        Card b = card("INF", "Lumi", "bottom", null, Set.of("classic"), Set.of("white"), Set.of("work"));
        Card c = card("CAL", "Lumi", "shoes", null, Set.of("classic"), Set.of("black"), Set.of("work"));
        Result r = CbcLinks.evaluate(CHAIN, EDGES, Map.of("cima", a, "baixo", b, "pe", c));
        assertThat(r.links()).extracting(CbcLinks.Link::level).containsOnly(Level.GREEN);
        assertThat(r.cardChemistry()).containsEntry("cima", 1).containsEntry("baixo", 2).containsEntry("pe", 1);
        assertThat(r.squadChemistry()).isEqualTo(44);                                   // 4 de 9
        assertThat(r.linksBy()).containsEntry(Attribute.BRAND, 2).containsEntry(Attribute.COLOR, 2);
    }

    @Test
    void cartaForaDaPosicaoApagaAsLinhasEZeraAQuimica() {
        Card a = card("SUP", "Lumi", "top", null, Set.of("classic"), Set.of("black"), Set.of("work"));
        Card errada = card("ACE", "Lumi", "bag", null, Set.of("classic"), Set.of("black"), Set.of("work"));
        Result r = CbcLinks.evaluate(CHAIN, EDGES, Map.of("cima", a, "baixo", errada));
        assertThat(r.links()).singleElement().satisfies(l -> {
            assertThat(l.level()).isEqualTo(Level.RED);
            assertThat(l.attributes()).isEmpty();
        });
        assertThat(r.cardChemistry()).containsEntry("baixo", 0).containsEntry("cima", 0);
        assertThat(r.count(Level.RED)).isEqualTo(1);
    }

    @Test
    void requisitosDeLink() {
        Card a = card("SUP", "Lumi", "top", null, Set.of("classic"), Set.of("black"), Set.of("work"));
        Card b = card("INF", "Lumi", "bottom", null, Set.of("street"), Set.of("red"), Set.of("party"));
        Card c = card("CAL", null, "shoes", null, Set.of("sporty"), Set.of("green"), Set.of("sport"));
        Map<String, Card> board = Map.of("cima", a, "baixo", b, "pe", c);
        Result r = CbcLinks.evaluate(CHAIN, EDGES, board);
        assertThat(CbcLinks.meets(r, Map.of("type", "greenLinks", "min", 1), board)).isTrue();
        assertThat(CbcLinks.meets(r, Map.of("type", "linksBy", "attribute", "brand", "count", 1), board)).isTrue();
        assertThat(CbcLinks.meets(r, Map.of("type", "linksBy", "attribute", "color", "count", 1), board)).isFalse();
        assertThat(CbcLinks.meets(r, Map.of("type", "noRedLinks", "slot", "cima"), board)).isTrue();
        assertThat(CbcLinks.meets(r, Map.of("type", "noRedLinks"), board)).isFalse();
        assertThat(CbcLinks.meets(r, Map.of("type", "chemistry", "min", 50), board)).isFalse();
        assertThat(CbcLinks.meets(r, Map.of("type", "cardChemistry", "min", 1), board)).isFalse();
        assertThat(CbcLinks.meets(r, Map.of("type", "banana"), board)).isFalse();
    }
}
