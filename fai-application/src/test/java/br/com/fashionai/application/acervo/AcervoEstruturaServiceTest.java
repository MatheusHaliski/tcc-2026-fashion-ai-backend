package br.com.fashionai.application.acervo;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.domain.model.WardrobeItem;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.acervo.AcervoKit.compartimento;
import static br.com.fashionai.application.acervo.AcervoKit.de;
import static br.com.fashionai.application.acervo.AcervoKit.movel;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** ACERVO — estrutura (ambiente → móvel → compartimento), lugar das peças e acesso só da dona. */
class AcervoEstruturaServiceTest {
    final AcervoKit kit = new AcervoKit();

    @SuppressWarnings("unchecked")
    static List<Map<String, Object>> lista(Object valor) {
        return (List<Map<String, Object>>) valor;
    }

    @Test
    void arvoreTrazAmbienteMovelCompartimentosEAsPecasSemLugar() {
        Map<String, Object> armario = kit.armario(kit.ana);
        kit.peca(kit.ana, "Camisa branca", "upper_piece", "shirt", "white", "M", "120.00");
        kit.peca(kit.bia, "Vestido", "full_body_piece", "dress", "red", "P", "300.00");

        Map<String, Object> arvore = kit.pecas.arvore(de(kit.ana));

        Map<String, Object> closet = lista(arvore.get("ambientes")).get(0);
        Map<String, Object> movel = lista(closet.get("moveis")).get(0);
        assertThat(closet).containsEntry("nome", "Closet");
        assertThat(movel).containsEntry("nome", "Armário 01").containsEntry("modo", "MEU_ESPACO").containsEntry("cor", "NOGUEIRA")
                .containsEntry("larguraCm", 120).containsEntry("id", armario.get("id"));
        assertThat(lista(movel.get("compartimentos"))).extracting(c -> c.get("nome"))
                .containsExactly("Cabideiro 1", "Prateleira 1", "Prateleira 2", "Gaveta 1", "Gaveta 2");
        assertThat(arvore).containsEntry("total", 1).containsEntry("semLugar", 1L);
        assertThat(lista(arvore.get("pecas")).get(0)).containsEntry("name", "Camisa branca").containsEntry("compartimentoId", null);
    }

    @Test
    void moverGuardaOLugarEAsContagensAcompanham() {
        Map<String, Object> armario = kit.armario(kit.ana);
        UUID cabideiro = compartimento(armario, "CABIDEIRO", 0);
        UUID gaveta = compartimento(armario, "GAVETA", 0);
        WardrobeItem camisa = kit.peca(kit.ana, "Camisa", "upper_piece", "shirt", "white", "M", null);
        WardrobeItem meia = kit.peca(kit.ana, "Meia", "accessory_piece", "socks", "black", "U", null);

        kit.pecas.mover(de(kit.ana), new AcervoPecasService.MoverForm(List.of(camisa.getId(), meia.getId()), cabideiro));
        kit.pecas.mover(de(kit.ana), new AcervoPecasService.MoverForm(List.of(meia.getId()), gaveta));

        Map<String, Object> arvore = kit.pecas.arvore(de(kit.ana));
        Map<String, Object> movel = lista(lista(arvore.get("ambientes")).get(0).get("moveis")).get(0);
        assertThat(movel).containsEntry("pecas", 2L);
        assertThat(lista(movel.get("compartimentos"))).filteredOn(c -> c.get("id").equals(gaveta)).singleElement()
                .satisfies(c -> assertThat(c).containsEntry("pecas", 1L));
        assertThat(lista(arvore.get("pecas"))).filteredOn(p -> p.get("id").equals(meia.getId())).singleElement()
                .satisfies(p -> assertThat(p).containsEntry("compartimentoId", gaveta).containsEntry("caminho", "Closet / Armário 01 / Gaveta 1"));
        assertThat(kit.linhas.findAll()).hasSize(2);

        kit.pecas.mover(de(kit.ana), new AcervoPecasService.MoverForm(List.of(meia.getId()), null));
        assertThat(kit.pecas.arvore(de(kit.ana))).containsEntry("semLugar", 1L);
    }

