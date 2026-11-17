package br.com.fashionai.application.audit;

import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Metadados da auditoria nunca guardam segredo: chaves sensíveis viram [REDACTED] e nulos viram texto vazio. */
class AuditSanitizerTest {

    @Test
    void escondeChavesSensiveisSemDiferenciarMaiusculas() {
        Map<String, Object> in = new LinkedHashMap<>();
        in.put("password", "123");
        in.put("novaSenha", "abc");
        in.put("ACCESS_TOKEN", "t");
        in.put("clientSecret", "s");
        in.put("private_key_pem", "k");
        in.put("email_ciphertext", "c");
        in.put("refreshCookie", "r");
        Map<String, Object> out = AuditSanitizer.sanitize(in);
        assertThat(out.values()).containsOnly("[REDACTED]");
        assertThat(out).containsOnlyKeys(in.keySet());
    }

    @Test
    void mantemOsValoresComunsENulosViramTextoVazio() {
        Map<String, Object> in = new HashMap<>();
        in.put("pieceId", "p1");
        in.put("count", 3);
        in.put("confidence", null);
        Map<String, Object> out = AuditSanitizer.sanitize(in);
        assertThat(out).containsEntry("pieceId", "p1").containsEntry("count", 3).containsEntry("confidence", "");
    }

    @Test
    void chaveNulaViraChaveVazia() {
        Map<String, Object> in = new HashMap<>();
        in.put(null, "x");
        assertThat(AuditSanitizer.sanitize(in)).containsEntry("", "x");
    }

    @Test
    void oResultadoNaoPodeSerAlterado() {
        Map<String, Object> out = AuditSanitizer.sanitize(Map.of("a", 1));
        assertThatThrownBy(() -> out.put("b", 2)).isInstanceOf(UnsupportedOperationException.class);
    }
}
