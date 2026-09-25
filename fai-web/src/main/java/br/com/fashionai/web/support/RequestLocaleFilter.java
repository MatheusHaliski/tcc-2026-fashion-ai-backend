package br.com.fashionai.web.support;

import br.com.fashionai.application.common.Msg;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Locale;

/**
 * RF23 — idioma da requisição antes da cadeia de segurança. O {@code AcceptHeaderLocaleResolver} só roda dentro do
 * DispatcherServlet; respostas 401/403 escritas pelo Spring Security e pelos filtros (sessão encerrada, gate) saíam sempre
 * em pt-BR. Este filtro lê o {@code Accept-Language} logo no início (primeiro idioma suportado na ordem de preferência,
 * pt-BR como padrão), publica no {@link LocaleContextHolder} e devolve {@code Content-Language}.
 */
@Component
@Order(-104)   // depois do RequestContextFilter do Spring Boot (-105), que sobrescreveria o locale, e antes do Spring Security (-100)
public class RequestLocaleFilter extends OncePerRequestFilter {

    static Locale pick(String acceptLanguage) {
        if (acceptLanguage == null || acceptLanguage.isBlank()) {
            return Msg.PT_BR;
        }
        try {
            List<Locale.LanguageRange> ranges = Locale.LanguageRange.parse(acceptLanguage);
            for (Locale.LanguageRange r : ranges) {
                String lang = Locale.forLanguageTag(r.getRange()).getLanguage();
                if ("pt".equals(lang) || "en".equals(lang) || "es".equals(lang)) {
                    return Msg.supported(Locale.forLanguageTag(r.getRange()));
                }
            }
        } catch (IllegalArgumentException ignored) {
            // cabeçalho malformado: padrão
        }
        return Msg.PT_BR;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Locale locale = pick(request.getHeader("Accept-Language"));
        LocaleContextHolder.setLocale(locale, true);
        response.setHeader("Content-Language", locale.toLanguageTag());
        try {
            chain.doFilter(request, response);
        } finally {
            LocaleContextHolder.resetLocaleContext();
        }
    }
}
