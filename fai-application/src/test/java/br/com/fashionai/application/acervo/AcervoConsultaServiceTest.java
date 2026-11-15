package br.com.fashionai.application.acervo;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.WardrobeItem;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.acervo.AcervoEstruturaServiceTest.lista;
import static br.com.fashionai.application.acervo.AcervoKit.compartimento;
import static br.com.fashionai.application.acervo.AcervoKit.de;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** ACERVO — modo arrumação, painel financeiro, lista de desejos, busca espacial, mapa de uso e looks vinculados. */
class AcervoConsultaServiceTest {
    final AcervoKit kit = new AcervoKit();

    @SuppressWarnings("unchecked")
    static Map<String, Object> mapa(Object valor) {
        return (Map<String, Object>) valor;
    }

    @Test
    void arrumacaoPropoeSemGravarESoAConfirmacaoGrava() {
        Map<String, Object> armario = kit.armario(kit.ana);
        UUID cabideiro = compartimento(armario, "CABIDEIRO", 0);
        UUID gaveta = compartimento(armario, "GAVETA", 0);
        WardrobeItem camisa = kit.peca(kit.ana, "Camisa", "upper_piece", "shirt", "white", "M", null);
        WardrobeItem camiseta = kit.peca(kit.ana, "Camiseta", "upper_piece", "t_shirt", "black", "M", null);

        Map<String, Object> previa = kit.pecas.previa(de(kit.ana), null);

        List<Map<String, Object>> movimentos = lista(previa.get("movimentos"));
        assertThat(movimentos).hasSize(2);
        assertThat(movimentos).filteredOn(m -> m.get("pieceId").equals(camisa.getId())).singleElement().satisfies(m -> {
            assertThat(mapa(m.get("de"))).containsEntry("compartimentoId", null);
            assertThat(mapa(m.get("para"))).containsEntry("compartimentoId", cabideiro).containsEntry("caminho", "Closet / Armário 01 / Cabideiro 1");
            assertThat(m).containsEntry("motivo", "Peça de pendurar fica melhor no cabideiro.");
        });
        assertThat(movimentos).filteredOn(m -> m.get("pieceId").equals(camiseta.getId())).singleElement()
                .satisfies(m -> assertThat(mapa(m.get("para"))).containsEntry("compartimentoId", gaveta));
        assertThat(kit.linhas.findAll()).as("a prévia não grava").isEmpty();

        List<AcervoPecasService.Movimento> confirmados = movimentos.stream()
                .map(m -> new AcervoPecasService.Movimento((UUID) m.get("pieceId"), (UUID) mapa(m.get("para")).get("compartimentoId")))
                .toList();
        assertThat(kit.pecas.confirmar(de(kit.ana), new AcervoPecasService.ConfirmarForm(confirmados))).containsEntry("movidas", 2);
        assertThat(kit.pecas.arvore(de(kit.ana))).containsEntry("semLugar", 0L);
        assertThat(lista(kit.pecas.previa(de(kit.ana), new AcervoPecasService.PreviaForm("TUDO", null)).get("movimentos")))
                .as("o que já está no tipo certo de compartimento fica onde está").isEmpty();
    }

