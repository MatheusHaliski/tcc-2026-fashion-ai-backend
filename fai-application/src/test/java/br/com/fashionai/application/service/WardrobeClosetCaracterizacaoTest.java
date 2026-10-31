package br.com.fashionai.application.service;

import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * Caracterização do RF6 (closet) escrita ANTES da extração de {@code ClosetQuery}: pinos de comportamento que os testes
 * existentes não fixavam (ordenação padrão para valor desconhecido, desempates, tamanho padrão, faixa de Hype desconhecida,
 * cor exata sensível a maiúsculas, busca textual sem acento/maiúscula).
 */
class WardrobeClosetCaracterizacaoTest {
    Kit kit;
    World world;
    WardrobeService service;
    CurrentUser ana;
    List<WardrobeItem> mine;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        world = new World(kit);
        HypeScoreConfig hypeConfig = kit.dep(HypeScoreConfig.class);
        when(hypeConfig.algorithmVersion()).thenReturn("v2");
        when(hypeConfig.levelThresholds()).thenReturn(new int[]{20, 40, 60, 75, 90});
        service = kit.build(WardrobeService.class);
        ana = Kit.as(world.me);
        mine = world.piecesOf(world.me);
        for (int i = 0; i < mine.size(); i++) {
            WardrobeItem w = mine.get(i);
            w.setModerationStatus(ModerationStatus.APPROVED);
            w.markCreatedAt(Instant.parse("2026-01-01T00:00:00Z").minusSeconds(1000L * i));
        }
    }

    static WardrobeService.ClosetFilter f(String color, String q, String sort, int page, int size, String hype) {
        return new WardrobeService.ClosetFilter(null, color, null, null, null, null, q, sort, page, size, hype, null);
    }

    List<UUID> ids(Views.Page<Views.PieceView> p) {
        return p.items().stream().map(Views.PieceView::id).toList();
    }

    void hype(WardrobeItem w, Double score, double delta, double trend) {
        HypeScoreCurrent h = new HypeScoreCurrent();
        h.setId(UUID.randomUUID());
        h.setEntityType(HypeEntityType.PIECE);
        h.setEntityId(w.getId());
        h.setAlgorithmVersion("v2");
        h.setScore(score == null ? null : BigDecimal.valueOf(score));
        h.setDeltaPoints(BigDecimal.valueOf(delta));
        h.getDimensions().setTrend(BigDecimal.valueOf(trend));
        h.setPublicEligible(true);
        h.setStatus(HypeStatus.AVAILABLE);
        h.setLevel(HypeLevel.NICHE);
        kit.dep(HypeScoreCurrentRepository.class).save(h);
    }

    @Test
    void ordenacaoDesconhecidaOuNulaCaiEmRecentes() {
        List<UUID> recent = mine.stream().map(WardrobeItem::getId).toList();
        assertThat(ids(service.closet(ana, null, f(null, null, null, 0, 0, null)))).containsExactlyElementsOf(recent);
        assertThat(ids(service.closet(ana, null, f(null, null, "xyz", 0, 0, null)))).containsExactlyElementsOf(recent);
        assertThat(ids(service.closet(ana, null, f(null, null, "recent", 0, 0, null)))).containsExactlyElementsOf(recent);
        // apelido é sensível a maiúsculas: "NOME" não é apelido de "name" e cai no padrão (recentes)
        assertThat(ids(service.closet(ana, null, f(null, null, "NOME", 0, 0, null)))).containsExactlyElementsOf(recent);
    }

    @Test
    void menosUsadasDesempataPelaMaisAntiga() {
        mine.forEach(w -> w.setWearCount(1));
        mine.get(5).setWearCount(0);
        List<UUID> out = ids(service.closet(ana, null, f(null, null, "least_worn", 0, 0, null)));
        assertThat(out.get(0)).isEqualTo(mine.get(5).getId());
        // empate em 1 uso: createdAt crescente → a última criada na lista (mais antiga) vem antes
        assertThat(out.get(1)).isEqualTo(mine.get(11).getId());
        assertThat(out.get(11)).isEqualTo(mine.get(0).getId());
    }

    @Test
    void precoNuloContaComoZeroEMaisUsadasEstavel() {
        mine.forEach(w -> w.setPrice(BigDecimal.TEN));
        mine.get(2).setPrice(null);
        mine.get(7).setPrice(BigDecimal.valueOf(99));
        List<UUID> preco = ids(service.closet(ana, null, f(null, null, "price", 0, 0, null)));
        assertThat(preco.get(0)).isEqualTo(mine.get(7).getId());
        assertThat(preco.get(11)).isEqualTo(mine.get(2).getId());
        // desempate estável: mesma ordem de chegada (recentes) entre os de preço igual
        assertThat(preco.subList(1, 11)).containsExactlyElementsOf(mine.stream()
                .filter(w -> w != mine.get(7) && w != mine.get(2)).map(WardrobeItem::getId).toList());
    }

    @Test
    void crescimentoDesempataPelaTendenciaESemHypeVaiPorUltimo() {
        hype(mine.get(4), 50.0, 5, 10);
        hype(mine.get(9), 50.0, 5, 30);
        hype(mine.get(1), 50.0, 1, 99);
        List<UUID> out = ids(service.closet(ana, null, f(null, null, "growth", 0, 0, null)));
        assertThat(out.subList(0, 3)).containsExactly(mine.get(9).getId(), mine.get(4).getId(), mine.get(1).getId());
        assertThat(out).hasSize(12);
        // sem Hype: ordem de chegada preservada (sort estável)
        assertThat(out.get(3)).isEqualTo(mine.get(0).getId());
    }

    @Test
    void faixaDesconhecidaExigeQualquerScore() {
        hype(mine.get(3), 0.0, 0, 0);
        hype(mine.get(6), null, 0, 0);
        assertThat(ids(service.closet(ana, null, f(null, null, null, 0, 0, "QUALQUER")))).containsExactly(mine.get(3).getId());
        // limite: -0,4 arredonda para 0 e entra; -0,6 não
        hype(mine.get(8), -0.4, 0, 0);
        hype(mine.get(10), -0.6, 0, 0);
        assertThat(ids(service.closet(ana, null, f(null, null, null, 0, 0, "qualquer"))))
                .containsExactly(mine.get(3).getId(), mine.get(8).getId());
    }

    @Test
    void tamanhoPadraoEPaginaAlemDoFim() {
        var p = service.closet(ana, null, f(null, null, null, 0, 0, null));
        assertThat(p.size()).isEqualTo(30);
        assertThat(p.total()).isEqualTo(12);
        assertThat(p.hasMore()).isFalse();
        var negativo = service.closet(ana, null, f(null, null, null, 0, -4, null));
        assertThat(negativo.size()).isEqualTo(30);
        var alem = service.closet(ana, null, f(null, null, null, 9, 5, null));
        assertThat(alem.items()).isEmpty();
        assertThat(alem.page()).isEqualTo(9);
        assertThat(alem.total()).isEqualTo(12);
        assertThat(alem.hasMore()).isFalse();
        var um = service.closet(ana, null, f(null, null, null, 11, 1, null));
        assertThat(um.items()).hasSize(1);
        assertThat(um.hasMore()).isFalse();
        var penultimo = service.closet(ana, null, f(null, null, null, 10, 1, null));
        assertThat(penultimo.hasMore()).isTrue();
    }

    @Test
    void corExataSensivelAMaiusculaFamiliaNao() {
        assertThat(service.closet(ana, null, f("white", null, null, 0, 0, null)).items()).hasSize(2);
        // "WHITE" não é igual ao código, mas a família ("Branco"?) só casa ignorando maiúsculas o nome da família
        int porCodigoMaiusculo = service.closet(ana, null, f("WHITE", null, null, 0, 0, null)).items().size();
        int porFamilia = service.closet(ana, null, f("BRANCO", null, null, 0, 0, null)).items().size();
        assertThat(porFamilia).isEqualTo(2);
        assertThat(porCodigoMaiusculo).isEqualTo(Taxonomy.COLOR_FAMILY.get("white").equalsIgnoreCase("WHITE") ? 2 : 0);
    }

    @Test
    void buscaTextualIgnoraMaiusculasEmNomeMarcaESubcategoria() {
        assertThat(service.closet(ana, null, f(null, "Cargo_Pants", null, 0, 0, null)).items()).hasSize(1);
        assertThat(service.closet(ana, null, f(null, "  ", null, 0, 0, null)).items()).hasSize(12);
        assertThat(service.closet(ana, null, f(null, "nada-assim", null, 0, 0, null)).items()).isEmpty();
    }
}
