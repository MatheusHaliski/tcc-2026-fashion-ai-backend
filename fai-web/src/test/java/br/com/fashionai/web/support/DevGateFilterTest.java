package br.com.fashionai.web.support;

import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** O token de API do gate assinado pelo frontend (lib/gate/token.ts, Web Crypto) precisa valer no backend (javax.crypto). */
class DevGateFilterTest {
    static final String SECRET = "segredo-de-teste-com-pelo-menos-32-caracteres";
    // signGate("ga", "ana@exemplo.com", "jti-teste", SECRET) com expiração 1790345791 (conferido em lib/gate/token.test.ts)
    static final String GA = "ga.eyJpIjoiYW5hQGV4ZW1wbG8uY29tIiwiaiI6Imp0aS10ZXN0ZSJ9.1790345791.SGqSCKhWgDHjH28hPBtrsFIKvGcVVDuSVKCkkeQcEpg";
    // o mesmo conteúdo como token de PÁGINA ("gp"): não pode abrir a API
    static final String GP = "gp.eyJpIjoiYW5hQGV4ZW1wbG8uY29tIiwiaiI6Imp0aS10ZXN0ZSJ9.1790345791.r7BeTaPIGTL-EApim5qZeepezl9QIaJbvgRuxnsaMzM";
    static final long BEFORE_EXPIRY = 1790345000L;
    static final Set<String> LIST = Set.of("ana@exemplo.com", "bia@exemplo.com");

    @Test
    void aceitaTokenDeApiAssinadoPeloFrontend() {
        assertTrue(DevGateFilter.valid(GA, SECRET, LIST, BEFORE_EXPIRY));
        assertTrue(DevGateFilter.valid(GA, SECRET, Set.of(), BEFORE_EXPIRY));   // sem lista na API: vale a assinatura
    }

    @Test
    void recusaTokenDePaginaTokenAntigoEIdentidadeRevogada() {
        assertFalse(DevGateFilter.valid(GP, SECRET, LIST, BEFORE_EXPIRY));
        assertFalse(DevGateFilter.valid("v1.matheushaliskitcc20233.1790345791.rCeGXFacw1O6AO8lYXTb4Mymjel43E8btNOyIJe_0ZE", SECRET, LIST, BEFORE_EXPIRY));
        assertFalse(DevGateFilter.valid(GA, SECRET, Set.of("bia@exemplo.com"), BEFORE_EXPIRY));
    }

    @Test
    void transicaoAceitaTokenAntigoDoFront() {
        // signLegacyApiToken("matheushaliskitcc20233", SECRET) com expiração 1790345791 (lib/gate/token.ts)
        String v1 = "v1.matheushaliskitcc20233.1790345791." + legacySig();
        assertTrue(DevGateFilter.validLegacy(v1, SECRET, "matheushaliskitcc20233", BEFORE_EXPIRY));
        assertFalse(DevGateFilter.validLegacy(v1, SECRET, "outro_usuario", BEFORE_EXPIRY));
        assertFalse(DevGateFilter.validLegacy(v1, SECRET, "matheushaliskitcc20233", 1790345792L));
        assertFalse(DevGateFilter.validLegacy(GA, SECRET, "matheushaliskitcc20233", BEFORE_EXPIRY));
        assertFalse(DevGateFilter.validLegacy(v1, "curto", "matheushaliskitcc20233", BEFORE_EXPIRY));
    }

    private static String legacySig() {
        try {
            javax.crypto.Mac mac = javax.crypto.Mac.getInstance("HmacSHA256");
            mac.init(new javax.crypto.spec.SecretKeySpec(SECRET.getBytes(java.nio.charset.StandardCharsets.UTF_8), "HmacSHA256"));
            return java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(
                    mac.doFinal("v1.matheushaliskitcc20233.1790345791".getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @Test
    void recusaSegredoOuAssinaturaDiferentes() {
        assertFalse(DevGateFilter.valid(GA, SECRET + "x", LIST, BEFORE_EXPIRY));
        assertFalse(DevGateFilter.valid(GA.substring(0, GA.length() - 2) + "AA", SECRET, LIST, BEFORE_EXPIRY));
        assertFalse(DevGateFilter.valid(GA.replace(".1790345791.", ".1890345791."), SECRET, LIST, BEFORE_EXPIRY));
    }

    @Test
    void recusaTokenVencidoAusenteOuSegredoCurto() {
        assertFalse(DevGateFilter.valid(GA, SECRET, LIST, 1790345792L));
        assertFalse(DevGateFilter.valid(null, SECRET, LIST, BEFORE_EXPIRY));
        assertFalse(DevGateFilter.valid(GA, "curto", LIST, BEFORE_EXPIRY));
        assertFalse(DevGateFilter.valid("ga.x.y", SECRET, LIST, BEFORE_EXPIRY));
    }

    @Test
    void naoSobeComSegredoCurtoOuCloudflareIncompleto() {
        assertThrows(IllegalStateException.class, () -> new DevGateFilter(true, "builtin", "curto", "equipe", "", "", "", true, "http://localhost:3000"));
        assertThrows(IllegalStateException.class, () -> new DevGateFilter(true, "cloudflare", "", "equipe", "", "", "", true, "http://localhost:3000"));
        new DevGateFilter(false, "builtin", "", "equipe", "", "", "", true, "http://localhost:3000");   // desligado: sem exigências
        new DevGateFilter(true, "builtin", SECRET, "equipe", "ana@exemplo.com", "", "", true, "http://localhost:3000");
    }
}
