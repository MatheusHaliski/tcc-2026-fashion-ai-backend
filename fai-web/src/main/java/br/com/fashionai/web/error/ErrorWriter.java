package br.com.fashionai.web.error;

import br.com.fashionai.web.support.CorrelationIdFilter;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;

/** Escreve {@link ApiError} direto na resposta — usado pelos filtros de segurança, que rodam fora do MVC. */
@Component
public class ErrorWriter {
    private final ObjectMapper mapper;

    public ErrorWriter(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public static ApiError of(HttpServletRequest request, int status, String code, String message, Map<String, Object> details) {
        return new ApiError(status, code, message, details == null ? Map.of() : details, request.getRequestURI(),
                Instant.now(), CorrelationIdFilter.correlationId(request));
    }

    public void write(HttpServletRequest request, HttpServletResponse response, int status, String code, String message)
            throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        mapper.writeValue(response.getOutputStream(), of(request, status, code, message, Map.of()));
    }
}
