package br.com.fashionai.application.acervo;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.domain.model.WardrobeItem;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.acervo.AcervoEstruturaServiceTest.lista;
import static br.com.fashionai.application.acervo.AcervoKit.compartimento;
import static br.com.fashionai.application.acervo.AcervoKit.de;
import static br.com.fashionai.application.acervo.AcervoKit.movel;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Exercício 08 (nome do módulo de armazenamento), feito no ACERVO: renomear troca só o rótulo. O endereço da peça (o id
 * do compartimento) não muda, nenhuma peça some, o nome novo aparece no lugar lido por outra tela, nome vazio volta ao
 * padrão, nome acima do limite é recusado e ninguém renomeia nem lê o que é de outra pessoa.
 */
class AcervoNomeEnderecoTest {
    final AcervoKit kit = new AcervoKit();

    private static AcervoEstruturaService.NomeForm nome(String valor) {
        return new AcervoEstruturaService.NomeForm(valor);
    }

    @Test
    void renomearGavetaMantemOEnderecoDaPecaEONomeNovoApareceNoLugar() {
        Map<String, Object> armario = kit.armario(kit.ana);
        UUID gaveta = compartimento(armario, "GAVETA", 0);
        WardrobeItem camisa = kit.peca(kit.ana, "Camisa", "upper_piece", "shirt", "white", "M", null);
        kit.pecas.mover(de(kit.ana), new AcervoPecasService.MoverForm(List.of(camisa.getId()), gaveta));
        Map<String, Object> antes = kit.consulta.lugar(de(kit.ana), camisa.getId());

        Map<String, Object> resposta = kit.estrutura.renomearCompartimento(de(kit.ana), gaveta, nome("  Camisas  "));

        assertThat(resposta).containsEntry("id", gaveta).containsEntry("nome", "Camisas").containsEntry("tipo", "GAVETA")
                .containsEntry("movelId", armario.get("id")).containsEntry("pecas", 1L);
        Map<String, Object> depois = kit.consulta.lugar(de(kit.ana), camisa.getId());
        assertThat(antes).containsEntry("compartimento", "Gaveta 1").containsEntry("compartimentoId", gaveta);
        assertThat(depois).containsEntry("guardada", true).containsEntry("compartimento", "Camisas")
                .containsEntry("compartimentoId", gaveta).containsEntry("movelId", armario.get("id")).containsEntry("tipo", "GAVETA")
                .containsEntry("movel", "Armário 01").containsEntry("ambiente", "Closet")
                .containsEntry("caminho", "Closet / Armário 01 / Camisas");
        assertThat(kit.linhas.findAll()).singleElement().satisfies(l -> assertThat(l.getCompartimentoId()).isEqualTo(gaveta));
        assertThat(kit.compartimentos.findAll()).as("renomear não cria nem apaga compartimento").hasSize(5);
        assertThat(kit.pecasRepo.findAll()).hasSize(1);
    }

    @Test
    void renomearMovelEAmbienteTambemMantemOsIdsEAtualizamOCaminho() {
        Map<String, Object> armario = kit.armario(kit.ana);
        UUID movelId = (UUID) armario.get("id");
        UUID ambienteId = (UUID) armario.get("ambienteId");
        UUID prateleira = compartimento(armario, "PRATELEIRA", 1);
        WardrobeItem jeans = kit.peca(kit.ana, "Jeans", "lower_piece", "jeans", "blue", "40", null);
        kit.pecas.mover(de(kit.ana), new AcervoPecasService.MoverForm(List.of(jeans.getId()), prateleira));

        kit.estrutura.atualizarMovel(de(kit.ana), movelId, movel("Guarda-roupa", null, null, null));
        kit.estrutura.renomearAmbiente(de(kit.ana), ambienteId, nome("Quarto"));

        assertThat(kit.consulta.lugar(de(kit.ana), jeans.getId())).containsEntry("compartimentoId", prateleira)
                .containsEntry("movelId", movelId).containsEntry("ambienteId", ambienteId)
                .containsEntry("caminho", "Quarto / Guarda-roupa / Prateleira 2");
    }

    @Test
    void nomeVazioVoltaAoPadraoDoTipoPelaPosicao() {
        Map<String, Object> armario = kit.armario(kit.ana);
        UUID segunda = compartimento(armario, "GAVETA", 1);
        kit.estrutura.renomearCompartimento(de(kit.ana), segunda, nome("Meias"));

        assertThat(kit.estrutura.renomearCompartimento(de(kit.ana), segunda, nome("   "))).containsEntry("nome", "Gaveta 2");
        kit.estrutura.renomearCompartimento(de(kit.ana), segunda, nome("Meias"));
        assertThat(kit.estrutura.renomearCompartimento(de(kit.ana), segunda, nome(null))).containsEntry("nome", "Gaveta 2")
                .containsEntry("id", segunda);
        assertThat(kit.estrutura.renomearCompartimento(de(kit.ana), segunda, null)).containsEntry("nome", "Gaveta 2");
    }

