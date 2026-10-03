package br.com.fashionai.application.seal;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** RF25 — #createsealpolicy (doc 06, padrões P01, P05, P09, P13, P15, P17) vira campos do SealPolicy. */
class SealPolicyInterpreterTest {

    @SuppressWarnings("unchecked")
    private static Map<String, Object> sub(Map<String, Object> p, String k) {
        return (Map<String, Object>) p.get(k);
    }

    @Test
    void p01ColecaoEPecasMinimas() {
        var r = SealPolicyInterpreter.interpret("#createsealpolicy selo tier LOOK para looks com pelo menos «3» peças da coleção «Inverno 26»", null, "brand");
        assertThat(r.policy().get("tier")).isEqualTo("LOOK");
        assertThat(sub(r.policy(), "eligibility").get("min_pieces_from_issuer")).isEqualTo(3);
        assertThat((List<String>) sub(r.policy(), "eligibility").get("collections")).containsExactly("inverno_26");
    }

    @Test
    void p05RevisaoHibridaEp09Teto() {
        var r = SealPolicyInterpreter.interpret("#createsealpolicy aprovar automaticamente acima de «0,85», revisar manualmente entre «0,72» e «0,85»; SLA de «48 h». teto de «2.000» selos, «1» por usuário, no máximo 200 por semana", null, "brand");
        Map<String, Object> rv = sub(r.policy(), "review");
        assertThat(rv.get("mode")).isEqualTo("hybrid");
        assertThat((Double) rv.get("auto_threshold")).isEqualTo(0.85);
        assertThat(sub(r.policy(), "quota").get("total")).isEqualTo(2000);
        assertThat(sub(r.policy(), "quota").get("per_user")).isEqualTo(1);
        assertThat(sub(sub(r.policy(), "quota"), "per_period").get("period")).isEqualTo("week");
    }

    @Test
    void formatoPromocaoENomes() {
        var r = SealPolicyInterpreter.interpret("#createsealpolicy selo folha, material «madeira», cupom de loja de 15%, propor 3 nomes", null, "brand");
        assertThat(sub(r.policy(), "aesthetics").get("format")).isEqualTo("FOLHA");
        assertThat(sub(r.policy(), "aesthetics").get("material")).isEqualTo("madeira");
        assertThat(sub(sub(r.policy(), "promotion"), "create").get("type")).isEqualTo("CUPOM_LOJA");
        assertThat((List<String>) r.policy().get("name_proposals")).hasSize(3);
    }

    @Test
    void semCriterioNaoInventaNada() {
        var r = SealPolicyInterpreter.interpret("#createsealpolicy olá", null, "brand");
        assertThat(r.understood()).isEmpty();
        assertThat(r.policy().get("tier")).isEqualTo("LOOK");
        assertThat(sub(r.policy(), "review").get("mode")).isEqualTo("manual");
    }
}
