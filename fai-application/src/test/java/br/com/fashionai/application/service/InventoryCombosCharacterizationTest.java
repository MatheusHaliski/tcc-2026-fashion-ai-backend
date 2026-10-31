package br.com.fashionai.application.service;

import br.com.fashionai.domain.model.WardrobeItem;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Caracterização (lote GoF 08) da contagem de combinações válidas do Inventory Score (§3.4/§7), acessada por
 * {@code InventoryScoreService.combos} — a mesma porta usada pelo Copilot. Fixtures determinísticas (UUIDs fixos,
 * ocasiões explícitas); os valores esperados foram calculados à mão e confirmados no código anterior à extração.
 */
class InventoryCombosCharacterizationTest {

    private static int seq;

    private static WardrobeItem piece(String category, String occasions) {
        WardrobeItem w = new WardrobeItem();
        w.assignId(new UUID(0L, ++seq));
        w.setCategory(category);
        w.setOccasionTags(occasions);
        return w;
    }

    private static Map<String, Boolean> coverage(boolean work, boolean casual, boolean social, boolean sport, boolean party) {
        Map<String, Boolean> m = new LinkedHashMap<>();
        m.put("faculdade/trabalho", work);
        m.put("casual", casual);
        m.put("social", social);
        m.put("esporte", sport);
        m.put("festa", party);
        return m;
    }

    // ---------------------------------------------------------------- enumeração exata (trabalho ≤ 400.000)
    private final WardrobeItem u1 = piece("upper_piece", "casual,work");
    private final WardrobeItem u2 = piece("upper_piece", "party");
    private final WardrobeItem l1 = piece("lower_piece", "casual");
    private final WardrobeItem l2 = piece("lower_piece", "party, work");
    private final WardrobeItem s1 = piece("shoes_piece", "casual");
    private final WardrobeItem s2 = piece("shoes_piece", "party,work");
    private final WardrobeItem s3 = piece("shoes_piece", "wedding");
    private final WardrobeItem d1 = piece("full_body_piece", "wedding");
    private final WardrobeItem d2 = piece("full_body_piece", "party");
    private final WardrobeItem x1 = piece("accessory_piece", "casual");
    private final List<WardrobeItem> small = List.of(u1, u2, l1, l2, s1, s2, s3, d1, d2, x1);

    @Test
    void enumeracaoExataContaTotalPorPecaECobertura() {
        var c = InventoryScoreService.combos(small, 0, null);

        assertThat(c.enumerated()).isTrue();
        assertThat(c.total()).isEqualTo(5);
        assertThat(c.perPiece()).containsExactlyInAnyOrderEntriesOf(Map.of(
                u1.getId(), 2, u2.getId(), 1, l1.getId(), 1, l2.getId(), 2, s1.getId(), 1,
                s2.getId(), 3, s3.getId(), 1, d1.getId(), 1, d2.getId(), 1, x1.getId(), 0));
        assertThat(new ArrayList<>(c.coverage().entrySet()))
                .containsExactlyElementsOf(coverage(true, true, true, false, true).entrySet());
        assertThat(c.sample()).isEmpty();
    }

    @Test
    void amostraPulaCombinacoesJaDescobertasRespeitaOrdemELimite() {
        Set<String> discovered = Set.of(SchemeService.combinationKey(List.of(u1.getId(), l2.getId(), s2.getId())));

        var c = InventoryScoreService.combos(small, 3, discovered);

        assertThat(c.sample()).containsExactly(
                List.of(u1.getId(), l1.getId(), s1.getId()),
                List.of(u2.getId(), l2.getId(), s2.getId()),
                List.of(d1.getId(), s3.getId()));
        assertThat(c.total()).isEqualTo(5);
    }

    @Test
    void amostraSemLimiteIncluiVestidosEOrdemDeInsercao() {
        var c = InventoryScoreService.combos(small, 10, Set.of());

        assertThat(c.sample()).containsExactly(
                List.of(u1.getId(), l1.getId(), s1.getId()),
                List.of(u1.getId(), l2.getId(), s2.getId()),
                List.of(u2.getId(), l2.getId(), s2.getId()),
                List.of(d1.getId(), s3.getId()),
                List.of(d2.getId(), s2.getId()));
    }

