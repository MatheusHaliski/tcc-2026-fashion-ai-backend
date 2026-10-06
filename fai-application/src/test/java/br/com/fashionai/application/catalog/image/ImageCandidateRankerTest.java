package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.catalog.image.CatalogImageValidator.Outcome;
import br.com.fashionai.application.catalog.image.ImageCandidateRanker.Candidate;
import br.com.fashionai.application.catalog.image.ImageCandidateRanker.Role;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

class ImageCandidateRankerTest {
    private Map<String, Role> roles(List<Candidate> cs) {
        return new ImageCandidateRanker().rank(cs).stream()
                .collect(Collectors.toMap(r -> r.candidate().id(), ImageCandidateRanker.Ranked::role));
    }

    @Test
    void frenteAprovadaGanhaDeCostasMelhorEDetalheNuncaEhMaster() {
        Map<String, Role> r = roles(List.of(
                new Candidate("back", "BACK", Outcome.APPROVED, 0.86, false, "00000000000000ff"),
                new Candidate("front", "FRONT", Outcome.APPROVED, 0.80, false, "ff00000000000000"),
                new Candidate("detail", "DETAIL", Outcome.APPROVED, 0.99, true, "0f0f0f0f0f0f0f0f")));
        assertThat(r).containsEntry("front", Role.CANONICAL).containsEntry("back", Role.ALTERNATE).containsEntry("detail", Role.DETAIL);
    }

    @Test
    void mesmaFotoEmOutraUrlViraDuplicadaERejeitadaNaoConcorre() {
        Map<String, Role> r = roles(List.of(
                new Candidate("a", "PACKSHOT", Outcome.APPROVED, 0.9, false, "ffff0000ffff0000"),
                new Candidate("b", "PACKSHOT", Outcome.APPROVED, 0.8, false, "ffff0000ffff0001"),
                new Candidate("c", "FRONT", Outcome.REJECTED, 0.95, false, "1234123412341234")));
        assertThat(r).containsEntry("a", Role.CANONICAL).containsEntry("b", Role.DUPLICATE).containsEntry("c", Role.REJECTED);
    }

    @Test
    void detalheOuRevisaoParecidosNaoTiramACanonicaDaVistaPrincipal() {
        Map<String, Role> r = roles(List.of(
                new Candidate("detail", "FRONT", Outcome.APPROVED, 0.99, true, "ffff0000ffff0000"),
                new Candidate("review", "PACKSHOT", Outcome.NEEDS_REPROCESSING, 0.98, false, "ffff0000ffff0001"),
                new Candidate("front", "FRONT", Outcome.APPROVED, 0.70, false, "ffff0000ffff0003")));
        assertThat(r).containsEntry("detail", Role.DETAIL).containsEntry("review", Role.REVIEW).containsEntry("front", Role.CANONICAL);
    }

    @Test
    void semAprovadaNaoHaCanonicaEOProdutoVaiParaRevisao() {
        Map<String, Role> r = roles(List.of(new Candidate("m", "FRONT", Outcome.NEEDS_REPROCESSING, 0.7, false, null)));
        assertThat(r).containsEntry("m", Role.REVIEW).doesNotContainValue(Role.CANONICAL);
    }
}
