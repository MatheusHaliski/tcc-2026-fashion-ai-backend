package br.com.fashionai.application.acervo;

import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.acervo.AcervoCompartimento;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.acervo.AcervoKit.de;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * O lugar da peça no ACERVO, lido pelas outras funcionalidades (Espelho, Copilot, Inventory Score) no lugar do endereço
 * do Meu Quarto, retirado em 15/11/2026: caminho legível, tipo do compartimento, móvel e se é o guarda-roupa real.
 */
class AcervoLugaresTest {
    private final AcervoKit kit = new AcervoKit();
    private final AcervoLugares lugares = new AcervoLugares(kit.ambientes, kit.moveis, kit.compartimentos, kit.linhas);

    @Test
    void pecaGuardadaTemCaminhoTipoEMovelPecaSemLugarNaoAparece() {
        Map<String, Object> armario = kit.armario(kit.ana);
        WardrobeItem camisa = kit.peca(kit.ana, "Camisa", "upper_piece", "shirt", "white", "M", null);
        WardrobeItem meia = kit.peca(kit.ana, "Meia", "accessory_piece", "socks", "black", "U", null);
        UUID cabideiro = AcervoKit.compartimento(armario, AcervoCompartimento.CABIDEIRO, 0);
        kit.pecas.mover(de(kit.ana), new AcervoPecasService.MoverForm(List.of(camisa.getId()), cabideiro));

        Map<UUID, AcervoLugares.Lugar> mapa = lugares.deUsuario(kit.ana.getId());

        assertThat(mapa).containsOnlyKeys(camisa.getId());
        AcervoLugares.Lugar lugar = mapa.get(camisa.getId());
        assertThat(lugar.compartimentoId()).isEqualTo(cabideiro);
        assertThat(lugar.movelId()).isEqualTo(armario.get("id"));
        assertThat(lugar.caminho()).startsWith("Closet / Armário 01 / ");
        assertThat(lugar.tipo()).isEqualTo(AcervoCompartimento.CABIDEIRO);
        assertThat(lugar.meuEspaco()).isTrue();
        assertThat(mapa).doesNotContainKey(meia.getId());
    }

    @Test
    void soAsPecasDaPropriaPessoaESemAcervoOMapaFicaVazio() {
        Map<String, Object> armario = kit.armario(kit.ana);
        WardrobeItem camisa = kit.peca(kit.ana, "Camisa", "upper_piece", "shirt", "white", "M", null);
        kit.pecas.mover(de(kit.ana), new AcervoPecasService.MoverForm(List.of(camisa.getId()),
                AcervoKit.compartimento(armario, AcervoCompartimento.GAVETA, 0)));

        assertThat(lugares.deUsuario(kit.bia.getId())).isEmpty();
        assertThat(lugares.deUsuario(kit.ana.getId())).containsOnlyKeys(camisa.getId());
    }

    @Test
    void tipoEsperadoEhARegraDoModoArrumacao() {
        WardrobeItem blazer = kit.peca(kit.ana, "Blazer", "upper_piece", "blazer", "navy", "M", null);
        WardrobeItem jeans = kit.peca(kit.ana, "Jeans", "lower_piece", "jeans", "blue", "40", null);
        WardrobeItem colar = kit.peca(kit.ana, "Colar", "accessory_piece", "necklace", "gold", "U", null);

        assertThat(AcervoLugares.tipoEsperado(blazer)).isEqualTo(AcervoCompartimento.CABIDEIRO);
        assertThat(AcervoLugares.tipoEsperado(jeans)).isEqualTo(AcervoCompartimento.PRATELEIRA);
        assertThat(AcervoLugares.tipoEsperado(colar)).isEqualTo(AcervoCompartimento.GAVETA);
    }
}
