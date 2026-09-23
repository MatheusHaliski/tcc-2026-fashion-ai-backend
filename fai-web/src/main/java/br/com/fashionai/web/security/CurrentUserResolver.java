package br.com.fashionai.web.security;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.web.support.CorrelationIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.MethodParameter;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import java.util.UUID;

/**
 * Injeta {@link CurrentUser} nos controllers: relê o usuário do banco a cada requisição, então suspensão,
 * papel e status valem na hora (RNF1). Em rotas públicas sem token, o parâmetro chega nulo (visitante).
 */
@Component
public class CurrentUserResolver implements HandlerMethodArgumentResolver {
    private final UserRepository users;

    public CurrentUserResolver(UserRepository users) {
        this.users = users;
    }

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return CurrentUser.class.equals(parameter.getParameterType());
    }

    @Override
    public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mav, NativeWebRequest webRequest,
                                  WebDataBinderFactory binderFactory) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (!(auth instanceof JwtAuthenticationToken token)) {
            return null;
        }
        String id = token.getToken().getClaimAsString("user_id");
        if (id == null) {
            id = token.getToken().getSubject();
        }
        HttpServletRequest request = webRequest.getNativeRequest(HttpServletRequest.class);
        return users.findById(UUID.fromString(id))
                .filter(u -> u.getStatus() != AccountStatus.DELETED)
                .map(u -> CurrentUser.of(u, request == null ? null : CorrelationIdFilter.clientIp(request),
                        request == null ? null : request.getHeader("User-Agent")))
                .orElseThrow(() -> ApiException.unauthorized("Conta não encontrada. Faça login novamente."));
    }
}
