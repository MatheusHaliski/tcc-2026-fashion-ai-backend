package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;

import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** Regras puras dos campos do cadastro: senha forte, CNPJ com dígitos verificadores e o @ (normalizado, reservado). */
final class IdentityFieldRules {
    /** @ que ninguém escolhe no cadastro nem na troca (a conta de administração vem do AdminBootstrap). */
    static final Set<String> RESERVED_USERNAMES = Set.of("admin", "administrador", "administrator", "adm", "root",
            "support", "suporte", "fashionai", "fashion_ai", "fashion.ai", "fai", "api", "gate", "system", "sistema",
            "moderador", "moderadora", "moderator", "moderacao", "staff", "equipe", "oficial", "official", "seguranca",
            "security", "ajuda", "help", "contato", "null", "undefined", "anonymous", "anonimo");

    private IdentityFieldRules() {
    }

    static void validatePassword(String password, Map<String, Object> errors) {
        if (password == null || password.length() < 8 || !password.matches(".*[A-Z].*") || !password.matches(".*\\d.*")
                || !password.matches(".*[^A-Za-z0-9].*")) {
            errors.put("password", Msg.t("identity.a_senha_precisa_de_no"));
        }
    }

    static boolean validCnpj(String raw) {
        if (raw == null) {
            return false;
        }
        String cnpj = raw.replaceAll("\\D", "");
        if (cnpj.length() != 14 || cnpj.chars().distinct().count() == 1) {
            return false;
        }
        int[] w1 = {5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2};
        int[] w2 = {6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2};
        int sum = 0;
        for (int i = 0; i < 12; i++) {
            sum += (cnpj.charAt(i) - '0') * w1[i];
        }
        int d1 = sum % 11 < 2 ? 0 : 11 - sum % 11;
        sum = 0;
        for (int i = 0; i < 13; i++) {
            sum += (cnpj.charAt(i) - '0') * w2[i];
        }
        int d2 = sum % 11 < 2 ? 0 : 11 - sum % 11;
        return d1 == cnpj.charAt(12) - '0' && d2 == cnpj.charAt(13) - '0';
    }

    static String normalizeUsername(String raw) {
        String u = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT).replaceFirst("^@", "");
        u = u.replaceAll("[^a-z0-9._]", "");
        return u.length() > 30 ? u.substring(0, 30) : u;
    }

    /** @ reservado (administração, suporte, a própria marca): comparação exata depois da normalização. */
    static boolean reservedUsername(String normalized) {
        if (normalized == null) {
            return false;
        }
        String n = normalized.toLowerCase(Locale.ROOT);
        // demo_ é das fixtures do Demo/Test Data Pipeline: uma pessoa real com esse prefixo passaria por conta demo
        return RESERVED_USERNAMES.contains(n) || n.startsWith(br.com.fashionai.domain.model.User.DEMO_PREFIX);
    }

    /**
     * Motivo de recusa de um @ já normalizado, ou null se ele pode ser usado. A normalização descarta tudo que não é
     * letra, número, ponto ou "_": "!!!" viraria um @ vazio.
     */
    static String usernameProblem(String normalized) {
        if (normalized == null || normalized.length() < 3) {
            return Msg.t("preferences.o_precisa_de_ao_menos");
        }
        if (reservedUsername(normalized)) {
            return Msg.t("identity.username_reservado");
        }
        return null;
    }
}
