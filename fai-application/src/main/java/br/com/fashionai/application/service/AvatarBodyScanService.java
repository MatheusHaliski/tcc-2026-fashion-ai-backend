package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.ports.BodyMeasurementPort;
import br.com.fashionai.application.ports.RateLimitPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Avatar 3D mais fiel com GPU: uma foto de corpo inteiro vai ao SAM 3D Body (worker privado → T4 no Vertex) e voltam só
 * as proporções do corpo, que o app aplica no editor como medidas da foto ({@code observed}). Regras:
 * <ul>
 *   <li>consentimento explícito a cada envio (dado biométrico, LGPD art. 11);</li>
 *   <li>a foto passa pela moderação de uploads como qualquer foto de pessoa, é regravada em JPEG sem metadados (GPS,
 *       aparelho), na orientação certa e com até {@value #MAX_SIDE} px, e só existe em memória: não é gravada aqui,
 *       no worker nem no Vertex;</li>
 *   <li>só proporções dentro das faixas do corpo do avatar ({@link Avatar3dBodyRules#BODY_RANGE}) voltam; o resto vira
 *       recusa com o motivo, nada é "corrigido";</li>
 *   <li>limite por pessoa (a GPU é uma só) e auditoria sem nenhuma medida.</li>
 * </ul>
 */
@Service
public class AvatarBodyScanService {
    /** Proporções (fração da estatura) que a GPU mede: as mesmas chaves de BodyParams em lib/avatar3d/body-spec.ts. */
    static final List<String> RATIOS = List.of("shoulderW", "chestW", "waistW", "hipW", "legLen", "armLen", "chestD", "waistD", "hipD");
    static final int MAX_SIDE = 1536;
    static final int HOURLY_LIMIT = 6;
    private static final Pattern CODE = Pattern.compile("[A-Z][A-Z0-9_]{2,63}");
    private static final Pattern REVISION = Pattern.compile("[0-9a-f]{40}");

    private final BodyMeasurementPort gpu;
    private final RateLimitPort rateLimit;
    private final Audit audit;
    private final Guard guard;

    public AvatarBodyScanService(BodyMeasurementPort gpu, RateLimitPort rateLimit, Audit audit, Guard guard) {
        this.gpu = gpu;
        this.rateLimit = rateLimit;
        this.audit = audit;
        this.guard = guard;
    }

    public Map<String, Object> measure(CurrentUser user, byte[] photo, boolean consent) {
        guard.requireCanCreate(user);
        if (!consent) {
            throw ApiException.badRequest("CONSENTIMENTO_OBRIGATORIO", Msg.t("avatar3d.medida_gpu.consentimento"));
        }
        byte[] jpeg = normalized(photo);
        if (!gpu.available()) {
            throw new ApiException(503, "MEDIDA_GPU_INDISPONIVEL", Msg.t("avatar3d.medida_gpu.indisponivel"));
        }
        if (!rateLimit.tryAcquire(user.id(), "avatar-body-scan", HOURLY_LIMIT, Duration.ofHours(1))) {
            throw new ApiException(429, "MEDIDA_GPU_LIMITE", Msg.t("avatar3d.medida_gpu.limite", HOURLY_LIMIT));
        }
        Map<String, Object> result;
        try {
            result = gpu.measureBody(jpeg);
        } catch (ApiException e) {
            // o worker devolve só o código do motivo (ex.: FULL_BODY_NOT_VISIBLE) em details.reason: a tela explica
            if ("VTON_WORKER_REJECTED".equals(e.code())) {
                throw new ApiException(e.status(), "MEDIDA_GPU_RECUSADA", Msg.t("avatar3d.medida_gpu.recusada"), e.details());
            }
            throw e;
        } finally {
            Arrays.fill(jpeg, (byte) 0);
        }
        if (result == null || !"READY".equals(result.get("status"))) {
            throw new ApiException(502, "MEDIDA_GPU_INVALIDA", Msg.t("avatar3d.medida_gpu.recusada"));
        }
        Map<String, Object> ratios = new LinkedHashMap<>();
        Map<String, Object> refused = new LinkedHashMap<>();
        Map<?, ?> measured = result.get("ratios") instanceof Map<?, ?> m ? m : Map.of();
        Map<?, ?> rejected = result.get("refused") instanceof Map<?, ?> r ? r : Map.of();
        for (String key : RATIOS) {
            double[] range = Avatar3dBodyRules.BODY_RANGE.getOrDefault(key, Avatar3dBodyRules.BODY_DEPTH_RANGE.get(key));
            Object value = measured.get(key);
            if (value instanceof Number n && Double.isFinite(n.doubleValue()) && n.doubleValue() >= range[0] && n.doubleValue() <= range[1]) {
                ratios.put(key, n.doubleValue());
            } else if (value != null) {
                refused.put(key, "OUT_OF_ADULT_RANGE");
            } else if (rejected.get(key) instanceof String code && CODE.matcher(code).matches()) {
                refused.put(key, code);
            }
        }
        List<String> warnings = result.get("warnings") instanceof List<?> w ? w.stream().filter(String.class::isInstance)
                .map(String.class::cast).filter(c -> CODE.matcher(c).matches()).distinct().limit(10).toList() : List.of();
        audit.log(user, "AVATAR3D_MEDIDA_GPU", "avatar3d:" + user.id(),
                Map.of("medidas", ratios.size(), "recusadas", List.copyOf(refused.keySet()), "avisos", warnings));
        if (ratios.isEmpty()) {
            throw new ApiException(422, "MEDIDA_GPU_SEM_MEDIDAS", Msg.t("avatar3d.medida_gpu.sem_medidas"), Map.of("refused", refused));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("status", "READY");
        out.put("ratios", ratios);
        out.put("refused", refused);
        out.put("warnings", warnings);
        out.put("source", "observed");
        out.put("engine", "SAM_3D_BODY_DINOV3");
        if (result.get("diagnostics") instanceof Map<?, ?> d && d.get("modelRevision") instanceof String rev && REVISION.matcher(rev).matches()) {
            out.put("modelRevision", rev);
        }
        out.put("photoStored", false);
        return out;
    }

    /** JPEG novo, sem metadados, na orientação da foto e com até MAX_SIDE px: o que a GPU aceita, nada além. */
    static byte[] normalized(byte[] photo) {
        ImageOps.requireAcceptedImage(photo);
        var image = ImageOps.scaleToFit(ImageOps.decode(photo), MAX_SIDE, MAX_SIDE);
        if (image.getWidth() < 256 || image.getHeight() < 256) {
            throw ApiException.badRequest("FOTO_PEQUENA", Msg.t("avatar3d.medida_gpu.foto_pequena"));
        }
        return ImageOps.jpeg(image, 0.92f);
    }
}
