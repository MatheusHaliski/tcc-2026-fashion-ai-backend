package br.com.fashionai.web.support;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.util.UrlPathHelper;

import java.util.Locale;

/**
 * Caminho da requisição como o roteamento o enxerga: decodificado e normalizado pelo contêiner
 * ({@code getServletPath()} + {@code getPathInfo()}), nunca o {@code getRequestURI()} cru — com ele,
 * {@code POST /api/auth/%6cogin} chegaria ao login sem casar com a regra de {@code /api/auth/login}.
 */
public final class RequestPaths {
    private static final UrlPathHelper DECODING = new UrlPathHelper();

    static {
        DECODING.setUrlDecode(true);
        DECODING.setRemoveSemicolonContent(true);
    }

    private RequestPaths() {
    }

    /** Caminho decodificado, sem parâmetros de ";", barras repetidas ou barra final, em minúsculas (só para comparar). */
    public static String normalized(HttpServletRequest request) {
        String servletPath = request.getServletPath() == null ? "" : request.getServletPath();
        String pathInfo = request.getPathInfo() == null ? "" : request.getPathInfo();
        String path = servletPath + pathInfo;
        if (path.isEmpty()) {
            // sem mapeamento de servlet preenchido (ex.: MockMvc): decodifica a URI como o Spring MVC faria
            path = DECODING.getPathWithinApplication(request);
        }
        return normalize(path);
    }

    static String normalize(String raw) {
        String p = raw == null ? "" : raw;
        p = p.replace('\\', '/').replaceAll(";[^/]*", "").replaceAll("/{2,}", "/");
        while (p.length() > 1 && p.endsWith("/")) {
            p = p.substring(0, p.length() - 1);
        }
        return p.toLowerCase(Locale.ROOT);
    }
}