    @Test
    void arrumacaoSemCompartimentoDoTipoAvisaENaoConfirmaPecaAlheia() {
        Map<String, Object> closet = kit.estrutura.criarAmbiente(de(kit.ana), new AcervoEstruturaService.NomeForm("Closet"));
        kit.estrutura.criarMovel(de(kit.ana), (UUID) closet.get("id"), AcervoKit.movel("Gaveteiro", 0, 0, 1));
        WardrobeItem camisa = kit.peca(kit.ana, "Camisa", "upper_piece", "shirt", "white", "M", null);
        WardrobeItem daBia = kit.peca(kit.bia, "Saia", "lower_piece", "skirt", "blue", "P", null);

        Map<String, Object> previa = kit.pecas.previa(de(kit.ana), null);

        assertThat(lista(previa.get("movimentos"))).isEmpty();
        assertThat(previa.get("semDestino")).isEqualTo(List.of(camisa.getId()));
        assertThatThrownBy(() -> kit.pecas.confirmar(de(kit.ana), new AcervoPecasService.ConfirmarForm(
                List.of(new AcervoPecasService.Movimento(daBia.getId(), null)))))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(404));
    }

    @Test
    void financeiroSomaSoOQueTemPrecoSeparaGruposSelecaoEDesejosEstimados() {
        Map<String, Object> armario = kit.armario(kit.ana);
        WardrobeItem camisa = kit.usada(kit.peca(kit.ana, "Camisa", "upper_piece", "shirt", "white", "M", "120.00"), 4, LocalDate.of(2026, 11, 1));
        WardrobeItem tenis = kit.peca(kit.ana, "Tênis", "shoes_piece", "sneakers", "white", "40", "380.50");
        kit.peca(kit.ana, "Lenço", "accessory_piece", "scarf", "red", "U", null);
        kit.peca(kit.bia, "Casaco", "upper_piece", "coat", "black", "G", "900.00");
        kit.desejos.criar(de(kit.ana), new AcervoDesejoService.DesejoForm("Jaqueta de couro", "upper_piece", "black", "M", null,
                new BigDecimal("890"), compartimento(armario, "CABIDEIRO", 0)));
        kit.desejos.criar(de(kit.ana), new AcervoDesejoService.DesejoForm("Bolsa", "accessory_piece", null, null, null, null, null));

        Map<String, Object> resumo = kit.consulta.financeiro(de(kit.ana), List.of(tenis.getId()));

        assertThat(resumo).containsEntry("moeda", "BRL").containsEntry("valor", new BigDecimal("500.50")).containsEntry("pecasComPreco", 2)
                .containsEntry("pecasSemPreco", 1).containsEntry("totalPecas", 3);
        assertThat(lista(resumo.get("grupos"))).extracting(g -> g.get("grupo") + "=" + g.get("valor"))
                .containsExactly("ROUPAS=120.00", "CALCADOS=380.50", "ACESSORIOS=0.00", "OUTROS=0.00");
        assertThat(mapa(resumo.get("selecao"))).containsEntry("valor", new BigDecimal("380.50")).containsEntry("totalPecas", 1);
        assertThat(mapa(resumo.get("desejos"))).containsEntry("valor", new BigDecimal("890.00")).containsEntry("itens", 2)
                .containsEntry("semPreco", 1).containsEntry("estimado", true);
        assertThat(mapa(resumo.get("custoPorUso"))).containsEntry("valor", new BigDecimal("30.00")).containsEntry("usos", 4).containsEntry("pecas", 1);
        assertThat(camisa.getPrice()).isEqualByComparingTo("120.00");
    }

    @Test
    void custoPorUsoFicaVazioSemUsoRegistrado() {
        kit.peca(kit.ana, "Camisa", "upper_piece", "shirt", "white", "M", "120.00");

        assertThat(kit.consulta.financeiro(de(kit.ana), null).get("custoPorUso")).isNull();
    }

    @Test
    void listaDeDesejosCriaAtualizaApagaESoADonaMexe() {
        Map<String, Object> armario = kit.armario(kit.ana);
        UUID cabideiro = compartimento(armario, "CABIDEIRO", 0);
        Map<String, Object> jaqueta = kit.desejos.criar(de(kit.ana), new AcervoDesejoService.DesejoForm(" Jaqueta ", "upper_piece", "black", "M",
                "Marca X", new BigDecimal("890.555"), cabideiro));
        UUID id = (UUID) jaqueta.get("id");

        assertThat(jaqueta).containsEntry("nome", "Jaqueta").containsEntry("precoEstimado", new BigDecimal("890.56")).containsEntry("estimado", true)
                .containsEntry("compartimentoId", cabideiro).containsEntry("caminho", "Closet / Armário 01 / Cabideiro 1");
        assertThatThrownBy(() -> kit.desejos.atualizar(de(kit.bia), id, new AcervoDesejoService.DesejoForm("x", null, null, null, null, null, null)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(404));
        assertThatThrownBy(() -> kit.desejos.criar(de(kit.ana), new AcervoDesejoService.DesejoForm("Bota", null, null, null, null, new BigDecimal("-5"), null)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("ACERVO_PRECO"));

        kit.estrutura.apagarCompartimento(de(kit.ana), cabideiro);
        assertThat(kit.desejos.lista(de(kit.ana))).singleElement().satisfies(d -> assertThat(d).containsEntry("compartimentoId", null));
        kit.desejos.apagar(de(kit.ana), id);
        assertThat(kit.desejos.lista(de(kit.ana))).isEmpty();
    }

    @Test
    void buscaEspacialCasaTipoCorETamanhoEDevolveOsCompartimentos() {
        Map<String, Object> armario = kit.armario(kit.ana);
        UUID cabideiro = compartimento(armario, "CABIDEIRO", 0);
        WardrobeItem camisaM = kit.peca(kit.ana, "Social slim", "upper_piece", "shirt", "white", "M", null);
        WardrobeItem camisaG = kit.peca(kit.ana, "Social larga", "upper_piece", "shirt", "white", "G", null);
        kit.peca(kit.ana, "Básica", "upper_piece", "t_shirt", "white", "M", null);
        kit.peca(kit.bia, "Camisa da Bia", "upper_piece", "shirt", "white", "M", null);
        kit.pecas.mover(de(kit.ana), new AcervoPecasService.MoverForm(List.of(camisaM.getId()), cabideiro));

        Map<String, Object> achado = kit.consulta.busca(de(kit.ana), "Camisa BRANCA m");

        assertThat(achado.get("termos")).isEqualTo(List.of("camisa", "branca", "m"));
        assertThat(lista(achado.get("pecas"))).extracting(p -> p.get("id")).containsExactly(camisaM.getId());
        assertThat(lista(achado.get("compartimentos"))).singleElement().satisfies(c ->
                assertThat(c).containsEntry("id", cabideiro).containsEntry("pecas", 1).containsEntry("caminho", "Closet / Armário 01 / Cabideiro 1"));
        assertThat(lista(kit.consulta.busca(de(kit.ana), "camisas brancas").get("pecas"))).extracting(p -> p.get("id"))
                .containsExactlyInAnyOrder(camisaM.getId(), camisaG.getId());
        assertThat(kit.consulta.busca(de(kit.ana), "camisas brancas")).containsEntry("semLugar", 1);
        assertThat(lista(kit.consulta.busca(de(kit.ana), "  ").get("pecas"))).isEmpty();
    }

    @Test
    void mapaDeUsoMarcaEsquecidasNuncaUsadasEPecasSemLook() {
        Map<String, Object> armario = kit.armario(kit.ana);
        UUID gaveta = compartimento(armario, "GAVETA", 0);
        WardrobeItem recente = kit.usada(kit.peca(kit.ana, "Recente", "upper_piece", "t_shirt", "white", "M", null), 3, LocalDate.of(2026, 11, 10));
        WardrobeItem antiga = kit.usada(kit.peca(kit.ana, "Antiga", "upper_piece", "t_shirt", "black", "M", null), 1, LocalDate.of(2025, 11, 14));
        WardrobeItem nova = kit.peca(kit.ana, "Nova", "upper_piece", "t_shirt", "blue", "M", null);
        kit.pecas.mover(de(kit.ana), new AcervoPecasService.MoverForm(List.of(recente.getId(), antiga.getId(), nova.getId()), gaveta));
        kit.look(kit.ana, "Dia a dia", recente);

        Map<String, Object> uso = kit.consulta.uso(de(kit.ana), null);

        assertThat(uso).containsEntry("dias", 180);
        assertThat(lista(uso.get("compartimentos"))).singleElement().satisfies(c ->
                assertThat(c).containsEntry("id", gaveta).containsEntry("pecas", 3).containsEntry("esquecidas", 1).containsEntry("nuncaUsadas", 1));
        assertThat(lista(uso.get("pecas"))).filteredOn(p -> p.get("id").equals(antiga.getId())).singleElement().satisfies(p ->
                assertThat(p).containsEntry("diasSemUso", 365L).containsEntry("esquecida", true).containsEntry("semLook", true));
        assertThat(lista(uso.get("pecas"))).filteredOn(p -> p.get("id").equals(recente.getId())).singleElement().satisfies(p ->
                assertThat(p).containsEntry("esquecida", false).containsEntry("semLook", false));
        assertThat(kit.consulta.uso(de(kit.ana), 5)).containsEntry("dias", 30);
    }

    @Test
    void looksVinculadosMostramOndeEstaCadaItemESoOsLooksDaDona() {
        Map<String, Object> armario = kit.armario(kit.ana);
        UUID cabideiro = compartimento(armario, "CABIDEIRO", 0);
        WardrobeItem camisa = kit.peca(kit.ana, "Camisa", "upper_piece", "shirt", "white", "M", null);
        WardrobeItem calca = kit.peca(kit.ana, "Calça", "lower_piece", "jeans", "blue", "40", null);
        kit.pecas.mover(de(kit.ana), new AcervoPecasService.MoverForm(List.of(camisa.getId()), cabideiro));
        Scheme trabalho = kit.look(kit.ana, "Trabalho", camisa, calca);
        kit.look(kit.bia, "Remix da Bia", camisa);

        List<Map<String, Object>> looks = kit.consulta.looks(de(kit.ana), camisa.getId());

        assertThat(looks).singleElement().satisfies(l -> assertThat(l).containsEntry("id", trabalho.getId()).containsEntry("title", "Trabalho"));
        assertThat(lista(looks.get(0).get("itens"))).extracting(i -> i.get("name") + "@" + i.get("caminho"))
                .containsExactly("Camisa@Closet / Armário 01 / Cabideiro 1", "Calça@null");
        assertThatThrownBy(() -> kit.consulta.looks(de(kit.bia), camisa.getId()))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(404));
    }
}
