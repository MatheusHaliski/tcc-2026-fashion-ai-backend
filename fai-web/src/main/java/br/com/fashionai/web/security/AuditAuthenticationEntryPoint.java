package br.com.fashionai.web.security;

import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.audit.AuditEvent;
import br.com.fashionai.application.audit.AuditService;
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

    public AuditAuthenticationEntryPoint(AuditService auditService) {
        this.auditService = auditService;
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException authException)
            throws IOException, ServletException {
        auditService.record(new AuditEvent(
                "anonymous",
                AuditActions.LOGIN_FALHO,
                request.getRequestURI(),
                "NAO_AUTENTICADO",
                request.getRemoteAddr(),
                request.getHeader("User-Agent"),
                Instant.now(),
                Optional.ofNullable(request.getHeader("X-Correlation-Id")).orElse(UUID.randomUUID().toString()),
                Map.of("method", request.getMethod())
        ));
        response.sendError(HttpServletResponse.SC_UNAUTHORIZED);
    }
}
