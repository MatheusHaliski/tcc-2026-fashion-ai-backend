package br.com.fashionai.application.lens;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;

import java.util.Locale;
import java.util.Map;

/** Leitura tolerante dos campos de entrada do Lens (enum, texto em branco) e o 400 padrão de valor inválido. */
final class LensInputs {
    private LensInputs() {
    }

    static <E extends Enum<E>> E parseEnum(Class<E> type, String raw, E fallback, String field) {
        if (raw == null || raw.isBlank()) {
            return fallback;
        }
        try {
            return Enum.valueOf(type, raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw ApiException.badRequest("VALOR_INVALIDO", Msg.t("lens.valor_invalido", field), Map.of("field", field));
        }
    }

    static ApiException invalid(String field) {
        return ApiException.badRequest("VALOR_INVALIDO", Msg.t("lens.valor_invalido", field), Map.of("field", field));
    }

    static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    static boolean eq(String a, String b) {
        return a == null ? b == null : a.equals(b);
    }
}
