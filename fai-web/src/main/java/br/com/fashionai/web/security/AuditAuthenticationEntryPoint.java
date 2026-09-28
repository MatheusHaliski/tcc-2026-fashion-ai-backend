package br.com.fashionai.web.security;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.audit.AuditEvent;
import br.com.fashionai.application.audit.AuditService;
import br.com.fashionai.web.error.ErrorWriter;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Component
public class AuditAuthenticationEntryPoint implements AuthenticationEntryPoint {
    private final AuditService auditService;
    private final ErrorWriter errors;

    public AuditAuthenticationEntryPoint(AuditService auditService, ErrorWriter errors) {
        this.auditService = auditService;
        this.errors = errors;
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException authException)
            throws IOException, ServletException {
        auditService.record(new AuditEvent(
                "anonymous",
                AuditActions.LOGIN_FALHO,
                request.getRequestURI(),
                "NAO_AUTENTICADO",
                br.com.fashionai.web.support.CorrelationIdFilter.clientIp(request),
                request.getHeader("User-Agent"),
                Instant.now(),
                Optional.ofNullable(request.getHeader("X-Correlation-Id")).orElse(UUID.randomUUID().toString()),
                Map.of("method", request.getMethod())
        ));
        errors.write(request, response, 401, "NAO_AUTENTICADO", Msg.t("common.faca_login_para_continuar"));
    }
}
