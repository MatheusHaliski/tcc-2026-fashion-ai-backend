package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.assets.AssetCatalogService;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.imaging.MannequinGeometry;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.UserPreferences;
import br.com.fashionai.domain.model.enums.BodyBuild;
import br.com.fashionai.domain.model.enums.HypeScorePanelVersion;
import br.com.fashionai.domain.model.enums.MannequinSex;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.PhotoOrigin;
import br.com.fashionai.domain.model.enums.SizeSystem;
import br.com.fashionai.domain.model.enums.ThemeMode;
import br.com.fashionai.domain.model.enums.UiDensity;
import br.com.fashionai.domain.model.enums.UiLanguage;
import br.com.fashionai.domain.model.enums.UnitSystem;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.awt.image.BufferedImage;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.List;
import java.util.Map;

/**
 * RF23 — preferências de interface e dados NÃO sensíveis (salvam direto, sem reautenticação): tema,
 * idioma, densidade, fonte, alto contraste, redução de animação, fundo do chrome (lista /public/bg_chrome),
 * manequim do provador (RF18.CA01/CA06) e vitrine do perfil (nome de exibição, bio, avatar, capa, @).
 * CA08: tema/fundo mudam só o chrome — nunca a cor dos esquemas e das peças do usuário.
 */
@Service
public class PreferencesService {
    private final UserRepository users;
    private final UserPreferencesRepository preferences;
    private final AssetCatalogService assets;
    private final IdentityService identity;
    private final MediaService media;
    private final Guard guard;
    private final Audit audit;

    public PreferencesService(UserRepository users, UserPreferencesRepository preferences, AssetCatalogService assets,
                              IdentityService identity, MediaService media, Guard guard, Audit audit) {
        this.users = users;
        this.preferences = preferences;
        this.assets = assets;
        this.identity = identity;
        this.media = media;
        this.guard = guard;
        this.audit = audit;
    }

    private UserPreferences prefs(CurrentUser user) {
        return preferences.findByUserId(user.id()).orElseGet(() -> {
            UserPreferences p = new UserPreferences();
            p.setUser(users.findById(user.id()).orElseThrow(() -> ApiException.notFound(Msg.t("common.usuario"))));
            return preferences.save(p);
        });
    }

    @Transactional
    public Map<String, Object> get(CurrentUser user) {
        UserPreferences p = prefs(user);
        User u = p.getUser();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("theme", p.getTheme());
        out.put("language", p.getLanguage());
        out.put("density", p.getDensity());
        out.put("fontScale", p.getFontScale());
        out.put("highContrast", p.isHighContrast());
        out.put("reduceMotion", p.isReduceMotion());
        out.put("soundEnabled", p.isSoundEnabled());
        out.put("hapticsEnabled", p.isHapticsEnabled());
        out.put("coreAesthetic", p.getCoreAesthetic());
        out.put("chromeBackgroundId", p.getChromeBackgroundId());
        out.put("contentContainerColor", p.getContentContainerColor());
        out.put("sizeSystem", p.getSizeSystem());
        out.put("unitSystem", p.getUnitSystem());
        out.put("mannequinSex", p.getMannequinSex());
        out.put("mannequinSkinTone", p.getMannequinSkinTone());
        out.put("mannequinBuild", p.getMannequinBuild());
        out.put("defaultCardSkin", p.getDefaultCardSkin());
        out.put("lookDoDiaPanelVersion", u.getLookDoDiaPanelVersion());
        out.put("clientUpdatedAt", p.getClientUpdatedAt());
        out.put("profile", Map.of("displayName", u.getDisplayName(), "username", u.getUsername(),
                "bio", u.getBio() == null ? "" : u.getBio(), "avatarUrl", String.valueOf(u.getAvatarUrl()),
                "coverUrl", String.valueOf(u.getCoverUrl()), "country", String.valueOf(u.getCountry())));
        return out;
    }

