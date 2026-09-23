package br.com.fashionai.web.security;

import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.audit.AuditEvent;
import br.com.fashionai.application.audit.AuditService;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Component
public class AuditAccessDeniedHandler implements AccessDeniedHandler {
    private final AuditService auditService;

    public AuditAccessDeniedHandler(AuditService auditService) {
        this.auditService = auditService;
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, AccessDeniedException accessDeniedException)
            throws IOException, ServletException {
        Authentication authentication = (Authentication) request.getUserPrincipal();
        auditService.record(new AuditEvent(
                authentication == null ? "anonymous" : authentication.getName(),
                AuditActions.ACESSO_NEGADO_403,
                request.getRequestURI(),
                "NEGADO",
                request.getRemoteAddr(),
                request.getHeader("User-Agent"),
                Instant.now(),
                Optional.ofNullable(request.getHeader("X-Correlation-Id")).orElse(UUID.randomUUID().toString()),
                Map.of("method", request.getMethod())
        ));
        response.sendError(HttpServletResponse.SC_FORBIDDEN);
    }
}
