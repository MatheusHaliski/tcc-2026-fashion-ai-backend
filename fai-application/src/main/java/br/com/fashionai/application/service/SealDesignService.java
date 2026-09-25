package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.seal.SealDesigns;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * RF25 — upload de selo pronto. Aceito apenas quando respeita as proporções do logo FashionAI: quadrado (1:1,
 * tolerância de 3 %), conteúdo circular (cantos transparentes ou lisos) e entre 256 e 4096 px. A imagem é
 * recortada ao centro em 1:1 e salva em 512 × 512 PNG (preserva transparência fora do círculo).
 */
@Service
public class SealDesignService {
    private final MediaStoragePort media;
    private final UserRepository users;

    public SealDesignService(MediaStoragePort media, UserRepository users) {
        this.media = media;
        this.users = users;
    }

    public Map<String, Object> catalog() {
        return SealDesigns.catalog();
    }

    public Map<String, Object> upload(CurrentUser user, byte[] bytes) {
        User owner = users.findById(user.id()).orElseThrow();
        if (owner.getProfileType() != ProfileType.MARCA && owner.getProfileType() != ProfileType.CELEBRIDADE) {
            throw ApiException.forbidden(Msg.t("sealDesign.so_perfis_de_marca_ou"));
        }
        ImageOps.requireAcceptedImage(bytes);
        BufferedImage img = ImageOps.toArgb(ImageOps.decode(bytes));
        int w = img.getWidth();
        int h = img.getHeight();
        double tolerance = (double) SealDesigns.GEOMETRY.get("uploadRatioTolerance");
        int minPx = (int) SealDesigns.GEOMETRY.get("uploadMinPx");
        int maxPx = (int) SealDesigns.GEOMETRY.get("uploadMaxPx");
        double ratio = w / (double) h;
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("width", w);
        details.put("height", h);
        details.put("ratio", Math.round(ratio * 1000) / 1000.0);
        if (Math.abs(ratio - 1.0) > tolerance) {
            throw ApiException.badRequest("SELO_PROPORCAO_INVALIDA",
                    Msg.t("sealDesign.o_selo_precisa_ser_quadrado"), details);
        }
        if (Math.min(w, h) < minPx) {
            throw ApiException.badRequest("SELO_PEQUENO", Msg.t("sealDesign.o_selo_precisa_ter_ao", minPx, minPx), details);
        }
        if (Math.max(w, h) > maxPx) {
            throw ApiException.badRequest("SELO_GRANDE", Msg.t("sealDesign.o_selo_pode_ter_no", maxPx, maxPx), details);
        }
        int side = Math.min(w, h);
        BufferedImage square = img.getSubimage((w - side) / 2, (h - side) / 2, side, side);
        int out = (int) SealDesigns.GEOMETRY.get("uploadOutputPx");
        BufferedImage scaled = new BufferedImage(out, out, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = scaled.createGraphics();
        ImageOps.quality(g);
        g.drawImage(square, 0, 0, out, out, null);
        g.dispose();
        boolean circular = cornersClear(scaled);
        String key = "users/" + user.id() + "/seals/upload-" + UUID.randomUUID() + ".png";
        MediaStoragePort.StoredObject stored = media.put(key, ImageOps.png(scaled), "image/png");
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("url", stored.url());
        result.put("width", out);
        result.put("height", out);
        result.put("sourceSize", w + "x" + h);
        result.put("circular", circular);
        result.put("warning", circular ? null
                : Msg.t("sealDesign.os_cantos_da_imagem_nao"));
        return result;
    }

    /** Heurística de "conteúdo circular": os quatro cantos (fora do círculo inscrito) são transparentes ou quase. */
    static boolean cornersClear(BufferedImage img) {
        int n = img.getWidth();
        int pad = Math.max(2, n / 32);
        int[][] corners = {{pad, pad}, {n - 1 - pad, pad}, {pad, n - 1 - pad}, {n - 1 - pad, n - 1 - pad}};
        int clear = 0;
        for (int[] c : corners) {
            int argb = img.getRGB(c[0], c[1]);
            int alpha = (argb >>> 24) & 0xFF;
            if (alpha < 40) {
                clear++;
            }
        }
        return clear == 4;
    }
}
