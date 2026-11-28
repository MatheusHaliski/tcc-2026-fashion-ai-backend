package br.com.fashionai.application.flair;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.service.CouponHypeGate;
import br.com.fashionai.application.service.CouponHypeRules;
import br.com.fashionai.domain.model.FlairCombination;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;

/**
 * Circuito Aura (fase 1) — Hype mínimo da combinação FLAIR. As cartas da combinação (o deck apresentado ou, no tipo
 * COLECAO, o guarda-roupa) precisam ter ao menos uma com Hype público e atualizado na faixa pedida. O requisito entra
 * no checklist como {@code HYPE}, então a vitrine mostra "travado" como qualquer outro requisito; só leitura do Hype.
 */
final class FlairCouponHype {
    static final String KIND = "HYPE";
    private final CouponHypeGate gate;

    FlairCouponHype(CouponHypeGate gate) {
        this.gate = gate;
    }

    /** Faixa vinda do formulário da loja (vazio = sem exigência; inválida = 400). */
    static String minimum(String raw) {
        return CouponHypeRules.resolve(raw);
    }

    List<Map<String, Object>> withHype(List<Map<String, Object>> checks, FlairCombination c, List<FlairEngine.Card> cards) {
        HypeLevel min = CouponHypeRules.parse(c.getMinHypeLevel());
        if (min == null) {
            return checks;
        }
        List<UUID> ids = cards.stream().map(FlairCouponHype::pieceId).filter(Objects::nonNull).toList();
        HypeLevel best = gate.best(HypeEntityType.PIECE, ids);
        Map<String, Object> check = new LinkedHashMap<>();
        check.put("kind", KIND);
        check.put("value", best == null ? "" : best.name());
        check.put("required", min.name());
        String need = Msg.t("aura.faixa." + min.name());
        check.put("label", best == null ? Msg.t("flair.hype_minimo_sem", need) : Msg.t("flair.hype_minimo", need, Msg.t("aura.faixa." + best.name())));
        check.put("ok", CouponHypeRules.meets(min.name(), best));
        List<Map<String, Object>> out = new ArrayList<>(checks);
        out.add(check);
        return out;
    }

    private static UUID pieceId(FlairEngine.Card card) {
        try {
            return card.id() == null ? null : UUID.fromString(card.id());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /** Checklist incompleto: quando só o Hype falta, o motivo é o Hype; senão, o de sempre (deck não completa). */
    static ApiException incomplete(List<Map<String, Object>> checks) {
        Map<String, Object> hype = checks.stream().filter(x -> KIND.equals(x.get("kind"))).findFirst().orElse(null);
        boolean othersOk = !checks.isEmpty() && checks.stream().filter(x -> x != hype).allMatch(x -> Boolean.TRUE.equals(x.get("ok")));
        if (hype != null && othersOk && !Boolean.TRUE.equals(hype.get("ok"))) {
            return CouponHypeRules.insufficient(String.valueOf(hype.get("required")), CouponHypeRules.parse(String.valueOf(hype.get("value"))));
        }
        return new ApiException(422, "COMBINACAO_INCOMPLETA", Msg.t("flair.o_deck_ainda_nao_completa"), Map.of("checks", checks));
    }

    /** Faixa das cartas na hora da emissão (do requisito já conferido); nula quando a combinação não exige Hype. */
    static String levelAtIssue(List<Map<String, Object>> checks) {
        return checks.stream().filter(x -> KIND.equals(x.get("kind"))).map(x -> String.valueOf(x.get("value")))
                .filter(v -> !v.isBlank()).findFirst().orElse(null);
    }
}
