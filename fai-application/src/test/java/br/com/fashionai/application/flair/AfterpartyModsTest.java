package br.com.fashionai.application.flair;

import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Map;
import static org.assertj.core.api.Assertions.*;

/** MET Gala Heist: as cartas do deck mudam o avatar e o salão — e isso muda a facilidade de vencer. */
public class AfterpartyModsTest {
    public static FlairEngine.Card card(String sub, String hex, List<String> styles, List<String> occasions, String material, String rarity, Map<String, Integer> stats) {
        return new FlairEngine.Card(sub, sub, "upper_piece", sub, null, hex, null, null, styles, occasions, material, "ALL", stats, rarity, 1, 0, null, null);
    }
    public static Map<String, Integer> stats(int edge, int range, int clout, int glow, int sync) {
        return Map.of("EDGE", edge, "RANGE", range, "CLOUT", clout, "GLOW", glow, "ART", 30, "SYNC", sync);
    }
    /** deck escuro e discreto, de tênis: furtivo e ágil */
    static final List<FlairEngine.Card> STEALTH = List.of(
            card("casual_sneakers", "#111111", List.of("minimalist", "sporty"), List.of("casual"), "COTTON", "STANDARD", stats(40, 20, 40, 55, 100)),
            card("hoodie", "#1c1c24", List.of("basic"), List.of("casual"), "FLEECE", "STANDARD", stats(30, 20, 40, 55, 100)),
            card("jeans", "#20283a", List.of("classic"), List.of("casual"), "DENIM", "STANDARD", stats(30, 20, 40, 55, 100)));
    /** deck de gala: claro, statement, salto, peças raras de alta-cultura e muitas ocasiões */
    static final List<FlairEngine.Card> GALA = List.of(
            card("high_heels", "#f4e9d8", List.of("glam", "luxury"), List.of("formal", "party", "wedding", "night_out"), "LEATHER", "RARE", stats(80, 80, 90, 88, 50)),
            card("maxi_dress", "#fff6e0", List.of("statement", "luxury"), List.of("formal", "wedding", "ceremony", "party"), "SEQUIN", "LIMITED", stats(85, 80, 90, 88, 50)),
            card("clutch", "#ffe9a8", List.of("glam", "chic"), List.of("formal", "party", "ceremony", "date"), "SATIN", "RARE", stats(75, 80, 90, 88, 50)));

    @Test
    void deckEscuroEDiscretoDaFurtividadeAgilidadeEPenumbra() {
        var m = AfterpartyMods.of(STEALTH);
        assertThat(m.stealth()).isGreaterThan(80); assertThat(m.suspicionMul()).isLessThan(0.85);
        assertThat(m.agility()).isGreaterThan(60); assertThat(m.speedMul()).isGreaterThan(1.05);
        assertThat(m.light()).isEqualTo("PENUMBRA"); assertThat(m.zoneMul()).isLessThan(1);
        assertThat(m.vipRouteMs()).isZero();
    }

    @Test
    void deckDeGalaDaCarismaRotaVipEMultidaoMasPesaNaFurtividadeENaVelocidade() {
        var m = AfterpartyMods.of(GALA);
        assertThat(m.charm()).isGreaterThan(80); assertThat(m.distractMul()).isGreaterThan(1.3);
        assertThat(m.vipRouteMs()).isEqualTo(AfterpartyMods.VIP_ROUTE_MS);
        assertThat(m.crowd()).isGreaterThan(0.5); assertThat(m.guests()).isGreaterThan(4);
        assertThat(m.light()).isEqualTo("HOLOFOTES"); assertThat(m.zoneMul()).isGreaterThan(1);
        assertThat(m.stealth()).isLessThan(30); assertThat(m.suspicionMul()).isGreaterThan(1.1);
        assertThat(m.agility()).isLessThan(40); assertThat(m.speedMul()).isLessThan(1);
    }

    @Test
    void semCartasOuPartidaAntigaFicaNeutro() {
        assertThat(AfterpartyMods.of(List.of())).isEqualTo(AfterpartyMods.NEUTRAL);
        var old = AfterpartyEngine.start(List.of(), 1000); old.mods = null;
        AfterpartyEngine.tick(old, 2000);
        assertThat(old.energy).isEqualTo(100);
        assertThat(AfterpartyEngine.vipAccess(old, 1500)).isFalse();
    }

    @Test
    void asCartasMudamAFacilidadeDeVencer() {
        // mesma rota na vista dos seguranças, sem disfarce: o deck furtivo sobe a suspeita mais devagar que o de gala
        var stealth = AfterpartyEngine.start(List.of(), AfterpartyMods.of(STEALTH), 1000);
        var gala = AfterpartyEngine.start(List.of(), AfterpartyMods.of(GALA), 1000);
        for (var s : List.of(stealth, gala)) { s.x = 0; s.z = 2; AfterpartyEngine.tick(s, 3000); }
        assertThat(stealth.suspicion).isLessThan(gala.suspicion * 0.75);
        // penumbra: na beira da vista (x = 2,1) o furtivo já está fora; com holofotes, o de gala ainda é visto
        stealth.x = 2.1; gala.x = 2.1;
        assertThat(AfterpartyEngine.inGuardSight(stealth, 3000)).isFalse();
        assertThat(AfterpartyEngine.inGuardSight(gala, 3000)).isTrue();
        // rota VIP aberta nos primeiros 8 s só para o deck de alta-cultura
        assertThat(AfterpartyEngine.vipAccess(gala, 5000)).isTrue();
        assertThat(AfterpartyEngine.vipAccess(gala, 9500)).isFalse();
        assertThat(AfterpartyEngine.vipAccess(stealth, 5000)).isFalse();
        // velocidade: o mesmo passo anda mais com tênis
        var fast = AfterpartyEngine.start(List.of(), AfterpartyMods.of(STEALTH), 1000);
        var slow = AfterpartyEngine.start(List.of(), AfterpartyMods.of(GALA), 1000);
        for (var s : List.of(fast, slow)) AfterpartyEngine.apply(s, new AfterpartyEngine.Action("MOVE", null, 1, 0, false, "move_00001"), 1400);
        assertThat(fast.x).isGreaterThan(slow.x * 1.1);                                  // +12 % contra −3 %
    }
}
