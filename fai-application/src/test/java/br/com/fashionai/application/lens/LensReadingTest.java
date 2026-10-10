package br.com.fashionai.application.lens;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * RF54 §5.3/§10.1 · Leitura do look (composição de estilo, paleta, ocasiões, estação) e Hype do grupo de peças públicas
 * parecidas: chaves no formato do HypeSnapshotService.attributeKeys e "dados insuficientes" abaixo de 5 itens.
 */
class LensReadingTest {
    static LensReading.Piece piece(String cat, String sub, String material, List<String> styles, String color, double area) {
        return new LensReading.Piece(UUID.randomUUID(), cat, sub, material, styles, List.of("casual"),
                color == null ? List.of() : List.of(new LensViews.ColorShare(color, null, 1.0)), area);
    }

    @Test
    void composicaoDeEstiloSomaCemEAPecaMaiorPesaMais() {
        List<LensReading.Piece> ps = List.of(
                piece("upper_piece", "jacket", null, List.of("streetwear", "urban"), "denim", 0.30),
                piece("lower_piece", "jeans", null, List.of("casual"), "blue", 0.20),
                piece("accessory_piece", "ring", null, List.of("minimalist"), "gold", 0.01));
        List<LensViews.StyleShare> st = LensReading.styles(ps);
        assertThat(st.stream().mapToInt(LensViews.StyleShare::share).sum()).isEqualTo(100);
        assertThat(st.get(0).key()).isEqualTo("casual");                   // 0,20 inteira contra 0,15 + 0,15 da jaqueta
        assertThat(st).extracting(LensViews.StyleShare::key).contains("streetwear", "urban", "minimalist");
        assertThat(LensReading.styles(List.of(piece("upper_piece", "jacket", null, List.of(), null, 0.3)))).isEmpty();
    }

    @Test
    void paletaOcasioesEEstacao() {
        List<LensReading.Piece> ps = List.of(piece("upper_piece", "coat", "WOOL", List.of(), "camel", 0.4),
                piece("lower_piece", "tailored_pants", null, List.of(), "black", 0.2));
        assertThat(LensReading.palette(ps)).extracting(LensViews.PaletteColor::name).containsExactly("camel", "black");
        assertThat(LensReading.palette(ps).get(0).hex()).isEqualTo("#B98E5E");
        assertThat(LensReading.occasions(ps)).containsExactly("casual");
        assertThat(LensReading.season(ps)).isEqualTo("winter");
        assertThat(LensReading.season(List.of(piece("lower_piece", "shorts", null, List.of(), null, 0.2)))).isEqualTo("summer");
        assertThat(LensReading.season(List.of(piece("lower_piece", "jeans", null, List.of(), null, 0.2)))).isNull();
    }

    @Test
    void chavesNoFormatoDoHypeSnapshotNaOrdemCorEstiloMaterial() {
        assertThat(LensReading.groupKeys("upper_piece", "light_blue", "COTTON", List.of("casual")))
                .containsExactly("cc:upper_piece|light_blue", "st:upper_piece|casual", "cm:upper_piece|COTTON");
        assertThat(LensReading.groupKeys(null, "black", null, List.of())).isEmpty();
    }

    static List<LensReading.Member> members(int n, Set<String> keys, double score, Double delta) {
        List<LensReading.Member> out = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            out.add(new LensReading.Member(keys, score + i, delta));
        }
        return out;
    }

    @Test
    void hypeDoGrupoPedeCincoItensPublicos() {
        List<String> keys = List.of("cc:upper_piece|denim", "st:upper_piece|casual");
        LensViews.Trend few = LensReading.trend(keys, members(4, Set.of("cc:upper_piece|denim"), 60, 5.0), s -> "HOT", 2);
        assertThat(few.status()).isEqualTo("INSUFFICIENT_DATA");
        assertThat(few.score()).isNull();
        assertThat(few.items()).isEqualTo(4);

        LensViews.Trend ok = LensReading.trend(keys, members(5, Set.of("cc:upper_piece|denim"), 60, 5.0), s -> s >= 60 ? "HOT" : "RELEVANT", 2);
        assertThat(ok.status()).isEqualTo("AVAILABLE");
        assertThat(ok.key()).isEqualTo("cc:upper_piece|denim");
        assertThat(ok.score()).isEqualTo(62);                               // média de 60..64
        assertThat(ok.level()).isEqualTo("HOT");
        assertThat(ok.direction()).isEqualTo("UP");
        assertThat(ok.items()).isEqualTo(5);
        assertThat(ok.label()).contains("·");
    }

    @Test
    void corPrimeiroDepoisEstiloEDirecaoPelaVariacaoMedia() {
        List<String> keys = List.of("cc:upper_piece|denim", "st:upper_piece|casual");
        List<LensReading.Member> ms = new ArrayList<>(members(3, Set.of("cc:upper_piece|denim", "st:upper_piece|casual"), 40, -1.0));
        ms.addAll(members(3, Set.of("st:upper_piece|casual"), 40, -1.0));
        LensViews.Trend t = LensReading.trend(keys, ms, s -> "RELEVANT", 2);
        assertThat(t.key()).isEqualTo("st:upper_piece|casual");             // cor com 3 itens: cai para o estilo (6)
        assertThat(t.direction()).isEqualTo("STABLE");                       // |−1| < 2 pontos
        LensViews.Trend down = LensReading.trend(keys, members(5, Set.of("cc:upper_piece|denim"), 40, -9.0), s -> "RELEVANT", 2);
        assertThat(down.direction()).isEqualTo("DOWN");
        LensViews.Trend noDelta = LensReading.trend(keys, members(5, Set.of("cc:upper_piece|denim"), 40, null), s -> "RELEVANT", 2);
        assertThat(noDelta.direction()).isNull();
    }

    @Test
    void slotsDoRecriar() {
        assertThat(LensReading.slotOf("upper_piece")).isEqualTo("TOP");
        assertThat(LensReading.slotOf("lower_piece")).isEqualTo("BOTTOM");
        assertThat(LensReading.slotOf("full_body_piece")).isEqualTo("FULL");
        assertThat(LensReading.slotOf("shoes_piece")).isEqualTo("SHOES");
        assertThat(LensReading.slotOf("accessory_piece")).isEqualTo("ACCESSORY");
        assertThat(LensReading.slotOf(null)).isNull();
    }
}