    @Test
    void acervoVazioOuSemOcasioesNaoGeraCombinacoes() {
        var vazio = InventoryScoreService.combos(List.of(), 5, Set.of());
        assertThat(vazio.total()).isZero();
        assertThat(vazio.perPiece()).isEmpty();
        assertThat(vazio.enumerated()).isTrue();
        assertThat(new ArrayList<>(vazio.coverage().entrySet()))
                .containsExactlyElementsOf(coverage(false, false, false, false, false).entrySet());

        WardrobeItem semTag = piece("upper_piece", null);
        WardrobeItem calca = piece("lower_piece", "");
        WardrobeItem tenis = piece("shoes_piece", "casual");
        var c = InventoryScoreService.combos(List.of(semTag, calca, tenis), 5, Set.of());
        assertThat(c.total()).isZero();
        assertThat(c.perPiece()).containsOnlyKeys(semTag.getId(), calca.getId(), tenis.getId()).allSatisfy((k, v) -> assertThat(v).isZero());
    }

    // ---------------------------------------------------------------- limite 400.000 (inclusive enumera)
    private static List<WardrobeItem> grid(int uppers, int lowers, int shoes, int dresses) {
        List<WardrobeItem> out = new ArrayList<>();
        for (int i = 0; i < uppers; i++) {
            out.add(piece("upper_piece", "casual"));
        }
        for (int i = 0; i < lowers; i++) {
            out.add(piece("lower_piece", "gym"));
        }
        for (int i = 0; i < shoes; i++) {
            out.add(piece("shoes_piece", "beach"));
        }
        for (int i = 0; i < dresses; i++) {
            out.add(piece("full_body_piece", "date"));
        }
        return out;
    }

    @Test
    void limiteDeTrabalhoExatamente400MilAindaEnumera() {
        assertThat(InventoryScoreService.combos(grid(100, 100, 40, 0), 0, null).enumerated()).isTrue();
        assertThat(InventoryScoreService.combos(grid(100, 100, 40, 1), 0, null).enumerated()).isFalse();
    }

    // ---------------------------------------------------------------- contagem por grupos de ocasião (§7)
    @Test
    void acimaDoLimiteUsaLimiteInferiorPorOcasiao() {
        List<WardrobeItem> uppers = new ArrayList<>();
        List<WardrobeItem> lowersCasual = new ArrayList<>();
        List<WardrobeItem> lowersGym = new ArrayList<>();
        List<WardrobeItem> shoes = new ArrayList<>();
        List<WardrobeItem> dresses = new ArrayList<>();
        for (int i = 0; i < 80; i++) {
            uppers.add(piece("upper_piece", i < 40 ? "casual" : "casual,gym"));
        }
        for (int i = 0; i < 20; i++) {
            lowersGym.add(piece("lower_piece", "gym"));
        }
        for (int i = 0; i < 60; i++) {
            lowersCasual.add(piece("lower_piece", "casual"));
        }
        for (int i = 0; i < 70; i++) {
            shoes.add(piece("shoes_piece", "casual,gym"));
        }
        for (int i = 0; i < 5; i++) {
            dresses.add(piece("full_body_piece", "party"));
        }
        List<WardrobeItem> all = new ArrayList<>();
        all.addAll(uppers);
        all.addAll(lowersGym);
        all.addAll(lowersCasual);
        all.addAll(shoes);
        all.addAll(dresses);
        Set<String> discovered = Set.of();

        var c = InventoryScoreService.combos(all, 12, discovered);

        assertThat(c.enumerated()).isFalse();
        assertThat(c.total()).isEqualTo(336_000L);
        assertThat(c.sample()).isEmpty();
        assertThat(new ArrayList<>(c.coverage().entrySet()))
                .containsExactlyElementsOf(coverage(false, true, false, true, false).entrySet());
        assertThat(c.perPiece()).hasSize(235);
        uppers.forEach(w -> assertThat(c.perPiece().get(w.getId())).isEqualTo(4200));
        lowersCasual.forEach(w -> assertThat(c.perPiece().get(w.getId())).isEqualTo(5600));
        lowersGym.forEach(w -> assertThat(c.perPiece().get(w.getId())).isEqualTo(2800));
        shoes.forEach(w -> assertThat(c.perPiece().get(w.getId())).isEqualTo(4800));
        dresses.forEach(w -> assertThat(c.perPiece().get(w.getId())).isZero());
    }
}