    @Test
    void outraPessoaNaoLeNemMexeNoQueEDaAna() {
        Map<String, Object> armario = kit.armario(kit.ana);
        UUID gaveta = compartimento(armario, "GAVETA", 0);
        WardrobeItem daAna = kit.peca(kit.ana, "Camisa", "upper_piece", "shirt", "white", "M", null);
        WardrobeItem daBia = kit.peca(kit.bia, "Saia", "lower_piece", "skirt", "blue", "P", null);

        assertThat(lista(kit.pecas.arvore(de(kit.bia)).get("ambientes"))).isEmpty();
        assertThatThrownBy(() -> kit.pecas.mover(de(kit.bia), new AcervoPecasService.MoverForm(List.of(daBia.getId()), gaveta)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(404));
        assertThatThrownBy(() -> kit.pecas.mover(de(kit.ana), new AcervoPecasService.MoverForm(List.of(daAna.getId(), daBia.getId()), gaveta)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(404));
        assertThatThrownBy(() -> kit.estrutura.apagarMovel(de(kit.bia), (UUID) armario.get("id")))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(404));
        assertThatThrownBy(() -> kit.estrutura.renomearCompartimento(de(kit.bia), gaveta, new AcervoEstruturaService.NomeForm("Minha")))
                .isInstanceOf(ApiException.class);
        assertThat(kit.linhas.findAll()).as("nada foi movido: o pedido com peça alheia falha inteiro").isEmpty();
    }

    @Test
    void configuracaoValidaMedidasEOpcoesEAjustaAQuantidadeDeGavetas() {
        Map<String, Object> armario = kit.armario(kit.ana);
        UUID id = (UUID) armario.get("id");
        AcervoEstruturaService.MovelForm config = new AcervoEstruturaService.MovelForm("Armário do quarto", "DREAM_SPACE", 240, 220, 60,
                "VIDRO", "MARFIM", "VIDRO", "CAVA", "CROMADO", null, null, 4);

        Map<String, Object> novo = kit.estrutura.atualizarMovel(de(kit.ana), id, config);

        assertThat(novo).containsEntry("nome", "Armário do quarto").containsEntry("modo", "DREAM_SPACE").containsEntry("larguraCm", 240)
                .containsEntry("material", "VIDRO").containsEntry("porta", "VIDRO").containsEntry("puxadorAcabamento", "CROMADO");
        assertThat(lista(novo.get("compartimentos"))).filteredOn(c -> c.get("tipo").equals("GAVETA")).extracting(c -> c.get("nome"))
                .containsExactly("Gaveta 1", "Gaveta 2", "Gaveta 3", "Gaveta 4");
        assertThatThrownBy(() -> kit.estrutura.atualizarMovel(de(kit.ana), id, new AcervoEstruturaService.MovelForm(null, null, 900,
                null, null, null, null, null, null, null, null, null, null)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("ACERVO_MEDIDA"));
        assertThatThrownBy(() -> kit.estrutura.atualizarMovel(de(kit.ana), id, new AcervoEstruturaService.MovelForm(null, null, null,
                null, null, "OURO", null, null, null, null, null, null, null)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("ACERVO_OPCAO"));
    }

    @Test
    void reduzirGavetasSoTiraAsVaziasEApagarCompartimentoDeixaAPecaSemLugar() {
        Map<String, Object> armario = kit.armario(kit.ana);
        UUID id = (UUID) armario.get("id");
        UUID segundaGaveta = compartimento(armario, "GAVETA", 1);
        WardrobeItem meia = kit.peca(kit.ana, "Meia", "accessory_piece", "socks", "black", "U", null);
        kit.pecas.mover(de(kit.ana), new AcervoPecasService.MoverForm(List.of(meia.getId()), segundaGaveta));

        assertThatThrownBy(() -> kit.estrutura.atualizarMovel(de(kit.ana), id, movel(null, null, null, 1)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("ACERVO_COMPARTIMENTO_OCUPADO"));

        kit.estrutura.apagarCompartimento(de(kit.ana), segundaGaveta);
        assertThat(kit.pecas.arvore(de(kit.ana))).containsEntry("semLugar", 1L).containsEntry("total", 1);
        assertThat(kit.pecasRepo.findById(meia.getId())).as("a peça continua no guarda-roupa").isPresent();
    }

    @Test
    void reordenarExigeExatamenteOsItensQueExistem() {
        Map<String, Object> armario = kit.armario(kit.ana);
        UUID id = (UUID) armario.get("id");
        List<UUID> ids = lista(armario.get("compartimentos")).stream().map(c -> (UUID) c.get("id")).toList();
        List<UUID> invertida = ids.reversed();

        kit.estrutura.ordenarCompartimentos(de(kit.ana), id, new AcervoEstruturaService.OrdemForm(invertida));

        assertThat(kit.compartimentos.findByMovelIdOrderByOrdem(id)).extracting(c -> c.getId()).containsExactlyElementsOf(invertida);
        assertThatThrownBy(() -> kit.estrutura.ordenarCompartimentos(de(kit.ana), id, new AcervoEstruturaService.OrdemForm(ids.subList(0, 2))))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("ACERVO_ORDEM"));
    }

    @Test
    void medidasDaPecaFicamNaFichaESaoValidadas() {
        kit.armario(kit.ana);
        WardrobeItem camisa = kit.peca(kit.ana, "Camisa", "upper_piece", "shirt", "white", "M", null);

        kit.pecas.medidas(de(kit.ana), camisa.getId(), new AcervoPecasService.MedidasForm(new BigDecimal("52"), new BigDecimal("71.25"), "Ombro 44"));

        Map<String, Object> ficha = lista(kit.pecas.arvore(de(kit.ana)).get("pecas")).get(0);
        assertThat(ficha.get("medidas")).isEqualTo(Map.of("larguraCm", new BigDecimal("52.0"), "comprimentoCm", new BigDecimal("71.3"), "nota", "Ombro 44"));
        assertThatThrownBy(() -> kit.pecas.medidas(de(kit.ana), camisa.getId(), new AcervoPecasService.MedidasForm(new BigDecimal("-1"), null, null)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("ACERVO_MEDIDA"));
        assertThatThrownBy(() -> kit.pecas.medidas(de(kit.bia), camisa.getId(), new AcervoPecasService.MedidasForm(null, null, null)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(404));
    }
}
