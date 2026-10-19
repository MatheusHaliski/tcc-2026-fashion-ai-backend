package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.ports.RateLimitPort;
import br.com.fashionai.application.ports.StylizedPortraitPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.io.ByteArrayInputStream;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.Arrays;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Meu Avatar — retrato estilizado com GPU: a foto do rosto vai ao SDXL + InstantID (worker privado → T4 no Vertex) e
 * volta um desenho 3D semirrealista da pessoa, com a semelhança medida pelo ArcFace (cosseno entre foto e retrato).
 * Regras:
 * <ul>
 *   <li>consentimento explícito a cada envio (dado biométrico, LGPD art. 11);</li>
 *   <li>a foto passa pela moderação de uploads, é regravada em JPEG sem metadados, na orientação certa e com até
 *       {@value #MAX_SIDE} px, e só existe em memória: não é gravada aqui, no worker nem no Vertex;</li>
 *   <li>o retrato também não é gravado: volta para a tela, que mostra e deixa baixar;</li>
 *   <li>o retrato só passa se for um JPEG que decodifica no tamanho anunciado e com a semelhança válida;</li>
 *   <li>limite por pessoa (a GPU é uma só e o retrato leva cerca de um minuto) e auditoria sem a imagem.</li>
 * </ul>
 */
@Service
public class AvatarPortraitService {
    static final int MAX_SIDE = 1536;
    static final int HOURLY_LIMIT = 4;
    static final int MAX_PORTRAIT_BYTES = 3_000_000;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final StylizedPortraitPort gpu;
    private final RateLimitPort rateLimit;
    private final Audit audit;
    private final Guard guard;

    public AvatarPortraitService(StylizedPortraitPort gpu, RateLimitPort rateLimit, Audit audit, Guard guard) {
        this.gpu = gpu;
        this.rateLimit = rateLimit;
        this.audit = audit;
        this.guard = guard;
    }

    /** {@code seed} nulo sorteia outro retrato; o mesmo seed com a mesma foto repete o resultado. */
    public Map<String, Object> generate(CurrentUser user, byte[] photo, boolean consent, Integer seed) {
        guard.requireCanCreate(user);
        if (!consent) {
            throw ApiException.badRequest("CONSENTIMENTO_OBRIGATORIO", Msg.t("avatar3d.retrato_gpu.consentimento"));
        }
        if (seed != null && seed < 0) {
            throw ApiException.badRequest("SEED_INVALIDO", Msg.t("avatar3d.retrato_gpu.invalido"));
        }
        byte[] jpeg = normalized(photo);
        if (!gpu.available()) {
            throw new ApiException(503, "RETRATO_GPU_INDISPONIVEL", Msg.t("avatar3d.retrato_gpu.indisponivel"));
        }
        if (!rateLimit.tryAcquire(user.id(), "avatar-portrait", HOURLY_LIMIT, Duration.ofHours(1))) {
            throw new ApiException(429, "RETRATO_GPU_LIMITE", Msg.t("avatar3d.retrato_gpu.limite", HOURLY_LIMIT));
        }
        int chosen = seed != null ? seed : RANDOM.nextInt(Integer.MAX_VALUE);
        Map<String, Object> result;
        try {
            result = gpu.stylizedPortrait(jpeg, chosen);
        } catch (ApiException e) {
            // o worker devolve só o código do motivo (ex.: MULTIPLE_FACES_REJECTED) em details.reason: a tela explica
            if ("VTON_WORKER_REJECTED".equals(e.code())) {
                throw new ApiException(e.status(), "RETRATO_GPU_RECUSADO", Msg.t("avatar3d.retrato_gpu.recusado"), e.details());
            }
            throw e;
        } finally {
            Arrays.fill(jpeg, (byte) 0);
        }
        Map<String, Object> portrait = checked(result);
        audit.log(user, "AVATAR3D_RETRATO_GPU", "avatar3d:" + user.id(), Map.of("largura", portrait.get("width"), "altura", portrait.get("height")));
        portrait.put("seed", chosen);
        return portrait;
    }

    /** Só um JPEG que decodifica no tamanho anunciado e uma semelhança válida chegam à tela; o resto vira erro. */
    static Map<String, Object> checked(Map<String, Object> result) {
        if (result == null || !"READY".equals(result.get("status"))) {
            throw invalid();
        }
        byte[] image;
        try {
            image = Base64.getDecoder().decode(String.valueOf(result.get("image_jpeg")));
        } catch (IllegalArgumentException e) {
            throw invalid();
        }
        if (image.length < 4 || image.length > MAX_PORTRAIT_BYTES || (image[0] & 0xFF) != 0xFF || (image[1] & 0xFF) != 0xD8
                || !(result.get("width") instanceof Number width) || !(result.get("height") instanceof Number height)
                || !(result.get("identitySimilarity") instanceof Number similarity)
                || !Double.isFinite(similarity.doubleValue()) || Math.abs(similarity.doubleValue()) > 1) {
            throw invalid();
        }
        try {
            var decoded = ImageIO.read(new ByteArrayInputStream(image));
            if (decoded == null || decoded.getWidth() != width.intValue() || decoded.getHeight() != height.intValue()) {
                throw invalid();
            }
        } catch (java.io.IOException e) {
            throw invalid();
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("status", "READY");
        out.put("image", "data:image/jpeg;base64," + Base64.getEncoder().encodeToString(image));
        out.put("width", width.intValue());
        out.put("height", height.intValue());
        out.put("identitySimilarity", Math.round(similarity.doubleValue() * 1000) / 1000.0);
        out.put("identityMetric", "ARCFACE_GLINTR100_COSINE");
        out.put("style", "semi_realistic");
        out.put("engine", "SDXL_INSTANTID_STYLIZED_PORTRAIT");
        out.put("photoStored", false);
        out.put("portraitStored", false);
        return out;
    }

    private static ApiException invalid() {
        return new ApiException(502, "RETRATO_GPU_INVALIDO", Msg.t("avatar3d.retrato_gpu.invalido"));
    }

    /** JPEG novo, sem metadados, na orientação da foto e com até MAX_SIDE px: o que a GPU aceita, nada além. */
    static byte[] normalized(byte[] photo) {
        ImageOps.requireAcceptedImage(photo);
        var image = ImageOps.scaleToFit(ImageOps.decode(photo), MAX_SIDE, MAX_SIDE);
        if (image.getWidth() < 256 || image.getHeight() < 256) {
            throw ApiException.badRequest("FOTO_PEQUENA", Msg.t("avatar3d.retrato_gpu.foto_pequena"));
        }
        return ImageOps.jpeg(image, 0.92f);
    }
}
