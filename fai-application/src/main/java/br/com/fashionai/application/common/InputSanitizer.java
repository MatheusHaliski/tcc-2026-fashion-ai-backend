package br.com.fashionai.application.common;

import br.com.fashionai.application.common.Msg;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * RN11 — tratamento de dados vindos de formulários: remove HTML/controles, normaliza espaços, aplica
 * limite de tamanho e bloqueia termos ofensivos óbvios (moderação textual local; casos duvidosos vão para
 * a fila humana pelo ModerationService).
 */
public final class InputSanitizer {
    private static final List<String> BLOCKED = List.of("nazista", "nazi", "hitler", "estupro", "pedofil", "kkk",
            "macaco imundo", "viado imundo", "fag", "nigger", "retardado", "vagabunda", "puta que", "vai se foder");

    private InputSanitizer() {
    }

    public static String clean(String text, int max) {
        if (text == null) {
            return null;
        }
        String t = text.replaceAll("<[^>]*>", "").replaceAll("[\\p{Cntrl}&&[^\n\t]]", "").replaceAll("[ \\t]+", " ").trim();
        if (t.length() > max) {
            t = t.substring(0, max);
        }
        return t;
    }

    public static String required(String field, String text, int min, int max) {
        String t = clean(text, Integer.MAX_VALUE);
        if (t == null || t.length() < min) {
            throw ApiException.badRequest("CAMPO_INVALIDO", Msg.t("inputSanitizer.preencha_o_campo", field), Map.of(field, Msg.t("inputSanitizer.minimo_caracteres", min)));
        }
        if (t.length() > max) {
            throw ApiException.badRequest("CAMPO_INVALIDO", Msg.t("inputSanitizer.o_campo_aceita_no_maximo", field, max),
                    Map.of(field, Msg.t("inputSanitizer.maximo_caracteres", max)));
        }
        return t;
    }

    public static boolean offensive(String text) {
        if (text == null) {
            return false;
        }
        String n = Normalizer.normalize(text, Normalizer.Form.NFKD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT);
        return BLOCKED.stream().anyMatch(n::contains);
    }

    public static String moderated(String field, String text, int max) {
        String t = clean(text, max);
        if (offensive(t)) {
            throw ApiException.badRequest("CONTEUDO_BLOQUEADO", Msg.t("inputSanitizer.o_texto_do_campo_viola", field));
        }
        return t;
    }
}
