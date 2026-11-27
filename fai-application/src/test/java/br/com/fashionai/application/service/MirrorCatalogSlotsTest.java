package br.com.fashionai.application.service;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Regras do corpo para o produto do catálogo vestido no espelho: um lugar por parte seja a peça de quem for, a peça única
 * tira cima e baixo (e vice-versa), acessórios somados até 4, a peça da pessoa manda no lugar dividido e a referência fica
 * fora das chaves que salvar, usar hoje e o Vista-me leem.
 */
class MirrorCatalogSlotsTest {
    private final UUID tee = UUID.randomUUID(), jeans = UUID.randomUUID(), sneaker = UUID.randomUUID();

    private Map<String, Object> state(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) {
            m.put((String) kv[i], kv[i + 1]);
        }
        return m;
    }

    @Test
    void produtoTomaOLugarDaPecaDaPessoaEFicaForaDasChavesDoGuardaRoupa() {
        UUID shirt = UUID.randomUUID();
        Map<String, Object> slots = state("upper", tee.toString(), "lower", jeans.toString());
        MirrorCatalogSlots.wear(slots, "upper", shirt);
        assertThat(slots).doesNotContainKey("upper").containsEntry("lower", jeans.toString());
        assertThat(MirrorCatalogSlots.single(slots, "upper")).isEqualTo(shirt);
        // salvar, usar hoje e o Vista-me leem só as peças da pessoa
        assertThat(MirrorService.allIds(slots)).containsExactly(jeans);
        assertThat(MirrorService.complete(slots)).isFalse();
        assertThat(MirrorCatalogSlots.all(slots)).containsExactly(shirt);
    }

    @Test
    void pecaUnicaTiraCimaEBaixoDeQualquerOrigemEViceVersa() {
        UUID dress = UUID.randomUUID(), skirt = UUID.randomUUID();
        Map<String, Object> slots = state("upper", tee.toString(), "shoes", sneaker.toString());
        MirrorCatalogSlots.wear(slots, "lower", skirt);
        MirrorCatalogSlots.wear(slots, "dress", dress);
        assertThat(slots).doesNotContainKeys("upper", "lower").containsEntry("shoes", sneaker.toString());
        assertThat(MirrorCatalogSlots.all(slots)).containsExactly(dress);
        // a peça de baixo da pessoa tira a peça única do catálogo
        slots.put("lower", jeans.toString());
        assertThat(MirrorCatalogSlots.yieldToWardrobe(slots)).isTrue();
        assertThat(MirrorCatalogSlots.all(slots)).isEmpty();
        assertThat(slots).doesNotContainKey(MirrorCatalogSlots.KEY);
        assertThat(MirrorCatalogSlots.yieldToWardrobe(slots)).isFalse();
    }

    @Test
    void acessoriosSomadosNaoPassamDeQuatro() {
        List<String> own = new ArrayList<>();
        for (int i = 0; i < 4; i++) {
            own.add(UUID.randomUUID().toString());
        }
        Map<String, Object> slots = state("accessory", new ArrayList<>(own));
        UUID bag = UUID.randomUUID(), cap = UUID.randomUUID();
        MirrorCatalogSlots.wear(slots, "accessory", bag);
        // sem produto para sair, sai o acessório mais antigo da pessoa
        assertThat(MirrorService.accessories(slots)).hasSize(3).doesNotContain(UUID.fromString(own.get(0)));
        MirrorCatalogSlots.wear(slots, "accessory", cap);
        // com produto, sai primeiro o produto provado há mais tempo
        assertThat(MirrorService.accessories(slots)).hasSize(3);
        assertThat(MirrorCatalogSlots.accessories(slots)).containsExactly(cap);
        MirrorCatalogSlots.wear(slots, "accessory", cap);                       // repetir não duplica
        assertThat(MirrorCatalogSlots.accessories(slots)).containsExactly(cap);
        // a pessoa veste mais um acessório: o do catálogo cede o lugar
        List<String> four = new ArrayList<>(own.subList(1, 4));
        four.add(UUID.randomUUID().toString());
        slots.put("accessory", four);
        assertThat(MirrorCatalogSlots.yieldToWardrobe(slots)).isTrue();
        assertThat(MirrorCatalogSlots.accessories(slots)).isEmpty();
    }

    @Test
    void tirarEFicarSoComOsQueContinuamNoCatalogo() {
        UUID coat = UUID.randomUUID(), boot = UUID.randomUUID(), ring = UUID.randomUUID();
        Map<String, Object> slots = state("upper", tee.toString());
        MirrorCatalogSlots.wear(slots, "outer_layer", coat);
        MirrorCatalogSlots.wear(slots, "shoes", boot);
        MirrorCatalogSlots.wear(slots, "accessory", ring);
        assertThat(slots).containsEntry("upper", tee.toString());                // a jaqueta não tira a camiseta
        assertThat(MirrorCatalogSlots.all(slots)).containsExactly(coat, boot, ring);
        assertThat(MirrorCatalogSlots.remove(slots, boot)).isTrue();
        assertThat(MirrorCatalogSlots.remove(slots, boot)).isFalse();
        assertThat(MirrorCatalogSlots.retainOnly(slots, List.of(ring))).isTrue();
        assertThat(MirrorCatalogSlots.all(slots)).containsExactly(ring);
        assertThat(MirrorCatalogSlots.remove(slots, ring)).isTrue();
        assertThat(slots).doesNotContainKey(MirrorCatalogSlots.KEY);
    }

    @Test
    void lugarPelaCategoriaGravada() {
        assertThat(MirrorService.slotOf("upper_piece", "blazer")).isEqualTo("outer_layer");
        assertThat(MirrorService.slotOf("upper_piece", "t_shirt")).isEqualTo("upper");
        assertThat(MirrorService.slotOf("full_body_piece", "dress")).isEqualTo("dress");
        assertThat(MirrorService.slotOf("shoes_piece", null)).isEqualTo("shoes");
        assertThat(MirrorService.slotOf(null, null)).isEqualTo("accessory");
        assertThat(MirrorCatalogSlots.excluded("dress")).containsExactly("upper", "lower");
    }
}
