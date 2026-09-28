package br.com.fashionai.web.support;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * Correlation id por requisição (RNF5): vem do cliente em X-Correlation-Id ou é gerado, volta no header e no log.
 * Também resolve o IP do cliente uma única vez ({@link ClientIpResolver}) para todo o resto da requisição.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorrelationIdFilter extends OncePerRequestFilter {
    public static final String HEADER = "X-Correlation-Id";
    private static final String ATTRIBUTE = CorrelationIdFilter.class.getName() + ".correlationId";

    private final ClientIpResolver clientIp;

    public CorrelationIdFilter(ObjectProvider<ClientIpResolver> clientIp) {
        this.clientIp = clientIp.getIfAvailable();
    }

    public static String correlationId(HttpServletRequest request) {
        Object id = request.getAttribute(ATTRIBUTE);
        return id == null ? null : id.toString();
    }

    /**
     * IP do cliente resolvido pelo {@link ClientIpResolver} nesta requisição. Sem ele (fora da cadeia de filtros),
     * o endereço da conexão — nunca o X-Forwarded-For, que o próprio cliente escreve.
     */
    public static String clientIp(HttpServletRequest request) {
        String resolved = ClientIpResolver.cached(request);
        return resolved != null ? resolved : ClientIpResolver.socketAddress(request);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String incoming = request.getHeader(HEADER);
        String id = incoming != null && incoming.matches("[A-Za-z0-9-]{8,64}") ? incoming : UUID.randomUUID().toString();
        request.setAttribute(ATTRIBUTE, id);
        response.setHeader(HEADER, id);
        if (clientIp != null) {
            clientIp.resolve(request);
        }
        MDC.put("correlationId", id);
        try {
            chain.doFilter(request, response);
        } finally {
            MDC.remove("correlationId");
        }
    }
}
