package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.UserAvatar3d;
import br.com.fashionai.domain.repository.UserAvatar3dRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.awt.image.BufferedImage;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * RF40 — Meu Avatar 3D. O rosto é reconstruído no navegador (lib/avatar3d); aqui só chega o resultado: a forma em pose
 * neutra (468 pontos), pele e cabelo medidos, avisos da qualidade e o atlas do rosto (textura). Regras:
 * <ul>
 *   <li>consentimento explícito obrigatório (dado biométrico, LGPD art. 11): sem ele nada é gravado;</li>
 *   <li>a textura fica em {@code restricted/} (o proxy de mídia só a entrega a ADMIN) e sai por
 *       {@link #texture}: para o dono sempre, para os outros só se ele deixou o avatar público na Passarela;</li>
 *   <li>o modelo é validado com as mesmas regras do cliente (lib/avatar3d/model.ts): nada de NaN ou tamanho errado
 *       quebrando a cena de outra pessoa;</li>
 *   <li>excluir apaga o registro e a textura; a exclusão da conta faz o mesmo.</li>
 * </ul>
 */
@Service
public class Avatar3dService {
    static final int MODEL_VERSION = 1;
    static final int SHAPE_LEN = 468 * 3;
    private static final Pattern HEX = Pattern.compile("^#[0-9a-fA-F]{6}$");
    private static final long MAX_TEXTURE_BYTES = 4L * 1024 * 1024;
    /** Ajustes finos: faixas pequenas de propósito (ajuste, não outra pessoa). Iguais a ADJUST_RANGE do cliente. */
    private static final Map<String, double[]> ADJUST = Map.of(
            "headScale", new double[]{0.94, 1.06, 1}, "neck", new double[]{-0.02, 0.02, 0},
            "hairVolume", new double[]{0.6, 1.6, 1}, "skinLight", new double[]{-0.08, 0.08, 0});

    private final UserAvatar3dRepository avatars;
    private final UserRepository users;
    private final MediaStoragePort storage;
    private final Audit audit;

    public Avatar3dService(UserAvatar3dRepository avatars, UserRepository users, MediaStoragePort storage, Audit audit) {
        this.avatars = avatars;
        this.users = users;
        this.storage = storage;
        this.audit = audit;
    }

    /** O que o cliente envia junto com a textura (parte "meta" do multipart). */
    public record SaveCommand(Map<String, Object> model, Map<String, Object> adjust, Integer photos, List<String> warnings,
                              Boolean consent, Boolean publicOnRunway) {
    }

    public record SettingsCommand(Map<String, Object> adjust, Boolean publicOnRunway, Map<String, Object> body) {
    }

    @Transactional(readOnly = true)
    public Map<String, Object> get(CurrentUser user) {
        return avatars.findByUserId(user.id()).map(this::view).orElseGet(() -> Map.of("exists", false));
    }

    @Transactional
    public Map<String, Object> save(CurrentUser user, SaveCommand cmd, byte[] texture) {
        if (cmd == null || !Boolean.TRUE.equals(cmd.consent())) {
            throw ApiException.badRequest("CONSENTIMENTO_OBRIGATORIO", Msg.t("avatar3d.consentimento_obrigatorio"));
        }
        Map<String, Object> model = validateModel(cmd.model());
        byte[] jpeg = normalizeTexture(texture);
        User u = users.findById(user.id()).orElseThrow(() -> ApiException.notFound(Msg.t("common.usuario")));
        UserAvatar3d a = avatars.findByUserId(u.getId()).orElseGet(() -> {
            UserAvatar3d n = new UserAvatar3d();
            n.setUser(u);
            return n;
        });
        String oldKey = a.getTextureKey();
        String key = "restricted/users/" + u.getId() + "/avatar3d/face-" + System.currentTimeMillis() + ".jpg";
        storage.put(key, jpeg, "image/jpeg");
        a.setModelVersion(MODEL_VERSION);
        a.setModelJson(Json.write(model));
        a.setAdjustJson(Json.write(clampAdjust(cmd.adjust())));
        a.setTextureKey(key);
        a.setPhotosCount(cmd.photos() == null ? 1 : Math.max(1, Math.min(3, cmd.photos())));
        a.setWarningsJson(Json.write(cmd.warnings() == null ? List.of() : cmd.warnings().stream().limit(20)
                .map(w -> w == null ? "" : w.replaceAll("[^A-Z0-9_]", "")).filter(w -> !w.isEmpty()).toList()));
        if (cmd.publicOnRunway() != null) {
            a.setPublicOnRunway(cmd.publicOnRunway());
        }
        a.setConsentAt(Instant.now());
        avatars.save(a);
        if (oldKey != null && !oldKey.equals(key)) {
            deleteQuietly(oldKey);
        }
        audit.log(user, "AVATAR3D_SALVO", "avatar3d:" + u.getId(), Map.of("photos", a.getPhotosCount()));
        return view(a);
    }

    @Transactional
    public Map<String, Object> update(CurrentUser user, SettingsCommand cmd) {
        UserAvatar3d a = avatars.findByUserId(user.id()).orElseThrow(() -> ApiException.notFound(Msg.t("avatar3d.avatar")));
        if (cmd != null && cmd.adjust() != null) {
            a.setAdjustJson(Json.write(clampAdjust(cmd.adjust())));
        }
        if (cmd != null && cmd.publicOnRunway() != null) {
            a.setPublicOnRunway(cmd.publicOnRunway());
        }
        if (cmd != null && cmd.body() != null) {
            // corpo: proporções com a origem de cada uma (foto, pessoa, estimativa); vai junto do modelo do rosto
            Map<String, Object> model = new LinkedHashMap<>(Json.map(a.getModelJson()));
            if (cmd.body().isEmpty()) {
                model.remove("body");
            } else {
                model.put("body", validateBody(cmd.body()));
            }
            a.setModelJson(Json.write(model));
            audit.log(user, "AVATAR3D_CORPO", "avatar3d:" + user.id(), Map.of("photo", Boolean.TRUE.equals(model.get("body") instanceof Map<?, ?> b ? b.get("photo") : null)));
        }
        avatars.save(a);
        return view(a);
    }

    @Transactional
    public void delete(CurrentUser user) {
        avatars.findByUserId(user.id()).ifPresent(a -> {
            deleteQuietly(a.getTextureKey());
            avatars.delete(a);
            audit.log(user, "AVATAR3D_EXCLUIDO", "avatar3d:" + user.id(), Map.of());
        });
    }

    /** Exclusão da conta: some com o avatar e a textura, sem usuário logado. */
    @Transactional
    public void deleteAllFor(UUID userId) {
        avatars.findByUserId(userId).ifPresent(a -> {
            deleteQuietly(a.getTextureKey());
            avatars.delete(a);
        });
    }

    /** Textura do rosto: o dono sempre; outra pessoa só se o avatar for público. Senão, 404 (não revela que existe). */
    @Transactional(readOnly = true)
    public byte[] texture(CurrentUser viewer, UUID ownerId) {
        UserAvatar3d a = avatars.findByUserId(ownerId).orElseThrow(() -> ApiException.notFound(Msg.t("avatar3d.avatar")));
        boolean owner = viewer != null && viewer.id().equals(ownerId);
        if (!owner && !a.isPublicOnRunway()) {
            throw ApiException.notFound(Msg.t("avatar3d.avatar"));
        }
        return storage.get(a.getTextureKey());
    }

    /** Referência do avatar para o manequim (look3d, Passarela, Quarto, Espelho), ou vazio quando quem vê não pode. */
    @Transactional(readOnly = true)
    public Optional<Map<String, Object>> forMannequin(UUID ownerId, UUID viewerId) {
        return avatars.findByUserId(ownerId)
                .filter(a -> a.isPublicOnRunway() || ownerId.equals(viewerId))
                .map(a -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("version", a.getUpdatedAt() == null ? 0 : a.getUpdatedAt().toEpochMilli());
                    m.put("model", Json.map(a.getModelJson()));
                    m.put("adjust", a.getAdjustJson() == null ? Map.of() : Json.map(a.getAdjustJson()));
                    m.put("textureUrl", textureUrl(a));
                    return m;
                });
    }

    private Map<String, Object> view(UserAvatar3d a) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("exists", true);
        m.put("model", Json.map(a.getModelJson()));
        m.put("adjust", a.getAdjustJson() == null ? Map.of() : Json.map(a.getAdjustJson()));
        m.put("textureUrl", textureUrl(a));
        m.put("photos", a.getPhotosCount());
        m.put("warnings", a.getWarningsJson() == null ? List.of() : Json.strings(a.getWarningsJson()));
        m.put("publicOnRunway", a.isPublicOnRunway());
        m.put("consentAt", a.getConsentAt());
        m.put("updatedAt", a.getUpdatedAt());
        return m;
    }

    private static String textureUrl(UserAvatar3d a) {
        long v = a.getUpdatedAt() == null ? 0 : a.getUpdatedAt().toEpochMilli();
        return "/api/avatar3d/" + a.getUser().getId() + "/texture?v=" + v;
    }

    private void deleteQuietly(String key) {
        if (key == null) {
            return;
        }
        try {
            storage.delete(key);
        } catch (RuntimeException ignored) {
            // objeto já ausente: nada a fazer
        }
    }

    /** Mesmas regras de validateModel (lib/avatar3d/model.ts). Devolve só os campos conhecidos. */
    static Map<String, Object> validateModel(Map<String, Object> m) {
        ApiException invalid = ApiException.badRequest("MODELO_INVALIDO", Msg.t("avatar3d.modelo_invalido"));
        if (m == null || !(m.get("v") instanceof Number v) || v.intValue() != MODEL_VERSION) {
            throw invalid;
        }
        if (!(m.get("shape") instanceof List<?> shape) || shape.size() != SHAPE_LEN) {
            throw invalid;
        }
        for (Object o : shape) {
            if (!(o instanceof Number n) || !Double.isFinite(n.doubleValue()) || Math.abs(n.doubleValue()) >= 40) {
                throw invalid;
            }
        }
        if (!(m.get("skin") instanceof String skin) || !HEX.matcher(skin).matches()) {
            throw invalid;
        }
        if (!(m.get("hair") instanceof Map<?, ?> hair)) {
            throw invalid;
        }
        Object color = hair.get("color");
        if (color != null && !(color instanceof String c && HEX.matcher(c).matches())) {
            throw invalid;
        }
        for (String k : List.of("top", "side", "fringe")) {
            if (!(hair.get(k) instanceof Number n) || !Double.isFinite(n.doubleValue())) {
                throw invalid;
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        if (m.get("body") instanceof Map<?, ?> body) {
            @SuppressWarnings("unchecked") Map<String, Object> b = (Map<String, Object>) body;
            out.put("body", validateBody(b));
        }
        for (String k : List.of("v", "shape", "skin", "hair", "metrics", "views", "warnings")) {
            if (m.containsKey(k)) {
                out.put(k, m.get(k));
            }
        }
        return out;
    }

    /** Faixas plausíveis de cada proporção do corpo (as mesmas de lib/avatar3d/body-spec.ts, BODY_RANGE). */
    static final Map<String, double[]> BODY_RANGE = Map.of(
            "stature", new double[]{1.2, 2.2}, "shoulderW", new double[]{0.15, 0.26}, "chestW", new double[]{0.13, 0.26},
            "waistW", new double[]{0.11, 0.26}, "hipW", new double[]{0.15, 0.27}, "legLen", new double[]{0.46, 0.58},
            "armLen", new double[]{0.29, 0.38}, "headH", new double[]{0.11, 0.155}, "build", new double[]{-1.5, 2});
    /**
     * Profundidades do tronco (frente → costas): só existem quando uma foto de perfil as mediu ou a pessoa as
     * ajustou. Ausentes, o corpo é o mesmo de antes (a profundidade sai da largura) — por isso são opcionais aqui,
     * e corpos salvos antes desta versão continuam válidos.
     */
    static final Map<String, double[]> BODY_DEPTH_RANGE = Map.of(
            "chestD", new double[]{0.08, 0.22}, "waistD", new double[]{0.07, 0.24}, "hipD", new double[]{0.08, 0.24});
    static final List<String> BODY_SOURCES = List.of("observed", "user", "estimated", "default");

    /**
     * Corpo do avatar: só números finitos dentro das faixas, uma origem conhecida por proporção, altura e peso
     * informados dentro de limites humanos. Devolve só os campos conhecidos (nada de texto livre).
     */
    static Map<String, Object> validateBody(Map<String, Object> b) {
        ApiException invalid = ApiException.badRequest("CORPO_INVALIDO", Msg.t("avatar3d.corpo_invalido"));
        if (b == null || !(b.get("v") instanceof Number v) || v.intValue() != 1) {
            throw invalid;
        }
        if (!"FEMININO".equals(b.get("sex")) && !"MASCULINO".equals(b.get("sex"))) {
            throw invalid;
        }
        if (!(b.get("params") instanceof Map<?, ?> params) || !(b.get("sources") instanceof Map<?, ?> sources)) {
            throw invalid;
        }
        Map<String, Object> p = new LinkedHashMap<>(), src = new LinkedHashMap<>();
        for (Map.Entry<String, double[]> e : BODY_RANGE.entrySet()) {
            Object n = params.get(e.getKey());
            if (!(n instanceof Number num) || !Double.isFinite(num.doubleValue()) || num.doubleValue() < e.getValue()[0] || num.doubleValue() > e.getValue()[1]) {
                throw invalid;
            }
            Object sv = sources.get(e.getKey());
            if (!(sv instanceof String so) || !BODY_SOURCES.contains(so)) {
                throw invalid;
            }
            p.put(e.getKey(), num.doubleValue());
            src.put(e.getKey(), so);
        }
        // profundidades: opcionais, mas quando vêm precisam do valor na faixa E da origem, como qualquer medida
        for (Map.Entry<String, double[]> e : BODY_DEPTH_RANGE.entrySet()) {
            Object n = params.get(e.getKey()), sv = sources.get(e.getKey());
            if (n == null && sv == null) {
                continue;
            }
            if (!(n instanceof Number num) || !Double.isFinite(num.doubleValue()) || num.doubleValue() < e.getValue()[0] || num.doubleValue() > e.getValue()[1]
                    || !(sv instanceof String so) || !BODY_SOURCES.contains(so)) {
                throw invalid;
            }
            p.put(e.getKey(), num.doubleValue());
            src.put(e.getKey(), so);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("v", 1);
        out.put("sex", b.get("sex"));
        out.put("params", p);
        out.put("sources", src);
        out.put("heightCm", bounded(b.get("heightCm"), 120, 220));
        out.put("weightKg", bounded(b.get("weightKg"), 30, 250));
        out.put("photo", Boolean.TRUE.equals(b.get("photo")));
        out.put("warnings", b.get("warnings") instanceof List<?> w ? w.stream().limit(20).map(String::valueOf)
                .map(x -> x.replaceAll("[^A-Za-z0-9_]", "")).filter(x -> !x.isEmpty()).toList() : List.of());
        return out;
    }

    private static Double bounded(Object o, double lo, double hi) {
        if (o == null) {
            return null;
        }
        if (!(o instanceof Number n) || !Double.isFinite(n.doubleValue()) || n.doubleValue() < lo || n.doubleValue() > hi) {
            throw ApiException.badRequest("CORPO_INVALIDO", Msg.t("avatar3d.corpo_invalido"));
        }
        return n.doubleValue();
    }

    static Map<String, Object> clampAdjust(Map<String, Object> a) {
        Map<String, Object> out = new LinkedHashMap<>();
        ADJUST.forEach((k, r) -> {
            Object v = a == null ? null : a.get(k);
            double d = v instanceof Number n && Double.isFinite(n.doubleValue()) ? Math.min(r[1], Math.max(r[0], n.doubleValue())) : r[2];
            out.put(k, d);
        });
        return out;
    }

    /** Atlas do rosto: imagem quadrada entre 256 e 2048 px, regravada em JPEG (sem metadados). */
    static byte[] normalizeTexture(byte[] bytes) {
        if (bytes == null || bytes.length == 0 || bytes.length > MAX_TEXTURE_BYTES) {
            throw ApiException.badRequest("TEXTURA_INVALIDA", Msg.t("avatar3d.textura_invalida"));
        }
        ImageOps.requireAcceptedImage(bytes);
        BufferedImage img = ImageOps.decode(bytes);
        if (img.getWidth() != img.getHeight() || img.getWidth() < 256 || img.getWidth() > 2048) {
            throw ApiException.badRequest("TEXTURA_INVALIDA", Msg.t("avatar3d.textura_invalida"));
        }
        return ImageOps.jpeg(img, 0.9f);
    }
}