    /** Opções válidas para montar a tela (fundos do chrome, skins, tons de pele). */
    public Map<String, Object> options() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("chromeBackgrounds", assets.chromeBackgrounds());
        out.put("cardSkins", assets.list("cardSkins"));
        out.put("skinTones", MannequinGeometry.SKIN_TONES);
        out.put("themes", ThemeMode.values());
        out.put("languages", UiLanguage.values());
        out.put("densities", UiDensity.values());
        out.put("panelVersions", HypeScorePanelVersion.values());
        out.put("bodyBuilds", BodyBuild.values());
        return out;
    }

    public record Update(ThemeMode theme, UiLanguage language, UiDensity density, Integer fontScale, Boolean highContrast,
                         Boolean reduceMotion, String chromeBackgroundId, SizeSystem sizeSystem, UnitSystem unitSystem,
                         MannequinSex mannequinSex, String mannequinSkinTone, BodyBuild mannequinBuild,
                         String defaultCardSkin, HypeScorePanelVersion lookDoDiaPanelVersion, Instant clientUpdatedAt,
                         String contentContainerColor, Boolean soundEnabled, Boolean hapticsEnabled, String coreAesthetic) {
    }

    /** DET-C06 — microestéticas "-core" do quiz "Qual é o seu core?" (vocabulário do arquétipo do DNA). */
    public static final List<String> CORES = List.of("OLD_MONEY", "QUIET_LUXURY", "GORPCORE", "COQUETTE", "Y2K", "STREETWEAR", "DARK_ACADEMIA", "COTTAGECORE");

    @Transactional
    public Map<String, Object> update(CurrentUser user, Update u) {
        UserPreferences p = prefs(user);
        if (u.clientUpdatedAt() != null && p.getClientUpdatedAt() != null && u.clientUpdatedAt().isBefore(p.getClientUpdatedAt())) {
            // sincronização entre dispositivos (RF23.CA02): a alteração mais recente vence.
            return get(user);
        }
        if (u.theme() != null) {
            p.setTheme(u.theme());
        }
        if (u.language() != null) {
            p.setLanguage(u.language());
        }
        if (u.density() != null) {
            p.setDensity(u.density());
        }
        if (u.fontScale() != null) {
            if (u.fontScale() < 80 || u.fontScale() > 160) {
                throw ApiException.badRequest("FONTE_INVALIDA", Msg.t("preferences.tamanho_de_fonte_entre_80"));
            }
            p.setFontScale(u.fontScale());
        }
        if (u.highContrast() != null) {
            p.setHighContrast(u.highContrast());
        }
        if (u.reduceMotion() != null) {
            p.setReduceMotion(u.reduceMotion());
        }
        if (u.soundEnabled() != null) {
            p.setSoundEnabled(u.soundEnabled());
        }
        if (u.hapticsEnabled() != null) {
            p.setHapticsEnabled(u.hapticsEnabled());
        }
        if (u.coreAesthetic() != null) {
            String core = u.coreAesthetic().trim().toUpperCase(java.util.Locale.ROOT);
            if (!core.isEmpty() && !CORES.contains(core)) {
                throw ApiException.badRequest("CORE_INVALIDO", Msg.t("preferences.core_desconhecido"));
            }
            p.setCoreAesthetic(core.isEmpty() ? null : core);
        }
        if (u.chromeBackgroundId() != null) {
            String id = u.chromeBackgroundId().isBlank() ? null : u.chromeBackgroundId();
            if (id != null && !assets.isChromeBackground(id)) {
                throw ApiException.badRequest("FUNDO_INVALIDO", Msg.t("preferences.fundo_do_chrome_fora_da"));
            }
            p.setChromeBackgroundId(id);
            p.getUser().setInterfaceBackgroundPresetId(id);
        }
        if (u.contentContainerColor() != null) {
            // "" volta ao padrão (branco); qualquer outro valor precisa ser #RRGGBB
            String c = u.contentContainerColor().trim();
            if (!c.isEmpty() && !c.matches("^#[0-9A-Fa-f]{6}$")) {
                throw ApiException.badRequest("COR_INVALIDA", Msg.t("preferences.cor_dos_containers_em_hexadecimal"));
            }
            p.setContentContainerColor(c.isEmpty() ? null : c.toUpperCase(java.util.Locale.ROOT));
        }
        if (u.sizeSystem() != null) {
            p.setSizeSystem(u.sizeSystem());
        }
        if (u.unitSystem() != null) {
            p.setUnitSystem(u.unitSystem());
        }
        if (u.mannequinSex() != null) {
            p.setMannequinSex(u.mannequinSex());
        }
        if (u.mannequinSkinTone() != null) {
            if (!MannequinGeometry.SKIN_TONES.containsKey(u.mannequinSkinTone())) {
                throw ApiException.badRequest("TOM_INVALIDO", Msg.t("preferences.tom_de_pele_fora_da"));
            }
            p.setMannequinSkinTone(u.mannequinSkinTone());
        }
        if (u.mannequinBuild() != null) {
            p.setMannequinBuild(u.mannequinBuild());
        }
        if (u.defaultCardSkin() != null) {
            if (assets.cardSkin(u.defaultCardSkin()).isEmpty()) {
                throw ApiException.badRequest("SKIN_INVALIDA", Msg.t("preferences.skin_de_card_desconhecida"));
            }
            p.setDefaultCardSkin(u.defaultCardSkin());
        }
        if (u.lookDoDiaPanelVersion() != null) {
            p.getUser().setLookDoDiaPanelVersion(u.lookDoDiaPanelVersion());
        }
        p.setClientUpdatedAt(u.clientUpdatedAt() == null ? Instant.now() : u.clientUpdatedAt());
        audit.log(user, AuditActions.ALTERACAO_PREFERENCIAS, "preferences:" + user.id(), Map.of());
        return get(user);
    }

    /**
     * @param sex          RF1 — sexo do manequim (Passarela 3D e provador); atualiza também a preferência do provador
     * @param runwayOptOut Passarela 3D — true tira o Look do Dia da pessoa da passarela do Explorar
     */
    public record ProfileUpdate(String displayName, String bio, String avatarUrl, String coverUrl, String country,
                                br.com.fashionai.domain.model.enums.MannequinSex sex, Boolean runwayOptOut, String pronouns,
                                List<Map<String, String>> links, Map<String, Object> mannequinFace) {
    }

    /** RF23.CA03 — vitrine do perfil sem reautenticação. */
    @Transactional
    public Views.UserCard updateProfile(CurrentUser user, ProfileUpdate cmd) {
        User u = users.findById(user.id()).orElseThrow(() -> ApiException.notFound(Msg.t("common.usuario")));
        if (cmd.displayName() != null) {
            u.setDisplayName(InputSanitizer.required("displayName", InputSanitizer.moderated("displayName", cmd.displayName(), 80), 2, 80));
        }
        if (cmd.bio() != null) {
            u.setBio(InputSanitizer.moderated("bio", cmd.bio(), 300));
        }
        if (cmd.avatarUrl() != null) {
            u.setAvatarUrl(cmd.avatarUrl().isBlank() ? null : cmd.avatarUrl());
        }
        if (cmd.coverUrl() != null) {
            u.setCoverUrl(cmd.coverUrl().isBlank() ? null : cmd.coverUrl());
        }
        if (cmd.country() != null) {
            String c = cmd.country().trim().toUpperCase(Locale.ROOT);
            if (!c.isEmpty() && !c.matches("[A-Z]{2}")) {
                throw ApiException.badRequest("PAIS_INVALIDO", Msg.t("preferences.use_o_codigo_iso_do"));
            }
            u.setCountry(c.isEmpty() ? null : c);
        }
        if (cmd.sex() != null) {
            u.setSex(cmd.sex());
            preferences.findByUserId(u.getId()).ifPresent(p -> p.setMannequinSex(cmd.sex()));
        }
        if (cmd.runwayOptOut() != null) {
            u.setRunwayOptOut(cmd.runwayOptOut());
        }
        if (cmd.pronouns() != null) {
            u.setPronouns(cmd.pronouns().isBlank() ? null : InputSanitizer.moderated("pronouns", cmd.pronouns(), 40));
        }
        if (cmd.links() != null) {
            u.setLinksJson(Json.write(validLinks(cmd.links())));
        }
        if (cmd.mannequinFace() != null) {
            Map<String, Object> face = new java.util.LinkedHashMap<>();
            face.put("offsetX", clampNum(cmd.mannequinFace().get("offsetX"), -0.3, 0.3, 0));
            face.put("offsetY", clampNum(cmd.mannequinFace().get("offsetY"), -0.3, 0.3, 0));
            face.put("scale", clampNum(cmd.mannequinFace().get("scale"), 0.6, 1.8, 1));
            preferences.findByUserId(u.getId()).ifPresent(p -> p.setMannequinFaceJson(Json.write(face)));
        }
        audit.log(user, AuditActions.ALTERACAO_PERFIL, "user:" + u.getId(), Map.of());
        return Views.user(u);
    }

    /** Links do perfil (Editar perfil, formato do Instagram): até 5, só http(s), título curto. */
    static List<Map<String, String>> validLinks(List<Map<String, String>> links) {
        if (links.size() > 5) {
            throw ApiException.badRequest("LINKS_DEMAIS", Msg.t("preferences.use_ate_5_links"));
        }
        List<Map<String, String>> out = new java.util.ArrayList<>();
        for (Map<String, String> l : links) {
            String url = l.get("url") == null ? "" : l.get("url").trim();
            if (url.isEmpty()) {
                continue;
            }
            if (!url.matches("(?i)https?://[^\\s<>\"]{3,300}")) {
                throw ApiException.badRequest("LINK_INVALIDO", Msg.t("preferences.link_invalido_use_um_endereco"));
            }
            String title = l.get("title") == null || l.get("title").isBlank() ? url.replaceFirst("(?i)^https?://", "") : l.get("title").trim();
            out.add(Map.of("title", InputSanitizer.clean(title.length() > 40 ? title.substring(0, 40) : title, 40), "url", url));
        }
        return out;
    }

    private static double clampNum(Object v, double min, double max, double def) {
        double d = v instanceof Number n ? n.doubleValue() : def;
        return Math.max(min, Math.min(max, d));
    }

    /** RF23.CA04 — @ já em uso é recusado com sugestões. */
    @Transactional
    public Map<String, Object> changeUsername(CurrentUser user, String requested) {
        guard.requireCanCreate(user);
        String username = IdentityService.normalizeUsername(requested);
        if (username.length() < 3) {
            throw ApiException.badRequest("USERNAME_INVALIDO", Msg.t("preferences.o_precisa_de_ao_menos"));
        }
        User u = users.findById(user.id()).orElseThrow(() -> ApiException.notFound(Msg.t("common.usuario")));
        if (IdentityService.reservedUsername(username) && !username.equalsIgnoreCase(u.getUsername())) {
            throw ApiException.badRequest("USERNAME_RESERVADO", Msg.t("identity.username_reservado"),
                    Map.of("suggestions", identity.usernameSuggestions(username)));
        }
        if (username.equalsIgnoreCase(u.getUsername())) {
            return Map.of("username", username);
        }
        if (users.existsByUsernameIgnoreCase(username)) {
            throw ApiException.badRequest("USERNAME_EM_USO", Msg.t("common.este_ja_esta_em_uso"),
                    Map.of("suggestions", identity.usernameSuggestions(username)));
        }
        u.setUsername(username);
        audit.log(user, AuditActions.ALTERACAO_PERFIL, "user:" + u.getId(), Map.of("field", "username"));
        return Map.of("username", username);
    }

    public Map<String, Object> checkUsername(String requested) {
        String username = IdentityService.normalizeUsername(requested);
        boolean available = IdentityService.usernameProblem(username) == null && !users.existsByUsernameIgnoreCase(username);
        return Map.of("username", username, "available", available,
                "suggestions", available ? java.util.List.of() : identity.usernameSuggestions(username));
    }

    /** Upload de avatar/capa (origem PROFILE no acervo de fotos). */
    @Transactional
    public Views.UserCard uploadProfileImage(CurrentUser user, byte[] bytes, boolean cover) {
        String mime = ImageOps.requireAcceptedImage(bytes);
        User u = users.findById(user.id()).orElseThrow(() -> ApiException.notFound(Msg.t("common.usuario")));
        return saveProfileImage(u, ImageOps.decode(bytes), cover, mime);
    }

    /**
     * RF3 — gira a foto de perfil atual em passos de 90° (foto que chegou deitada: enviada antes da leitura da orientação
     * EXIF ou por um app que não grava a tag). Gera uma nova versão; a anterior continua no acervo de fotos.
     */
    @Transactional
    public Views.UserCard rotateAvatar(CurrentUser user, int degrees) {
        int turns = Math.floorMod(Math.round(degrees / 90f), 4);
        if (degrees % 90 != 0 || turns == 0) {
            throw ApiException.badRequest("ROTACAO_INVALIDA", Msg.t("preferences.rotacao_invalida"));
        }
        User u = users.findById(user.id()).orElseThrow(() -> ApiException.notFound(Msg.t("common.usuario")));
        BufferedImage current = u.getAvatarUrl() == null ? null : media.readImage(u.getAvatarUrl()).orElse(null);
        if (current == null) {
            throw ApiException.badRequest("SEM_FOTO", Msg.t("preferences.sem_foto_de_perfil_para_girar"));
        }
        // EXIF 6 = 90° horário, 3 = 180°, 8 = 90° anti-horário
        BufferedImage turned = ImageOps.orient(ImageOps.toArgb(current), turns == 1 ? 6 : turns == 2 ? 3 : 8);
        audit.log(user, AuditActions.ALTERACAO_PERFIL, "user:" + u.getId(), Map.of("field", "avatar", "rotate", turns * 90));
        return saveProfileImage(u, turned, false, "image/jpeg");
    }

    private Views.UserCard saveProfileImage(User u, BufferedImage img, boolean cover, String mime) {
        BufferedImage fitted = ImageOps.scaleToFit(img, cover ? 1600 : 512, cover ? 900 : 512);
        byte[] jpeg = ImageOps.jpeg(fitted, 0.9f);
        String key = "users/" + u.getId() + "/profile/" + (cover ? "cover" : "avatar") + "-" + System.currentTimeMillis() + ".jpg";
        MediaStoragePort.StoredObject stored = media.put(key, jpeg, "image/jpeg");
        media.register(u, PhotoOrigin.PROFILE, u.getId(), stored, null, null, jpeg, fitted.getWidth(), fitted.getHeight(), null,
                ModerationStatus.APPROVED, Map.of("kind", cover ? "cover" : "avatar", "sourceMime", mime));
        if (cover) {
            u.setCoverUrl(stored.url());
        } else {
            u.setAvatarUrl(stored.url());
        }
        return Views.user(u);
    }
}
