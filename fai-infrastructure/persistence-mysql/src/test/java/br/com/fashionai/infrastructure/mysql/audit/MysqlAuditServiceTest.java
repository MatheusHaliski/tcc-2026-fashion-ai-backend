package br.com.fashionai.infrastructure.mysql.audit;

import br.com.fashionai.application.audit.AuditEvent;
import br.com.fashionai.domain.model.AuditLog;
import br.com.fashionai.domain.repository.AuditLogRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Trilha de auditoria: grava o evento com os metadados em JSON e não falha se a serialização falhar. */
class MysqlAuditServiceTest {
    private final AuditLogRepository repository = mock(AuditLogRepository.class);
    private final Instant at = Instant.parse("2026-03-01T10:00:00Z");

    private AuditLog saved() {
        ArgumentCaptor<AuditLog> log = ArgumentCaptor.forClass(AuditLog.class);
        verify(repository).save(log.capture());
        return log.getValue();
    }

    @Test
    void gravaOEventoComMetadadosEmJson() {
        new MysqlAuditService(repository, JsonMapper.builder().build())
                .record(new AuditEvent("ana", "LOGIN", "/api/auth", "OK", "1.2.3.4", "junit", at, "corr-1", Map.of("k", "v")));
        AuditLog log = saved();
        assertThat(log).extracting("actor", "acao", "recurso", "resultado", "ip", "userAgent", "timestamp", "correlationId", "metadataJson")
                .containsExactly("ana", "LOGIN", "/api/auth", "OK", "1.2.3.4", "junit", at, "corr-1", "{\"k\":\"v\"}");
    }

    @Test
    void falhaDeSerializacaoViraMarcador() {
        ObjectMapper broken = mock(ObjectMapper.class);
        when(broken.writeValueAsString(any())).thenThrow(mock(JacksonException.class));
        new MysqlAuditService(repository, broken)
                .record(new AuditEvent("ana", "LOGIN", "/api/auth", "OK", null, null, at, null, Map.of()));
        assertThat(saved()).extracting("metadataJson").isEqualTo("{\"auditMetadataSerialization\":\"failed\"}");
    }
}
