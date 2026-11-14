package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Reauditoria: dava para ter dois 10×10 ativos na mesma conta (o catálogo passava a "2 jogando agora"). */
class ChallengeSlotPolicyTest {
    private static Map<String, Object> mine(String code, String state, String myStatus) {
        return Map.of("id", code + "-" + state, "name", code, "code", code, "state", state, "myStatus", myStatus);
    }

    @Test
    void naoComecaOMesmoDesafioDuasVezes() {
        List<Map<String, Object>> ativos = List.of(mine("TEN_X_TEN", ChallengeService.ATIVO, ChallengeService.P_ATIVO));
        assertThatThrownBy(() -> ChallengeSlotPolicy.requireNotPlaying(ativos, "TEN_X_TEN", "10×10"))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.status()).isEqualTo(409);
                    assertThat(e.code()).isEqualTo("DESAFIO_JA_ATIVO");
                    assertThat(e.getMessage()).contains("10×10").doesNotContain("§");
                });
        // outro desafio, rascunho, concluído ou um do qual a pessoa já saiu não impedem
        assertThatCode(() -> ChallengeSlotPolicy.requireNotPlaying(ativos, "NO_REPEAT", "Sem Repetir")).doesNotThrowAnyException();
        List<Map<String, Object>> livres = List.of(mine("TEN_X_TEN", ChallengeService.RASCUNHO, ChallengeService.P_ATIVO),
                mine("TEN_X_TEN", ChallengeService.CONCLUIDO, ChallengeService.P_CONCLUIU), mine("TEN_X_TEN", ChallengeService.ATIVO, ChallengeService.P_SAIU));
        assertThatCode(() -> ChallengeSlotPolicy.requireNotPlaying(livres, "TEN_X_TEN", "10×10")).doesNotThrowAnyException();
    }

    @Test
    void limiteDeVagasContinuaComALista() {
        List<Map<String, Object>> ativos = List.of(mine("A", ChallengeService.ATIVO, ChallengeService.P_ATIVO), mine("B", ChallengeService.AGUARDANDO, ChallengeService.P_ATIVO));
        assertThatCode(() -> ChallengeSlotPolicy.requireSlot(2, 3, () -> ativos)).doesNotThrowAnyException();
        assertThatThrownBy(() -> ChallengeSlotPolicy.requireSlot(3, 3, () -> ativos))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("LIMITE_DESAFIOS"));
    }
}
