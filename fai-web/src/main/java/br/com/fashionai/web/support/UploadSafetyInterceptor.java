package br.com.fashionai.web.support;

import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Hashing;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.moderation.ImageSafety;
import br.com.fashionai.application.moderation.UploadQuarantine;
import br.com.fashionai.domain.model.enums.ModerationQueueStatus;
import br.com.fashionai.domain.repository.ModerationQueueRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.MultipartHttpServletRequest;
import org.springframework.web.servlet.HandlerInterceptor;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Moderação central das fotos enviadas (docs/seguranca/moderacao-de-imagens.md §4): toda requisição multipart da API
 * passa por aqui antes do controller, então nenhuma tela nova escapa da regra. Cada imagem recebe o veredito do
 * {@link ImageSafety}:
 * <ul>
 *   <li>ALLOW — segue para o fluxo normal;</li>
 *   <li>REVIEW — a foto não entra no fluxo: vai para a quarentena ({@code restricted/}) e para a fila do admin; a
 *       resposta é 422 {@code IMAGEM_EM_REVISAO} com a explicação para a pessoa;</li>
 *   <li>BLOCK — recusada (422 {@code IMAGEM_RECUSADA}); o arquivo não é guardado, só o registro de auditoria com o hash.</li>
 * </ul>
 */
@Component
public class UploadSafetyInterceptor implements HandlerInterceptor {
    private static final Logger log = LoggerFactory.getLogger(UploadSafetyInterceptor.class);
    /** Rotas que não recebem foto de pessoa enviada pela própria pessoa: textura do rosto gerada pelo app (já em restricted/). */
    private static final List<String> EXEMPT = List.of("/api/me/avatar3d");
    /** Itens pendentes por pessoa: acima disso a foto é recusada sem ir para a fila (evita encher a quarentena). */
    static final int MAX_PENDING = 20;
    /** Arquivos por requisição (o maior fluxo legítimo, a análise em lote de peças, aceita 12). */
    static final int MAX_FILE_PARTS = 12;

    private final ObjectProvider<ImageSafety> safety;
    private final ObjectProvider<UploadQuarantine> quarantine;
    private final ObjectProvider<ModerationQueueRepository> queue;
    private final ObjectProvider<Audit> audit;
    private final boolean enabled;

    public UploadSafetyInterceptor(ObjectProvider<ImageSafety> safety, ObjectProvider<UploadQuarantine> quarantine,
                                   ObjectProvider<ModerationQueueRepository> queue, ObjectProvider<Audit> audit,
                                   @Value("${fashionai.moderation.uploads-enabled:true}") boolean enabled) {
        this.safety = safety;
        this.quarantine = quarantine;
        this.queue = queue;
        this.audit = audit;
        this.enabled = enabled;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!(request instanceof MultipartHttpServletRequest multipart)) {
            return true;
        }
        // cada parte é decodificada abaixo (e de novo no fluxo): muitas partes numa requisição multiplicam o custo
        int parts = multipart.getMultiFileMap().values().stream().mapToInt(List::size).sum();
        if (parts > MAX_FILE_PARTS) {
            throw ApiException.badRequest("ARQUIVOS_DEMAIS", Msg.t("uploads.arquivos_demais", MAX_FILE_PARTS),
                    Map.of("max", MAX_FILE_PARTS));
        }
        ImageSafety checker = safety.getIfAvailable();
        if (!enabled || checker == null) {
            return true;
        }
        String path = RequestPaths.normalized(request);
        if (EXEMPT.stream().anyMatch(e -> path.equals(e) || path.startsWith(e + "/"))) {
            return true;
        }
        for (List<MultipartFile> files : multipart.getMultiFileMap().values()) {
            for (MultipartFile file : files) {
                if (file.isEmpty()) {
                    continue;
                }
                byte[] bytes;
                try {
                    bytes = file.getBytes();
                } catch (IOException ex) {
                    continue;                                 // o próprio fluxo recusa o arquivo ilegível
                }
                ImageSafety.Verdict v = checker.check(bytes);
                String type = file.getContentType() == null ? "" : file.getContentType().toLowerCase();
                if (type.startsWith("image/") && Boolean.FALSE.equals(v.signals().get("decodable"))) {
                    // imagem que o servidor não consegue ler também não pode ser conferida: não entra (ex.: HEIC)
                    throw ApiException.badRequest("FORMATO_INVALIDO", Msg.t("imageOps.formato_nao_aceito_use_jpg"));
                }
                if (v.decision() != ImageSafety.Decision.ALLOW) {
                    refuse(request, path, bytes, v);
                }
            }
        }
        return true;
    }

    private void refuse(HttpServletRequest request, String path, byte[] bytes, ImageSafety.Verdict v) {
        UUID userId = userId();
        String hash = Hashing.sha256(bytes);
        Map<String, Object> meta = Map.of("path", path, "engine", v.engine(), "signals", v.signals(), "sha256", hash);
        Audit a = audit.getIfAvailable();
        if (v.decision() == ImageSafety.Decision.BLOCK) {
            if (a != null) {
                a.log(userId == null ? "anonimo" : userId.toString(), "UPLOAD_RECUSADO_MODERACAO", path, "RECUSADO",
                        CorrelationIdFilter.clientIp(request), request.getHeader("User-Agent"), meta);
            }
            throw new ApiException(422, "IMAGEM_RECUSADA", Msg.t("imageSafety.recusada"), Map.of("reasons", v.reasons()));
        }
        UploadQuarantine q = quarantine.getIfAvailable();
        if (userId != null && q != null && pending(userId) < MAX_PENDING) {
            UUID item = q.hold(userId, bytes, path, v);
            if (a != null) {
                a.log(userId.toString(), "UPLOAD_RETIDO_MODERACAO", path, "PENDENTE", CorrelationIdFilter.clientIp(request),
                        request.getHeader("User-Agent"), Map.of("item", item.toString(), "engine", v.engine(), "sha256", hash));
            }
            log.info("Foto retida para revisão humana: item {} ({}, {})", item, path, v.engine());
            throw new ApiException(422, "IMAGEM_EM_REVISAO", Msg.t("imageSafety.em_revisao"), Map.of("reasons", v.reasons(), "reviewItem", item));
        }
        // sem conta (pré-cadastro) ou fila cheia: não guarda, pede outra foto
        throw new ApiException(422, "IMAGEM_NAO_ACEITA", Msg.t("imageSafety.envie_outra"), Map.of("reasons", v.reasons()));
    }

    private long pending(UUID userId) {
        ModerationQueueRepository r = queue.getIfAvailable();
        return r == null ? 0 : r.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .filter(i -> UploadQuarantine.TARGET.equals(i.getTargetType()) && i.getStatus() == ModerationQueueStatus.PENDING_REVIEW)
                .count();
    }

    private static UUID userId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (!(auth instanceof JwtAuthenticationToken token)) {
            return null;
        }
        String id = token.getToken().getClaimAsString("user_id");
        try {
            return UUID.fromString(id == null ? token.getToken().getSubject() : id);
        } catch (RuntimeException ex) {
            return null;
        }
    }
}
