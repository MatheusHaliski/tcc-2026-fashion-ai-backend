package br.com.fashionai.application.flair3d.recurso;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.recurso.PecaRecurso.AcaoDestravada;
import br.com.fashionai.application.flair3d.recurso.PecaRecurso.Atributo;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Jogos de zonas: cada zona pintada é uma peça virtual para a regra peça-recurso. */
class Flair3dPecaVirtualTest {
    @Test
    void cadaZonaPintadaViraUmaPecaComVagaCorEMaterialDoAcabamento() {
        Map<String, Entrega.Zona> zonas = new LinkedHashMap<>();
        zonas.put("PEITO", new Entrega.Zona("#C62B28", "METALICO"));
        zonas.put("CAPA", new Entrega.Zona("#12100F", "FOSCO"));
        zonas.put("PERNAS", new Entrega.Zona(null, null));
        Map<String, CbcRules.Card> pecas = Flair3dPecaVirtual.daZonas("SUPER_HEROI", zonas);
        assertThat(pecas).hasSize(2);
        CbcRules.Card peito = pecas.get("SUP:PEITO");
        assertThat(peito.materials()).containsExactly("metal");
        assertThat(peito.colors()).hasSize(1);
        assertThat(pecas.get("VES:CAPA").materials()).containsExactly("cotton");
        // o peito metálico dá força e destrava refletir; a mesma entrada dá a mesma peça (id estável)
        PecaRecurso.PerfilDoLook look = Flair3dRecursoCalculo.doLook(pecas);
        assertThat(look.valor(Atributo.FORCA)).isGreaterThan(PecaRecurso.NEUTRO);
        assertThat(look.acoes()).contains(AcaoDestravada.REFLETIR);
        assertThat(Flair3dPecaVirtual.daZonas("SUPER_HEROI", zonas).get("SUP:PEITO").id()).isEqualTo(peito.id());
    }

    @Test
    void aViseiraEspelhadaDoPilotoEscondeComoOculos() {
        Map<String, CbcRules.Card> pecas = Flair3dPecaVirtual.daZonas("PILOTO_FAVORITO", Map.of("VISEIRA", new Entrega.Zona("#B8BCC0", "ESPELHADO")));
        assertThat(Flair3dRecursoCalculo.doLook(pecas).acoes()).contains(AcaoDestravada.ESCONDER);
    }

    @Test
    void aPreviaSemNotaLevaOPerfilDoLookParaARoda() {
        Map<String, CbcRules.Card> pecas = Flair3dPecaVirtual.daZonas("CLUBE_CORACAO", Map.of("FRENTE", new Entrega.Zona("#2A5FA8", "BRILHANTE")));
        Resultado semNota = Resultado.of(0, Resultado.EM_PREPARO, List.of(), List.of());
        Resultado r = Flair3dRecursoBonus.naPrevia("CLUBE_CORACAO", semNota, pecas, List.of());
        assertThat(r.pontos()).isZero();
        assertThat(r.eventos()).extracting(Resultado.Evento::codigo).containsExactly("PERFIL_DO_LOOK");
        @SuppressWarnings("unchecked")
        Map<String, Integer> atributos = (Map<String, Integer>) ((Map<String, Object>) r.eventos().get(0).valor()).get("atributos");
        assertThat(atributos.get("CARISMA")).isGreaterThan(PecaRecurso.NEUTRO);
    }
}
