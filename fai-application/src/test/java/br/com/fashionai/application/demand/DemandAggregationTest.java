package br.com.fashionai.application.demand;

import br.com.fashionai.domain.model.RetailDemandEvent;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;

/** Demanda agregada só publica recortes com pelo menos k pessoas e nunca deixa um resto pequeno reconstruível. */
class DemandAggregationTest {

    private static final UUID PRODUTO = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID OUTRO = UUID.fromString("00000000-0000-0000-0000-000000000002");

    private static RetailDemandEvent evento(UUID produto, String cor, String tamanho, String pessoa) {
        RetailDemandEvent e = new RetailDemandEvent();
        e.setProductId(produto);
        e.setColorName(cor);
        e.setSizeLabel(tamanho);
        e.setKind("TRY_ON");
        e.setContributorHash(pessoa);
        return e;
    }

    private static List<RetailDemandEvent> pessoas(UUID produto, String cor, String tamanho, int quantas, String prefixo) {
        List<RetailDemandEvent> out = new ArrayList<>();
        for (int i = 0; i < quantas; i++) {
            out.add(evento(produto, cor, tamanho, prefixo + i));
        }
        return out;
    }

    @Test
    void recorteComPessoasSuficientesEPublicado() {
        List<RetailDemandEvent> eventos = new ArrayList<>(pessoas(PRODUTO, "azul", "M", 5, "a"));
        eventos.add(evento(PRODUTO, "azul", "M", "a0"));   // a mesma pessoa de novo: conta evento, não pessoa
        DemandAggregation.Result r = DemandAggregation.aggregate(eventos, 5);
        assertThat(r.cells()).hasSize(1);
        assertThat(r.cells().get(0).events()).isEqualTo(6);
        assertThat(r.cells().get(0).contributors()).isEqualTo(5);
        assertThat(r.suppressedCells()).isZero();
        assertThat(r.sampleSize()).isEqualTo(6);
        assertThat(r.contributors()).isEqualTo(5);
    }

    @Test
    void recortePequenoESuprimido() {
        // produto só com um recorte pequeno: nada publicado e o resto (2 pessoas) não tem recorte para derrubar.
        // Com limite de tempo: a supressão complementar não pode girar sem fim procurando um recorte que não existe.
        DemandAggregation.Result r = assertTimeoutPreemptively(Duration.ofSeconds(2),
                () -> DemandAggregation.aggregate(pessoas(PRODUTO, "azul", "M", 2, "a"), 5));
        assertThat(r.cells()).isEmpty();
        assertThat(r.suppressedCells()).isEqualTo(1);
    }

    @Test
    void restoPequenoDoProdutoDerrubaTambemORecortePublicado() {
        List<RetailDemandEvent> eventos = new ArrayList<>(pessoas(PRODUTO, "azul", "M", 5, "a"));
        eventos.addAll(pessoas(PRODUTO, "verde", "G", 2, "b"));   // 2 pessoas: o total menos o recorte azul as revelaria
        DemandAggregation.Result r = DemandAggregation.aggregate(eventos, 5);
        assertThat(r.cells()).isEmpty();
        assertThat(r.suppressedCells()).isEqualTo(2);
    }

    @Test
    void restoGrandeOuZeroMantemORecorte() {
        List<RetailDemandEvent> eventos = new ArrayList<>(pessoas(PRODUTO, "azul", "M", 5, "a"));
        eventos.addAll(pessoas(PRODUTO, "verde", "G", 1, "a"));   // mesma pessoa de um recorte publicado: o resto é zero
        eventos.addAll(pessoas(OUTRO, "preto", "P", 7, "c"));
        DemandAggregation.Result r = DemandAggregation.aggregate(eventos, 5);
        assertThat(r.cells()).extracting(DemandAggregation.Cell::colorName).containsExactly("preto", "azul");   // mais pessoas primeiro
        assertThat(r.suppressedCells()).isEqualTo(1);
    }

    @Test
    void semEventosNaoHaNada() {
        DemandAggregation.Result r = DemandAggregation.aggregate(List.of(), 5);
        assertThat(r.cells()).isEmpty();
        assertThat(r.sampleSize()).isZero();
        assertThat(r.contributors()).isZero();
    }
}
