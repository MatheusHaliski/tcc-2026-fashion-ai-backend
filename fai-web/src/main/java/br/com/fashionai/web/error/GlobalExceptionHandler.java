package br.com.fashionai.web.error;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.common.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.HttpMediaTypeNotAcceptableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Traduz toda falha em {@link ApiError} (RNF7/RNF8): a UI nunca recebe stack trace nem HTML de erro,
 * só um código estável e uma mensagem que pode ser mostrada ao usuário.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ApiError> api(ApiException ex, HttpServletRequest req) {
        return respond(req, ex.status(), ex.code(), ex.getMessage(), ex.details());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> invalid(MethodArgumentNotValidException ex, HttpServletRequest req) {
        Map<String, Object> fields = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(f -> fields.putIfAbsent(f.getField(), f.getDefaultMessage()));
        return respond(req, 422, "VALIDACAO", Msg.t("globalExceptionHandler.revise_os_campos_destacados"), Map.of("fields", fields));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    ResponseEntity<ApiError> constraint(ConstraintViolationException ex, HttpServletRequest req) {
        Map<String, Object> fields = new LinkedHashMap<>();
        ex.getConstraintViolations().forEach(v -> fields.putIfAbsent(v.getPropertyPath().toString(), v.getMessage()));
        return respond(req, 422, "VALIDACAO", Msg.t("globalExceptionHandler.revise_os_campos_destacados"), Map.of("fields", fields));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ApiError> unreadable(HttpMessageNotReadableException ex, HttpServletRequest req) {
        return respond(req, 400, "JSON_INVALIDO", Msg.t("error.corpo_da_requisicao_nao_e"), Map.of());
    }

    @ExceptionHandler({MethodArgumentTypeMismatchException.class, MissingServletRequestParameterException.class,
            MissingServletRequestPartException.class})
    ResponseEntity<ApiError> badParam(Exception ex, HttpServletRequest req) {
        String name = ex instanceof MethodArgumentTypeMismatchException m ? m.getName()
                : ex instanceof MissingServletRequestParameterException p ? p.getParameterName()
                : ((MissingServletRequestPartException) ex).getRequestPartName();
        return respond(req, 400, "PARAMETRO_INVALIDO", Msg.t("globalExceptionHandler.parametro_ausente_ou_invalido", name), Map.of("parameter", name));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<ApiError> tooLarge(MaxUploadSizeExceededException ex, HttpServletRequest req) {
        return respond(req, 413, "ARQUIVO_GRANDE", Msg.t("globalExceptionHandler.o_arquivo_passa_do_limite"), Map.of());
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ResponseEntity<ApiError> method(HttpRequestMethodNotSupportedException ex, HttpServletRequest req) {
        return respond(req, 405, "METODO_NAO_SUPORTADO", Msg.t("globalExceptionHandler.operacao_nao_suportada_neste_endereco"), Map.of());
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    ResponseEntity<ApiError> mediaType(HttpMediaTypeNotSupportedException ex, HttpServletRequest req) {
        return respond(req, 415, "FORMATO_NAO_SUPORTADO", Msg.t("globalExceptionHandler.formato_de_conteudo_nao_suportado"), Map.of());
    }

    @ExceptionHandler(HttpMediaTypeNotAcceptableException.class)
    ResponseEntity<ApiError> notAcceptable(HttpMediaTypeNotAcceptableException ex, HttpServletRequest req) {
        return respond(req, 406, "FORMATO_NAO_ACEITO", Msg.t("globalExceptionHandler.este_endereco_devolve_imagem_peca"), Map.of());
    }

    @ExceptionHandler(NoResourceFoundException.class)
    ResponseEntity<ApiError> noResource(NoResourceFoundException ex, HttpServletRequest req) {
        return respond(req, 404, "NAO_ENCONTRADO", Msg.t("globalExceptionHandler.endereco_nao_encontrado"), Map.of());
    }

    @ExceptionHandler(OptimisticLockingFailureException.class)
    ResponseEntity<ApiError> concurrent(OptimisticLockingFailureException ex, HttpServletRequest req) {
        return respond(req, 409, "EDICAO_CONCORRENTE", Msg.t("globalExceptionHandler.este_conteudo_foi_alterado_em"), Map.of());
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ApiError> integrity(DataIntegrityViolationException ex, HttpServletRequest req) {
        log.warn("Violação de integridade em {}: {}", req.getRequestURI(), ex.getMostSpecificCause().getMessage());
        return respond(req, 409, "CONFLITO", Msg.t("globalExceptionHandler.esta_acao_conflita_com_um"), Map.of());
    }

    /** Negações de @PreAuthorize seguem para o AccessDeniedHandler auditado da cadeia de segurança. */
    @ExceptionHandler(AccessDeniedException.class)
    void accessDenied(AccessDeniedException ex) {
        throw ex;
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> unexpected(Exception ex, HttpServletRequest req) {
        log.error("Erro inesperado em {} {}", req.getMethod(), req.getRequestURI(), ex);
        return respond(req, 500, "ERRO_INTERNO",
                Msg.t("globalExceptionHandler.algo_deu_errado_do_nosso"), Map.of());
    }

    private static ResponseEntity<ApiError> respond(HttpServletRequest req, int status, String code, String message,
                                                    Map<String, Object> details) {
        return ResponseEntity.status(status).body(ErrorWriter.of(req, status, code, message, details));
    }
}
