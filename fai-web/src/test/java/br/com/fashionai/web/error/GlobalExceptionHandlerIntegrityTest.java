package br.com.fashionai.web.error;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;

import java.sql.SQLException;
import java.sql.SQLIntegrityConstraintViolationException;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Regressão da auditoria (Lens): um valor que não cabe na coluna era respondido como 409 "conflita com um registro
 * existente". Conflito só para violação de restrição; erro de dado é erro interno.
 */
class GlobalExceptionHandlerIntegrityTest {
    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();
    private final MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/lens/scans");

    @Test
    void valorQueNaoCabeNaColunaEErroInternoNaoConflito() {
        SQLException truncation = new SQLException("Data too long for column 'ai_source' at row 1", "22001", 1406);
        ResponseEntity<ApiError> res = handler.integrity(new DataIntegrityViolationException("insert", truncation), req);
        assertThat(res.getStatusCode().value()).isEqualTo(500);
        assertThat(res.getBody().code()).isEqualTo("ERRO_INTERNO");
        assertThat(res.getBody().message()).doesNotContain("ai_source");
    }

    @Test
    void violacaoDeRestricaoContinuaSendoConflito() {
        SQLException duplicate = new SQLIntegrityConstraintViolationException("Duplicate entry", "23000", 1062);
        ResponseEntity<ApiError> res = handler.integrity(new DataIntegrityViolationException("insert", duplicate), req);
        assertThat(res.getStatusCode().value()).isEqualTo(409);
        assertThat(res.getBody().code()).isEqualTo("CONFLITO");
    }
}
