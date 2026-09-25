package br.com.fashionai.web.support;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** O token do gate assinado pelo frontend (lib/gate/token.ts, Web Crypto) precisa valer no backend (javax.crypto). */
class DevGateFilterTest {
    // gerado por signGate("matheushaliskitcc20233", "segredo-de-teste", 3600) em lib/gate/token.ts
    static final String TOKEN = "v1.matheushaliskitcc20233.1790345791.rCeGXFacw1O6AO8lYXTb4Mymjel43E8btNOyIJe_0ZE";
    static final String USER = "matheushaliskitcc20233";
    static final long BEFORE_EXPIRY = 1790345000L;

    @Test
    void aceitaTokenAssinadoPeloFrontend() {
        assertTrue(DevGateFilter.valid(TOKEN, "segredo-de-teste", USER, BEFORE_EXPIRY));
    }

    @Test
    void recusaSegredoUsuarioOuAssinaturaDiferentes() {
        assertFalse(DevGateFilter.valid(TOKEN, "outro-segredo", USER, BEFORE_EXPIRY));
        assertFalse(DevGateFilter.valid(TOKEN, "segredo-de-teste", "outro_usuario", BEFORE_EXPIRY));
        assertFalse(DevGateFilter.valid(TOKEN.substring(0, TOKEN.length() - 2) + "AA", "segredo-de-teste", USER, BEFORE_EXPIRY));
        assertFalse(DevGateFilter.valid(TOKEN.replace(".1790345791.", ".1890345791."), "segredo-de-teste", USER, BEFORE_EXPIRY));
    }

    @Test
    void recusaTokenVencidoAusenteOuSemSegredo() {
        assertFalse(DevGateFilter.valid(TOKEN, "segredo-de-teste", USER, 1790345792L));
        assertFalse(DevGateFilter.valid(null, "segredo-de-teste", USER, BEFORE_EXPIRY));
        assertFalse(DevGateFilter.valid(TOKEN, "", USER, BEFORE_EXPIRY));
        assertFalse(DevGateFilter.valid("v1.x.y", "segredo-de-teste", USER, BEFORE_EXPIRY));
    }
}