    @Test
    void nomeAcimaDoLimiteERecusadoSemCortarENomeNoLimitePassa() {
        Map<String, Object> armario = kit.armario(kit.ana);
        UUID gaveta = compartimento(armario, "GAVETA", 0);
        UUID movelId = (UUID) armario.get("id");
        String noLimite = "a".repeat(80);
        String longo = "a".repeat(81);

        assertThat(kit.estrutura.renomearCompartimento(de(kit.ana), gaveta, nome(noLimite))).containsEntry("nome", noLimite);
        assertThatThrownBy(() -> kit.estrutura.renomearCompartimento(de(kit.ana), gaveta, nome(longo)))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.status()).isEqualTo(400);
                    assertThat(e.code()).isEqualTo("ACERVO_NOME_LONGO");
                });
        assertThatThrownBy(() -> kit.estrutura.atualizarMovel(de(kit.ana), movelId, movel(longo, null, null, null)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("ACERVO_NOME_LONGO"));
        assertThatThrownBy(() -> kit.estrutura.atualizarMovel(de(kit.ana), movelId, movel("  ", null, null, null)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("ACERVO_NOME"));
        assertThat(kit.compartimentos.findById(gaveta)).get().satisfies(c -> assertThat(c.getNome()).isEqualTo(noLimite));
        assertThat(kit.moveis.findById(movelId)).get().satisfies(m -> assertThat(m.getNome()).isEqualTo("Armário 01"));
    }

    @Test
    void compartimentoInexistenteOuDeOutraPessoaResponde404ENadaMuda() {
        Map<String, Object> armario = kit.armario(kit.ana);
        UUID gaveta = compartimento(armario, "GAVETA", 0);
        WardrobeItem daAna = kit.peca(kit.ana, "Camisa", "upper_piece", "shirt", "white", "M", null);
        kit.pecas.mover(de(kit.ana), new AcervoPecasService.MoverForm(List.of(daAna.getId()), gaveta));

        assertThatThrownBy(() -> kit.estrutura.renomearCompartimento(de(kit.ana), UUID.randomUUID(), nome("Camisas")))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(404));
        assertThatThrownBy(() -> kit.estrutura.renomearCompartimento(de(kit.bia), gaveta, nome("Da Bia")))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(404));
        assertThatThrownBy(() -> kit.consulta.lugar(de(kit.bia), daAna.getId()))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(404));
        assertThat(kit.compartimentos.findById(gaveta)).get().satisfies(c -> assertThat(c.getNome()).isEqualTo("Gaveta 1"));
    }

    @Test
    void mudarAQuantidadeDeGavetasPreservaONomeEscolhidoEOLugarDasPecas() {
        Map<String, Object> armario = kit.armario(kit.ana);
        UUID movelId = (UUID) armario.get("id");
        UUID gaveta = compartimento(armario, "GAVETA", 0);
        WardrobeItem camisa = kit.peca(kit.ana, "Camisa", "upper_piece", "shirt", "white", "M", null);
        kit.pecas.mover(de(kit.ana), new AcervoPecasService.MoverForm(List.of(camisa.getId()), gaveta));
        kit.estrutura.renomearCompartimento(de(kit.ana), gaveta, nome("Camisas"));

        Map<String, Object> maior = kit.estrutura.atualizarMovel(de(kit.ana), movelId, movel(null, null, null, 4));
        Map<String, Object> menor = kit.estrutura.atualizarMovel(de(kit.ana), movelId, movel(null, null, null, 1));

        assertThat(lista(maior.get("compartimentos"))).filteredOn(c -> c.get("tipo").equals("GAVETA")).extracting(c -> c.get("nome"))
                .containsExactly("Camisas", "Gaveta 2", "Gaveta 3", "Gaveta 4");
        assertThat(lista(menor.get("compartimentos"))).filteredOn(c -> c.get("tipo").equals("GAVETA")).singleElement()
                .satisfies(c -> assertThat(c).containsEntry("id", gaveta).containsEntry("nome", "Camisas").containsEntry("pecas", 1L));
        assertThat(kit.consulta.lugar(de(kit.ana), camisa.getId())).containsEntry("compartimentoId", gaveta)
                .containsEntry("caminho", "Closet / Armário 01 / Camisas");
    }

    @Test
    void pecaSemLugarRespondeGuardadaFalseSemEndereco() {
        kit.armario(kit.ana);
        WardrobeItem solta = kit.peca(kit.ana, "Lenço", "accessory_piece", "scarf", "red", "U", null);

        assertThat(kit.consulta.lugar(de(kit.ana), solta.getId())).containsEntry("pieceId", solta.getId())
                .containsEntry("guardada", false).containsEntry("compartimentoId", null).containsEntry("caminho", null);
    }
}
