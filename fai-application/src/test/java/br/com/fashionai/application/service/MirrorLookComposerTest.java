package br.com.fashionai.application.service;

import br.com.fashionai.domain.model.WardrobeItem;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Vista-me sem IA, por ocasião, humor e clima (MirrorLookComposer). Cobre o que estava errado no localCompose antigo:
 * casaco ocupando a parte de cima no frio (look sem parte de cima), blazer/sapato social na academia e na praia, humor
 * ignorado, combinações já mostradas de outro pedido esgotando as opções, e a regra de palavra inteira das ocasiões.
 */
class MirrorLookComposerTest {
    private static WardrobeItem w(String category, String sub, String occasions, String styles) {
        WardrobeItem w = new WardrobeItem();
        w.assignId(UUID.randomUUID());
        w.setName(sub);
        w.setCategory(category);
        w.setSubcategory(sub);
        w.setOccasionTags(occasions);
        w.setStyleTags(styles);
        w.setDisponivel(true);
        return w;
    }

    private final WardrobeItem tee = w("upper_piece", "t_shirt", "casual", "basic");
    private final WardrobeItem shirt = w("upper_piece", "shirt", "work", "classic");
    private final WardrobeItem tank = w("upper_piece", "tank_top", "gym", "sporty");
    private final WardrobeItem blazer = w("upper_piece", "blazer", "work,formal", "tailored");
    private final WardrobeItem coat = w("upper_piece", "coat", "casual", "classic");
    private final WardrobeItem jeans = w("lower_piece", "jeans", "casual", "basic");
    private final WardrobeItem tailored = w("lower_piece", "tailored_pants", "work", "tailored");
    private final WardrobeItem leggings = w("lower_piece", "leggings", "gym", "athleisure");
    private final WardrobeItem shorts = w("lower_piece", "shorts", "beach", "basic");
    private final WardrobeItem oxford = w("shoes_piece", "oxford_shoes", "work,formal", "classic");
    private final WardrobeItem running = w("shoes_piece", "running_shoes", "gym", "sporty");
    private final WardrobeItem sandals = w("shoes_piece", "sandals", "beach", "resort");
    private final WardrobeItem sneakers = w("shoes_piece", "casual_sneakers", "casual", "basic");
    private final WardrobeItem watch = w("accessory_piece", "watch", "work", "classic");
    private final List<WardrobeItem> closet = List.of(tee, shirt, tank, blazer, coat, jeans, tailored, leggings, shorts, oxford, running,
            sandals, sneakers, watch);

    private static MirrorService.Interpretation ask(String prompt) {
        return MirrorPromptRules.localInterpretation(prompt, List.of());
    }

    private static List<String> subs(List<WardrobeItem> look) {
        return look.stream().map(WardrobeItem::getSubcategory).toList();
    }

    @Test
    void academiaSoPecasEsportivasSemBlazerNemSapatoSocial() {
        List<String> look = subs(MirrorLookComposer.compose(ask("Academia"), closet, Set.of()));
        assertThat(look).contains("tank_top", "leggings", "running_shoes").doesNotContain("blazer", "oxford_shoes", "coat");
    }

    @Test
    void praiaComPecasDePraiaENenhumCasaco() {
        List<String> look = subs(MirrorLookComposer.compose(ask("Praia"), closet, Set.of()));
        assertThat(look).contains("shorts", "sandals").doesNotContain("coat", "blazer", "oxford_shoes", "tailored_pants");
    }

    @Test
    void trabalhoElegantePegaPecasDeTrabalhoESemRegataNemTenisDeCorrida() {
        List<WardrobeItem> look = MirrorLookComposer.compose(ask("Trabalho, Elegante"), closet, Set.of());
        assertThat(subs(look)).contains("shirt", "tailored_pants", "oxford_shoes").doesNotContain("tank_top", "running_shoes", "leggings");
    }

    @Test
    void frioTemParteDeCimaEAcrescentaACamadaExterna() {
        List<WardrobeItem> look = MirrorLookComposer.compose(ask("Passeio, Frio"), closet, Set.of());
        assertThat(look.stream().map(MirrorService::slotOf)).contains("upper", "lower", "shoes", "outer_layer");
        assertThat(subs(look)).contains("coat");
    }

    @Test
    void calorNuncaLevaCamadaExterna() {
        List<WardrobeItem> look = MirrorLookComposer.compose(ask("Passeio, Calor"), closet, Set.of());
        assertThat(look.stream().map(MirrorService::slotOf)).doesNotContain("outer_layer");
    }

    @Test
    void ancoraSempreEntraMesmoForaDaOcasiao() {
        MirrorService.Interpretation it = MirrorPromptRules.localInterpretation("Academia", List.of(jeans.getId()));
        assertThat(MirrorLookComposer.compose(it, closet, Set.of())).contains(jeans);
    }

    @Test
    void combinacaoJaMostradaParaOPedidoVaiParaAProxima() {
        MirrorService.Interpretation it = ask("Academia");
        List<WardrobeItem> first = MirrorLookComposer.compose(it, closet, Set.of());
        List<WardrobeItem> second = MirrorLookComposer.compose(it, closet, Set.of(MirrorService.key(first.stream().map(WardrobeItem::getId).toList())));
        assertThat(second).isNotEmpty().isNotEqualTo(first);
    }

    @Test
    void listaCurtaParaAIaTemNoMaximoAsMelhoresDeCadaParteMaisAsAncoras() {
        List<WardrobeItem> big = new ArrayList<>(closet);
        for (int i = 0; i < 30; i++) {
            big.add(w("upper_piece", "t_shirt", "casual", "basic"));
        }
        MirrorService.Interpretation it = MirrorPromptRules.localInterpretation("Trabalho", List.of(tank.getId()));
        List<WardrobeItem> shortlist = MirrorLookComposer.shortlist(it, big, 8);
        assertThat(shortlist.stream().filter(x -> MirrorService.slotOf(x).equals("upper")).count()).isLessThanOrEqualTo(9);
        assertThat(shortlist).contains(tank);
    }

    @Test
    void ocasiaoPorPalavraInteiraEOrdemFixa() {
        assertThat(ask("casamento no sábado").occasion()).contains("wedding").doesNotContain("home");
        assertThat(ask("Casa").occasion()).containsExactly("home");
        assertThat(ask("solteiro").constraints()).doesNotContain("hot");
        assertThat(ask("Trabalho, Faculdade, Festa, Praia").occasion()).isEqualTo(ask("Trabalho, Faculdade, Festa, Praia").occasion());
        assertThat(MirrorPromptRules.recognized("Trabalho, Confortável")).isTrue();
        assertThat(MirrorPromptRules.recognized("")).isTrue();
        assertThat(MirrorPromptRules.recognized("quero algo com aquela jaqueta verde")).isFalse();
    }
}
