package br.com.fashionai.application.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.wardrobe.PieceForm;
import br.com.fashionai.application.wardrobe.PieceTaxonomyWriter;
import br.com.fashionai.domain.model.Corte;
import br.com.fashionai.domain.model.Origem;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.CorteRepository;
import br.com.fashionai.domain.repository.OrigemRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Corte e origem da peça: o formulário manda o ID; o serviço confere na tabela e grava a FK em wardrobe_items. */
class PieceCorteTest {
    @Test
    void corteEOrigemSaoValidadosENuloMantemOValor() {
        Kit kit = new Kit();
        ClassificationService service = kit.build(ClassificationService.class);
        Corte slim = kit.dep(CorteRepository.class).save(corte("SLIM", true));
        Corte antigo = kit.dep(CorteRepository.class).save(corte("ANTIGO", false));
        Origem herdada = kit.dep(OrigemRepository.class).save(origem());
        WardrobeItem piece = new WardrobeItem();

        service.applyOrigemECorte(piece, herdada.getId(), slim.getId());
        assertThat(piece.getCorte()).isSameAs(slim);
        assertThat(piece.getOrigem()).isSameAs(herdada);
        service.applyOrigemECorte(piece, null, null);
        assertThat(piece.getCorte()).isSameAs(slim);
        assertThatThrownBy(() -> service.applyOrigemECorte(piece, null, UUID.randomUUID()))
                .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.details()).containsKey("corteId"));
        assertThatThrownBy(() -> service.applyOrigemECorte(piece, null, antigo.getId()))
                .as("corte desativado não entra numa escolha nova").isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.applyOrigemECorte(piece, UUID.randomUUID(), null))
                .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.details()).containsKey("origemId"));
        assertThat(piece.getCorte()).isSameAs(slim);
    }

    @Test
    void donoSalvaOCorteELeNaRespostaDaPeca() {
        Kit kit = new Kit();
        Corte slim = kit.dep(CorteRepository.class).save(corte("SLIM", true));
        var owner = Kit.user("ana");
        var piece = Kit.piece(owner, "Calça", "lower_piece", "jeans", "blue");
        kit.dep(WardrobeItemRepository.class).save(piece);
        var wardrobe = kit.build(WardrobeService.class);
        ReflectionTestUtils.setField(wardrobe, "classification", kit.build(ClassificationService.class));
        Map<String, Object> body = new LinkedHashMap<>(Map.of("name", "Calça", "category", "lower_piece", "subcategory", "jeans",
                "sex", "UNISSEX", "color", "blue", "material", "DENIM", "size", "m", "occasion", List.of("casual"),
                "style", List.of("basic"), "price", 100));
        body.put("corteId", slim.getId());

        var result = wardrobe.update(Kit.as(owner), piece.getId(), Json.read(Json.write(body), PieceForm.class));

        assertThat(result.corte().id()).isEqualTo(slim.getId());
        assertThat(result.corte().nome()).isEqualTo("Slim (ajustado)");
        assertThat(piece.getCorte()).isSameAs(slim);
    }

    @Test
    void taxonomiaLegadaMantemCorteEOrigem() {
        UUID corteId = UUID.randomUUID();
        UUID origemId = UUID.randomUUID();
        var form = Json.read(Json.write(Map.of("subcategory", "bermuda_shorts", "corteId", corteId, "origemId", origemId)),
                PieceForm.class);
        var resolved = PieceTaxonomyWriter.resolveLegacy(form);
        assertThat(resolved.corteId()).isEqualTo(corteId);
        assertThat(resolved.origemId()).isEqualTo(origemId);
    }

    private static Corte corte(String codigo, boolean ativo) {
        Corte c = new Corte();
        c.assignId(UUID.randomUUID());
        c.setCodigo(codigo);
        c.setNome("SLIM".equals(codigo) ? "Slim (ajustado)" : codigo);
        c.setAtivo(ativo);
        return c;
    }

    private static Origem origem() {
        Origem o = new Origem();
        o.assignId(UUID.randomUUID());
        o.setCodigo("HERDADA");
        o.setNome("Herdada");
        return o;
    }
}
