package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.ai.AiRequest;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.avatar.IdentityQuality;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.AvatarIdentityVersion;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.UserAvatar3d;
import br.com.fashionai.domain.model.enums.IdentityStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.repository.AvatarIdentityVersionRepository;
import br.com.fashionai.domain.repository.UserAvatar3dRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.awt.image.BufferedImage;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * RF40 — Meu Avatar 3D. O rosto é reconstruído no navegador (lib/avatar3d); aqui só chega o resultado: a forma em pose
 * neutra (468 pontos), pele e cabelo medidos, avisos da qualidade, o relatório do gate de identidade (números
 * agregados) e o atlas do rosto (textura). Regras:
 * <ul>
 *   <li>consentimento explícito obrigatório (dado biométrico, LGPD art. 11): sem ele nada é gravado;</li>
 *   <li>a textura fica em {@code restricted/} (o proxy de mídia só a entrega a ADMIN) e sai por
 *       {@link #texture}: para o dono sempre, para os outros só se ele deixou o avatar público na Passarela <b>e</b> a
 *       textura passou pela moderação (a foto do rosto não passa pelo filtro de upload). A moderação só roda quando o
 *       avatar é público — rosto de avatar privado não sai para provedor externo; sem veredito, fica pendente;</li>
 *   <li>o modelo é validado com as mesmas regras do cliente (lib/avatar3d/model.ts): nada de NaN ou tamanho errado
 *       quebrando a cena de outra pessoa;</li>
 *   <li><b>identidade versionada</b> (AVATAR-ID I1): cada salvamento cria uma versão; a que passou no gate e foi
 *       confirmada é APPROVED; a que reprovou fica NEEDS_REFINEMENT (a pessoa vê com aviso, as outras pessoas continuam
 *       vendo a última aprovada). Refazer não apaga a versão aprovada. Guardamos a atual, a aprovada e as
 *       {@value #KEEP_VERSIONS} mais recentes; as outras somem com a textura (minimização, LGPD);</li>
 *   <li>excluir apaga todas as versões e texturas; a exclusão da conta faz o mesmo;</li>
 *   <li>a auditoria recebe só ids, número da versão, status e os nomes das métricas reprovadas.</li>
 * </ul>
 */
@Service
public class Avatar3dService {
    static final int MODEL_VERSION = 1;
    static final int SHAPE_LEN = 468 * 3;
    /** Versões guardadas além da atual e da aprovada. */
    static final int KEEP_VERSIONS = 5;
    private static final Pattern HEX = Pattern.compile("^#[0-9a-fA-F]{6}$");
    private static final long MAX_TEXTURE_BYTES = 4L * 1024 * 1024;
    /** Tons de cabelo da paleta (lib/avatar3d/hair-tone.ts, HAIR_TONES): 0 = o medido na foto, 1–14 = escolhido. */
    static final int HAIR_TONES = 14;
    /** Cortes de cabelo (lib/avatar3d/hair-cut.ts, HAIR_CUTS): 0 = o medido na foto, 1–7 = escolhido. */
    static final int HAIR_CUTS = 7;
    /** Ajustes finos: faixas pequenas de propósito (ajuste, não outra pessoa). Iguais a ADJUST_RANGE do cliente. */
    private static final Map<String, double[]> ADJUST = Map.of(
            "headScale", new double[]{0.94, 1.06, 1}, "neck", new double[]{-0.02, 0.02, 0},
            "hairVolume", new double[]{0.6, 1.6, 1}, "skinLight", new double[]{-0.08, 0.08, 0},
            "hairTone", new double[]{0, HAIR_TONES, 0}, "hairCut", new double[]{0, HAIR_CUTS, 0});

    /** Moderação da textura do rosto (mesma capacidade CONTENT_MODERATOR, com critério de rosto em vez de peça). */
    static final String TEXTURE_MODERATION_SYSTEM = "Você é o moderador de conteúdo do Fashion AI. A imagem é a textura (atlas) do "
            + "rosto de um avatar 3D, gerada a partir de uma foto da própria pessoa. Aprove quando for um rosto humano comum. "
            + "Recuse nudez ou conteúdo sexual, violência ou sangue, símbolos de ódio, texto ou gestos ofensivos, ou imagem que "
            + "não seja um rosto. Responda só JSON: {\"approved\": true|false, \"reason\": \"motivo curto\"}.";

    private final UserAvatar3dRepository avatars;
    private final AvatarIdentityVersionRepository versions;
    private final UserRepository users;
    private final MediaStoragePort storage;
    private final Audit audit;
    private final AiEngine ai;

    public Avatar3dService(UserAvatar3dRepository avatars, AvatarIdentityVersionRepository versions, UserRepository users,
                           MediaStoragePort storage, Audit audit, AiEngine ai) {
        this.avatars = avatars;
        this.versions = versions;
        this.users = users;
        this.storage = storage;
        this.audit = audit;
        this.ai = ai;
    }

    /**
     * O que o cliente envia junto com a textura (parte "meta" do multipart). {@code quality}: o relatório do gate de
     * identidade medido no aparelho (lib/avatar3d/identity), só números agregados; ausente em clientes antigos.
     */
    public record SaveCommand(Map<String, Object> model, Map<String, Object> adjust, Integer photos, List<String> warnings,
                              Boolean consent, Boolean publicOnRunway, Map<String, Object> quality) {
        public SaveCommand(Map<String, Object> model, Map<String, Object> adjust, Integer photos, List<String> warnings,
                           Boolean consent, Boolean publicOnRunway) {
            this(model, adjust, photos, warnings, consent, publicOnRunway, null);
        }
    }

    /** sex: corpo base do avatar (FEMININO/MASCULINO), estimado pelo rosto ou trocado pela pessoa; null = sem mudança. */
    public record SettingsCommand(Map<String, Object> adjust, Boolean publicOnRunway, Map<String, Object> body, String sex) {
        public SettingsCommand(Map<String, Object> adjust, Boolean publicOnRunway, Map<String, Object> body) {
            this(adjust, publicOnRunway, body, null);
        }
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
        Map<String, Object> quality = IdentityQuality.sanitize(cmd.quality());
        IdentityStatus status = IdentityQuality.passed(quality) ? IdentityStatus.APPROVED : IdentityStatus.NEEDS_REFINEMENT;
        User u = users.findById(user.id()).orElseThrow(() -> ApiException.notFound(Msg.t("common.usuario")));
        UserAvatar3d a = avatars.findByUserId(u.getId()).orElseGet(() -> {
            UserAvatar3d n = new UserAvatar3d();
            n.setUser(u);
            n.setIdentityId(UUID.randomUUID());
            n.setCurrentVersion(0);
            return n;
        });
        if (a.getIdentityId() == null) {
            a.setIdentityId(UUID.randomUUID());
        }
        Integer basedOn = a.getTextureKey() == null ? null : a.getCurrentVersion();
        if (basedOn != null) {
            ensureVersionRow(a);                       // avatar de antes das versões: vira a versão atual guardada
        }
        int next = nextVersion(u.getId(), a);
        String key = "restricted/users/" + u.getId() + "/avatar3d/face-" + System.currentTimeMillis() + "-v" + next + ".jpg";
        storage.put(key, jpeg, "image/jpeg");
        if (cmd.publicOnRunway() != null) {
            a.setPublicOnRunway(cmd.publicOnRunway());
        }
        // textura nova: moderada agora se o avatar for público; privado, só quando a pessoa o tornar público
        ModerationStatus moderation = a.isPublicOnRunway() ? moderateTexture(u.getId(), jpeg) : ModerationStatus.PENDING;
        AvatarIdentityVersion v = new AvatarIdentityVersion();
        v.setUser(u);
        v.setIdentityId(a.getIdentityId());
        v.setVersionNo(next);
        v.setBasedOn(basedOn);
        v.setStatus(status);
        v.setModelVersion(MODEL_VERSION);
        v.setModelJson(Json.write(model));
        v.setAdjustJson(Json.write(clampAdjust(cmd.adjust())));
        v.setTextureKey(key);
        v.setPhotosCount(cmd.photos() == null ? 1 : Math.max(1, Math.min(3, cmd.photos())));
        v.setWarningsJson(Json.write(cmd.warnings() == null ? List.of() : cmd.warnings().stream().limit(20)
                .map(w -> w == null ? "" : w.replaceAll("[^A-Z0-9_]", "")).filter(w -> !w.isEmpty()).toList()));
        v.setQualityJson(quality == null ? null : Json.write(quality));
        v.setTextureModeration(moderation);
        if (status == IdentityStatus.APPROVED) {
            v.setApprovedAt(Instant.now());
        }
        versions.save(v);
        makeCurrent(a, v);
        a.setConsentAt(Instant.now());
        avatars.save(a);
        prune(a);
        audit.log(user, "AVATAR3D_SALVO", "avatar3d:" + u.getId(), auditDetails(v, quality));
        return view(a);
    }

    /** As versões da identidade da pessoa, da mais nova para a mais antiga (sem modelo nem textura). */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> listVersions(CurrentUser user) {
        UserAvatar3d a = avatars.findByUserId(user.id()).orElse(null);
        if (a == null) {
            return List.of();
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (AvatarIdentityVersion v : versions.findByUserIdOrderByVersionNoDesc(user.id())) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("version", v.getVersionNo());
            m.put("status", v.getStatus().name());
            m.put("basedOn", v.getBasedOn());
            m.put("current", v.getVersionNo() == a.getCurrentVersion());
            m.put("approved", a.getApprovedVersion() != null && v.getVersionNo() == a.getApprovedVersion());
            m.put("approvedWithWarnings", v.isApprovedWithWarnings());
            m.put("createdAt", v.getCreatedAt());
            m.put("approvedAt", v.getApprovedAt());
            Map<String, Object> q = v.getQualityJson() == null ? null : Json.map(v.getQualityJson());
            m.put("gate", q == null ? null : q.get("gate"));
            out.add(m);
        }
        return out;
    }

    /**
     * A pessoa aprova uma versão. Versão que reprovou no gate só com {@code acceptWarnings} (aprovar mesmo assim):
     * fica marcada como aprovada com avisos.
     */
    @Transactional
    public Map<String, Object> approve(CurrentUser user, int versionNo, boolean acceptWarnings) {
        UserAvatar3d a = avatars.findByUserId(user.id()).orElseThrow(() -> ApiException.notFound(Msg.t("avatar3d.avatar")));
        AvatarIdentityVersion v = version(user.id(), versionNo);
        if (v.getStatus() == IdentityStatus.NEEDS_REFINEMENT && !acceptWarnings) {
            throw ApiException.conflict("IDENTIDADE_PRECISA_REFINAR", Msg.t("avatar3d.identidade_precisa_refinar"));
        }
        if (v.getStatus() != IdentityStatus.APPROVED) {
            v.setApprovedWithWarnings(v.getStatus() == IdentityStatus.NEEDS_REFINEMENT);
            v.setStatus(IdentityStatus.APPROVED);
            v.setApprovedAt(Instant.now());
        }
        if (a.isPublicOnRunway() && v.getTextureModeration() == ModerationStatus.PENDING) {
            v.setTextureModeration(moderateTexture(user.id(), storage.get(v.getTextureKey())));
        }
        versions.save(v);
        a.setApprovedVersion(v.getVersionNo());
        if (v.getVersionNo() == a.getCurrentVersion()) {
            a.setIdentityStatus(IdentityStatus.APPROVED);
            a.setTextureModeration(v.getTextureModeration());
        }
        avatars.save(a);
        audit.log(user, "AVATAR3D_VERSAO_APROVADA", "avatar3d:" + user.id(), auditDetails(v, null));
        return view(a);
    }

    /** Volta para uma versão anterior: cria uma versão nova igual a ela (a história não é reescrita). */
    @Transactional
    public Map<String, Object> restore(CurrentUser user, int versionNo) {
        UserAvatar3d a = avatars.findByUserId(user.id()).orElseThrow(() -> ApiException.notFound(Msg.t("avatar3d.avatar")));
        AvatarIdentityVersion src = version(user.id(), versionNo);
        int next = nextVersion(user.id(), a);
        String key = "restricted/users/" + user.id() + "/avatar3d/face-" + System.currentTimeMillis() + "-v" + next + ".jpg";
        storage.put(key, storage.get(src.getTextureKey()), "image/jpeg");
        AvatarIdentityVersion v = new AvatarIdentityVersion();
        v.setUser(src.getUser());
        v.setIdentityId(src.getIdentityId());
        v.setVersionNo(next);
        v.setBasedOn(src.getVersionNo());
        v.setStatus(src.getStatus());
        v.setApprovedWithWarnings(src.isApprovedWithWarnings());
        v.setApprovedAt(src.getStatus() == IdentityStatus.APPROVED ? Instant.now() : null);
        v.setModelVersion(src.getModelVersion());
        v.setModelJson(src.getModelJson());
        v.setAdjustJson(src.getAdjustJson());
        v.setTextureKey(key);
        v.setPhotosCount(src.getPhotosCount());
        v.setWarningsJson(src.getWarningsJson());
        v.setQualityJson(src.getQualityJson());
        v.setTextureModeration(src.getTextureModeration());
        versions.save(v);
        makeCurrent(a, v);
        avatars.save(a);
        prune(a);
        audit.log(user, "AVATAR3D_VERSAO_RESTAURADA", "avatar3d:" + user.id(), auditDetails(v, null));
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
            if (a.isPublicOnRunway() && a.getTextureModeration() == ModerationStatus.PENDING) {
                a.setTextureModeration(moderateTexture(user.id(), storage.get(a.getTextureKey())));
            }
        }
        if (cmd != null && ("FEMININO".equals(cmd.sex()) || "MASCULINO".equals(cmd.sex()))) {
            Map<String, Object> model = new LinkedHashMap<>(Json.map(a.getModelJson()));
            model.put("sex", cmd.sex());
            a.setModelJson(Json.write(model));
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
        // ajustes finos, sexo e corpo são da versão atual: a versão guardada acompanha (restaurar devolve tudo)
        versions.findByUserIdAndVersionNo(user.id(), a.getCurrentVersion()).ifPresent(v -> {
            v.setAdjustJson(a.getAdjustJson());
            v.setModelJson(a.getModelJson());
            v.setTextureModeration(a.getTextureModeration());
            versions.save(v);
        });
        // tornar público: a versão aprovada (a que outras pessoas veem) também passa pela moderação
        if (a.isPublicOnRunway() && a.getApprovedVersion() != null && a.getApprovedVersion() != a.getCurrentVersion()) {
            versions.findByUserIdAndVersionNo(user.id(), a.getApprovedVersion())
                    .filter(v -> v.getTextureModeration() == ModerationStatus.PENDING)
                    .ifPresent(v -> {
                        v.setTextureModeration(moderateTexture(user.id(), storage.get(v.getTextureKey())));
                        versions.save(v);
                    });
        }
        return view(a);
    }

    @Transactional
    public void delete(CurrentUser user) {
        avatars.findByUserId(user.id()).ifPresent(a -> {
            purge(user.id(), a);
            audit.log(user, "AVATAR3D_EXCLUIDO", "avatar3d:" + user.id(), Map.of());
        });
    }

    /** Exclusão da conta: some com o avatar, todas as versões e as texturas, sem usuário logado. */
    @Transactional
    public void deleteAllFor(UUID userId) {
        avatars.findByUserId(userId).ifPresent(a -> purge(userId, a));
    }

    private void purge(UUID userId, UserAvatar3d a) {
        for (AvatarIdentityVersion v : versions.findByUserIdOrderByVersionNoDesc(userId)) {
            deleteQuietly(v.getTextureKey());
            versions.delete(v);
        }
        deleteQuietly(a.getTextureKey());
        avatars.delete(a);
    }

    /**
     * Textura do rosto: o dono sempre (de qualquer versão guardada); outra pessoa só a da versão aprovada, se o avatar
     * for público e a textura dessa versão passou na moderação. Senão, 404 (não revela que existe).
     */
    @Transactional(readOnly = true)
    public byte[] texture(CurrentUser viewer, UUID ownerId) {
        return texture(viewer, ownerId, null);
    }

    @Transactional(readOnly = true)
    public byte[] texture(CurrentUser viewer, UUID ownerId, Integer versionNo) {
        UserAvatar3d a = avatars.findByUserId(ownerId).orElseThrow(() -> ApiException.notFound(Msg.t("avatar3d.avatar")));
        boolean owner = viewer != null && viewer.id().equals(ownerId);
        if (owner) {
            if (versionNo == null || versionNo == a.getCurrentVersion()) {
                return storage.get(a.getTextureKey());
            }
            return storage.get(version(ownerId, versionNo).getTextureKey());
        }
        Integer approved = a.getApprovedVersion();
        if (approved == null || (versionNo != null && !versionNo.equals(approved)) || !a.isPublicOnRunway()) {
            throw ApiException.notFound(Msg.t("avatar3d.avatar"));
        }
        if (approved == a.getCurrentVersion()) {
            if (!publicTexture(a)) {
                throw ApiException.notFound(Msg.t("avatar3d.avatar"));
            }
            return storage.get(a.getTextureKey());
        }
        AvatarIdentityVersion v = versions.findByUserIdAndVersionNo(ownerId, approved)
                .filter(x -> x.getTextureModeration() == ModerationStatus.APPROVED)
                .orElseThrow(() -> ApiException.notFound(Msg.t("avatar3d.avatar")));
        return storage.get(v.getTextureKey());
    }

    /** A textura pode ser vista por outras pessoas: avatar público e textura aprovada na moderação. */
    static boolean publicTexture(UserAvatar3d a) {
        return a.isPublicOnRunway() && a.getTextureModeration() == ModerationStatus.APPROVED;
    }

    /**
     * Modera a textura do rosto pelo motor de IA (consentimento, cota, teto de gasto e registro valem). Sem veredito
     * remoto — sem provedor, sem consentimento, fora da cota — fica PENDING: nunca aprova por omissão.
     */
    ModerationStatus moderateTexture(UUID userId, byte[] jpeg) {
        byte[] small = ImageOps.jpeg(ImageOps.scaleToFit(ImageOps.decode(jpeg), 512, 512), 0.85f);
        AiOutcome<Boolean> out = ai.text(new AiEngine.TextCall<>(userId, AiCapability.CONTENT_MODERATOR, TEXTURE_MODERATION_SYSTEM,
                Msg.t("wardrobe.classifique_a_imagem_anexada"), List.of(new AiRequest.AiImage(small, "image/jpeg")), 200,
                List.of(Msg.t("avatar3d.textura_do_rosto_reduzida")), Avatar3dService::parseVerdict, () -> null, null));
        Boolean approved = out == null ? null : out.value();
        return approved == null ? ModerationStatus.PENDING : approved ? ModerationStatus.APPROVED : ModerationStatus.REJECTED_POLICY;
    }

    static Boolean parseVerdict(String text) {
        return Json.map(text).get("approved") instanceof Boolean b ? b : null;
    }

    /**
     * Referência do avatar para o manequim (look3d, Passarela, Quarto, Espelho), ou vazio quando quem vê não pode. O dono
     * vê a versão atual; as outras pessoas, a última versão aprovada (nunca uma que precisa de refinamento).
     */
    @Transactional(readOnly = true)
    public Optional<Map<String, Object>> forMannequin(UUID ownerId, UUID viewerId) {
        return avatars.findByUserId(ownerId)
                .filter(a -> a.isPublicOnRunway() || ownerId.equals(viewerId))
                .flatMap(a -> {
                    boolean owner = ownerId.equals(viewerId);
                    if (owner || (a.getApprovedVersion() != null && a.getApprovedVersion() == a.getCurrentVersion())) {
                        Map<String, Object> m = new LinkedHashMap<>();
                        m.put("version", a.getUpdatedAt() == null ? 0 : a.getUpdatedAt().toEpochMilli());
                        m.put("model", Json.map(a.getModelJson()));
                        m.put("adjust", a.getAdjustJson() == null ? Map.of() : Json.map(a.getAdjustJson()));
                        // textura ainda não aprovada: quem não é o dono vê a forma com o rosto padrão (sem a foto)
                        m.put("textureUrl", owner || publicTexture(a) ? textureUrl(a) : null);
                        return Optional.of(m);
                    }
                    if (a.getApprovedVersion() == null) {
                        return Optional.empty();
                    }
                    return versions.findByUserIdAndVersionNo(ownerId, a.getApprovedVersion()).map(v -> {
                        Map<String, Object> m = new LinkedHashMap<>();
                        m.put("version", v.getUpdatedAt() == null ? v.getVersionNo() : v.getUpdatedAt().toEpochMilli());
                        m.put("model", Json.map(v.getModelJson()));
                        m.put("adjust", v.getAdjustJson() == null ? Map.of() : Json.map(v.getAdjustJson()));
                        m.put("textureUrl", v.getTextureModeration() == ModerationStatus.APPROVED
                                ? "/api/avatar3d/" + ownerId + "/texture?version=" + v.getVersionNo() : null);
                        return m;
                    });
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
        m.put("textureModeration", a.getTextureModeration() == null ? ModerationStatus.PENDING.name() : a.getTextureModeration().name());
        m.put("consentAt", a.getConsentAt());
        m.put("updatedAt", a.getUpdatedAt());
        Map<String, Object> identity = new LinkedHashMap<>();
        identity.put("identityId", a.getIdentityId());
        identity.put("version", a.getCurrentVersion());
        identity.put("status", a.getIdentityStatus() == null ? IdentityStatus.APPROVED.name() : a.getIdentityStatus().name());
        identity.put("approvedVersion", a.getApprovedVersion());
        identity.put("quality", a.getQualityJson() == null ? null : Json.map(a.getQualityJson()));
        m.put("identity", identity);
        return m;
    }

    private static String textureUrl(UserAvatar3d a) {
        long v = a.getUpdatedAt() == null ? 0 : a.getUpdatedAt().toEpochMilli();
        return "/api/avatar3d/" + a.getUser().getId() + "/texture?v=" + v;
    }

    private AvatarIdentityVersion version(UUID userId, int versionNo) {
        return versions.findByUserIdAndVersionNo(userId, versionNo)
                .orElseThrow(() -> ApiException.notFound(Msg.t("avatar3d.versao_nao_encontrada")));
    }

    private int nextVersion(UUID userId, UserAvatar3d a) {
        List<AvatarIdentityVersion> all = versions.findByUserIdOrderByVersionNoDesc(userId);
        int max = all.isEmpty() ? 0 : all.get(0).getVersionNo();
        return Math.max(max, a.getCurrentVersion()) + 1;
    }

    /** A versão vira a atual: o registro do avatar (o que o app e as vitrines leem) passa a ser ela. */
    private static void makeCurrent(UserAvatar3d a, AvatarIdentityVersion v) {
        a.setModelVersion(v.getModelVersion());
        a.setModelJson(v.getModelJson());
        a.setAdjustJson(v.getAdjustJson());
        a.setTextureKey(v.getTextureKey());
        a.setPhotosCount(v.getPhotosCount());
        a.setWarningsJson(v.getWarningsJson());
        a.setQualityJson(v.getQualityJson());
        a.setTextureModeration(v.getTextureModeration());
        a.setCurrentVersion(v.getVersionNo());
        a.setIdentityStatus(v.getStatus());
        if (v.getStatus() == IdentityStatus.APPROVED) {
            a.setApprovedVersion(v.getVersionNo());
        }
    }

    /** Avatar salvo antes das versões (sem linha de versão): guarda o atual como versão aprovada antes de seguir. */
    private void ensureVersionRow(UserAvatar3d a) {
        UUID userId = a.getUser().getId();
        if (versions.findByUserIdAndVersionNo(userId, a.getCurrentVersion()).isPresent()) {
            return;
        }
        AvatarIdentityVersion v = new AvatarIdentityVersion();
        v.setUser(a.getUser());
        v.setIdentityId(a.getIdentityId());
        v.setVersionNo(Math.max(1, a.getCurrentVersion()));
        v.setStatus(a.getIdentityStatus() == null ? IdentityStatus.APPROVED : a.getIdentityStatus());
        v.setModelVersion(a.getModelVersion());
        v.setModelJson(a.getModelJson());
        v.setAdjustJson(a.getAdjustJson());
        v.setTextureKey(a.getTextureKey());
        v.setPhotosCount(a.getPhotosCount());
        v.setWarningsJson(a.getWarningsJson());
        v.setQualityJson(a.getQualityJson());
        v.setTextureModeration(a.getTextureModeration() == null ? ModerationStatus.PENDING : a.getTextureModeration());
        v.setApprovedAt(a.getConsentAt());
        versions.save(v);
        a.setCurrentVersion(v.getVersionNo());
        if (v.getStatus() == IdentityStatus.APPROVED && a.getApprovedVersion() == null) {
            a.setApprovedVersion(v.getVersionNo());
        }
    }

    /** Guarda a atual, a aprovada e as {@value #KEEP_VERSIONS} mais recentes; o resto some com a textura. */
    private void prune(UserAvatar3d a) {
        List<AvatarIdentityVersion> all = versions.findByUserIdOrderByVersionNoDesc(a.getUser().getId());
        int kept = 0;
        for (AvatarIdentityVersion v : all) {
            boolean pinned = v.getVersionNo() == a.getCurrentVersion()
                    || (a.getApprovedVersion() != null && v.getVersionNo() == a.getApprovedVersion());
            if (pinned || kept < KEEP_VERSIONS) {
                if (!pinned) kept++;
                continue;
            }
            if (!v.getTextureKey().equals(a.getTextureKey())) {
                deleteQuietly(v.getTextureKey());
            }
            versions.delete(v);
        }
    }

    /** Auditoria sem dado pessoal: versão, status e os NOMES das métricas reprovadas (lista permitida). */
    static Map<String, Object> auditDetails(AvatarIdentityVersion v, Map<String, Object> quality) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("photos", v.getPhotosCount());
        m.put("version", v.getVersionNo());
        m.put("status", v.getStatus().name());
        if (quality != null) {
            m.put("gatePassed", IdentityQuality.passed(quality));
            m.put("failedChecks", List.copyOf(IdentityQuality.failed(quality)));
        }
        return m;
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
        // campos novos do cabelo (opcionais): valor fora da lista é descartado, como no validateModel do app
        @SuppressWarnings("unchecked") Map<String, Object> h = new LinkedHashMap<>((Map<String, Object>) hair);
        if (h.containsKey("length") && !HAIR_LENGTHS.contains(h.get("length"))) h.remove("length");
        if (h.containsKey("texture") && !HAIR_TEXTURES.contains(h.get("texture"))) h.remove("texture");
        if (h.containsKey("cover") && h.get("cover") != null && !(h.get("cover") instanceof String cv && HEX.matcher(cv).matches())) h.remove("cover");
        if (h.containsKey("outline") && !validOutline(h.get("outline"))) h.remove("outline");
        if (h.containsKey("tone") && h.get("tone") != null && !validTone(h.get("tone"))) h.remove("tone");
        // volume medido (fator 0,5–2,5) e a classe dele
        if (h.containsKey("volume") && !(h.get("volume") instanceof Number vn && Double.isFinite(vn.doubleValue()) && vn.doubleValue() >= 0.5 && vn.doubleValue() <= 2.5)) h.remove("volume");
        if (h.containsKey("volumeLevel") && !HAIR_VOLUMES.contains(h.get("volumeLevel"))) h.remove("volumeLevel");
        h.keySet().retainAll(HAIR_KEYS);
        Map<String, Object> out = new LinkedHashMap<>();
        if (m.get("body") instanceof Map<?, ?> body) {
            @SuppressWarnings("unchecked") Map<String, Object> b = (Map<String, Object>) body;
            out.put("body", validateBody(b));
        }
        for (String k : List.of("v", "shape", "skin", "metrics", "views", "warnings")) {
            if (m.containsKey(k)) {
                out.put(k, m.get(k));
            }
        }
        // corpo base do avatar (estimado pelo rosto no aparelho ou escolhido pela pessoa); valor desconhecido é descartado
        if ("FEMININO".equals(m.get("sex")) || "MASCULINO".equals(m.get("sex"))) {
            out.put("sex", m.get("sex"));
        }
        out.put("hair", h);
        return out;
    }

    /** Cabelo: comprimento e textura medidos na foto (lib/avatar3d/hair.ts) e a silhueta por altura. */
    static final List<String> HAIR_LENGTHS = List.of("bald", "buzz", "short", "medium", "long");
    static final List<String> HAIR_TEXTURES = List.of("straight", "wavy", "curly", "coily");
    static final java.util.Set<String> HAIR_KEYS = java.util.Set.of("present", "color", "top", "side", "bottom", "fringe", "cut", "length", "texture", "cover", "outline", "tone", "volume", "volumeLevel");
    static final List<String> HAIR_VOLUMES = List.of("flat", "normal", "full", "big");
    static final List<String> HAIR_FAMILIES = List.of("natural", "ash", "golden", "copper", "red", "gray", "white");

    /** Tom medido: {level: 1–10, family: uma de HAIR_FAMILIES}, nada mais. */
    static boolean validTone(Object o) {
        if (!(o instanceof Map<?, ?> t) || t.size() != 2 || !(t.get("level") instanceof Number n) || !HAIR_FAMILIES.contains(t.get("family"))) {
            return false;
        }
        double d = n.doubleValue();
        return d == Math.rint(d) && d >= 1 && d <= 10;
    }

    static boolean validOutline(Object o) {
        if (!(o instanceof List<?> l) || l.size() > 32) {
            return false;
        }
        for (Object x : l) {
            if (!(x instanceof Number n) || !Double.isFinite(n.doubleValue()) || n.doubleValue() < 0 || n.doubleValue() > 30) {
                return false;
            }
        }
        return true;
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
            out.put(k, "hairTone".equals(k) || "hairCut".equals(k) ? (Object) (int) Math.round(d) : (Object) d);
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
