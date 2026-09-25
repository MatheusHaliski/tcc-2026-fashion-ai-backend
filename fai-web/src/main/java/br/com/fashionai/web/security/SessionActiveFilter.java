package br.com.fashionai.web.security;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.RequestActor;
import br.com.fashionai.application.service.IdentityService;
import br.com.fashionai.web.error.ErrorWriter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * Depois da validação do JWT: recusa tokens de sessões encerradas (logout, "sair de todos os dispositivos",
 * troca de senha — RF2/RF3) e registra o ator da requisição para a auditoria das entidades (RNF5).
 * Não é @Component para não ser registrado duas vezes (servlet + cadeia de segurança).
 */
public class SessionActiveFilter extends OncePerRequestFilter {
    private final IdentityService identity;
    private final ErrorWriter errors;

    public SessionActiveFilter(IdentityService identity, ErrorWriter errors) {
        this.identity = identity;
        this.errors = errors;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth instanceof JwtAuthenticationToken token) {
            String sid = token.getToken().getClaimAsString("sid");
            if (sid != null && !identity.sessionActive(UUID.fromString(sid))) {
                SecurityContextHolder.clearContext();
                errors.write(request, response, 401, "SESSAO_ENCERRADA", Msg.t("sessionActiveFilter.sua_sessao_foi_encerrada_faca"));
                return;
            }
            RequestActor.set(token.getToken().getClaimAsString("user_id"));
        }
        try {
            chain.doFilter(request, response);
        } finally {
            RequestActor.clear();
        }
    }
}
