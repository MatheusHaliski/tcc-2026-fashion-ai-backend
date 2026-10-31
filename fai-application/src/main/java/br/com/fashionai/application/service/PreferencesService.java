package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.assets.AssetCatalogService;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.hype.HypeCache;
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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.awt.image.BufferedImage;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * RF23 — preferências de interface e dados NÃO sensíveis (salvam direto, sem reautenticação): tema,
 * idioma, densidade, fonte, alto contraste, redução de animação, fundo do chrome (lista /public/bg_chrome),
 * manequim do provador (RF18.CA01/CA06) e vitrine do perfil (nome de exibição, bio, avatar, capa, @).
 * CA08: tema/fundo mudam só o chrome — nunca a cor dos esquemas e das peças do usuário.
 * RF53 · P3-12: também guarda a opção de não aparecer em "Criadores em alta" ({@code hypeCreatorOptOut}).
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

    /**
     * RF53 · P3-12 — cache de leitura do Hype: mudar a opção de "Criadores em alta" incrementa a geração, para o ranking
     * de criadores (e o lote de chips) em cache nunca mostrar o valor antigo. Por setter (o construtor não muda); sem
     * ele, nada a invalidar.
     */
    private HypeCache hypeCache;
    private AuraPermissionsService auraPermissions;
    @Autowired
    public void setAuraPermissions(AuraPermissionsService permissions) { this.auraPermissions = permissions; }


    @Autowired(required = false)
    public void setHypeCache(HypeCache hypeCache) {
        this.hypeCache = hypeCache;
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
        out.put("currency", p.getCurrency());
        out.put("navOrder", p.getNavOrderJson() == null ? null : Json.map(p.getNavOrderJson()));
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
        out.put("hypeCreatorOptOut", p.isHypeCreatorOptOut());
        // borda animada do AURA Hype: Studio (AURA_DYNAMIC); preferência antiga de quem ainda não chegou lá fica desligada
        boolean auraHypeAllowed = auraPermissions == null || auraPermissions.canUserEquipAura(u.getId(), AuraPermissionsService.AuraType.AURA_DYNAMIC);
        out.put("auraHype", p.isAuraHype() && auraHypeAllowed);
        out.put("auraHypeAllowed", auraHypeAllowed);
        out.put("auraImpersonation", p.isAuraImpersonation());
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
        out.put("currencies", ExchangeRateService.SUPPORTED);
        out.put("densities", UiDensity.values());
        out.put("panelVersions", HypeScorePanelVersion.values());
        out.put("bodyBuilds", BodyBuild.values());
        return out;
    }

    public record Update(ThemeMode theme, UiLanguage language, UiDensity density, Integer fontScale, Boolean highContrast,
                         Boolean reduceMotion, String chromeBackgroundId, SizeSystem sizeSystem, UnitSystem unitSystem,
                         MannequinSex mannequinSex, String mannequinSkinTone, BodyBuild mannequinBuild,
                         String defaultCardSkin, HypeScorePanelVersion lookDoDiaPanelVersion, Instant clientUpdatedAt,
                         String contentContainerColor, Boolean soundEnabled, Boolean hapticsEnabled, String coreAesthetic,
                         Boolean hypeCreatorOptOut, Boolean auraHype, Boolean auraImpersonation, String currency,
                         Map<String, Object> navOrder) {
        public Update(ThemeMode theme, UiLanguage language, UiDensity density, Integer fontScale, Boolean highContrast,
                      Boolean reduceMotion, String chromeBackgroundId, SizeSystem sizeSystem, UnitSystem unitSystem,
                      MannequinSex mannequinSex, String mannequinSkinTone, BodyBuild mannequinBuild,
                      String defaultCardSkin, HypeScorePanelVersion lookDoDiaPanelVersion, Instant clientUpdatedAt,
                      String contentContainerColor, Boolean soundEnabled, Boolean hapticsEnabled, String coreAesthetic,
                      Boolean hypeCreatorOptOut, Boolean auraHype, Boolean auraImpersonation, String currency) {
            this(theme, language, density, fontScale, highContrast, reduceMotion, chromeBackgroundId, sizeSystem, unitSystem,
                    mannequinSex, mannequinSkinTone, mannequinBuild, defaultCardSkin, lookDoDiaPanelVersion, clientUpdatedAt,
                    contentContainerColor, soundEnabled, hapticsEnabled, coreAesthetic, hypeCreatorOptOut, auraHype, auraImpersonation,
                    currency, null);
        }
        public Update(ThemeMode theme, UiLanguage language, UiDensity density, Integer fontScale, Boolean highContrast,
                      Boolean reduceMotion, String chromeBackgroundId, SizeSystem sizeSystem, UnitSystem unitSystem,
                      MannequinSex mannequinSex, String mannequinSkinTone, BodyBuild mannequinBuild,
                      String defaultCardSkin, HypeScorePanelVersion lookDoDiaPanelVersion, Instant clientUpdatedAt,
                      String contentContainerColor, Boolean soundEnabled, Boolean hapticsEnabled, String coreAesthetic,
                      Boolean hypeCreatorOptOut, Boolean auraHype, Boolean auraImpersonation) {
            this(theme, language, density, fontScale, highContrast, reduceMotion, chromeBackgroundId, sizeSystem, unitSystem,
                    mannequinSex, mannequinSkinTone, mannequinBuild, defaultCardSkin, lookDoDiaPanelVersion, clientUpdatedAt,
                    contentContainerColor, soundEnabled, hapticsEnabled, coreAesthetic, hypeCreatorOptOut, auraHype, auraImpersonation, null);
        }
        public Update(ThemeMode theme, UiLanguage language, UiDensity density, Integer fontScale, Boolean highContrast,
                      Boolean reduceMotion, String chromeBackgroundId, SizeSystem sizeSystem, UnitSystem unitSystem,
                      MannequinSex mannequinSex, String mannequinSkinTone, BodyBuild mannequinBuild,
                      String defaultCardSkin, HypeScorePanelVersion lookDoDiaPanelVersion, Instant clientUpdatedAt,
                      String contentContainerColor, Boolean soundEnabled, Boolean hapticsEnabled, String coreAesthetic,
                      Boolean hypeCreatorOptOut, Boolean auraHype) {
            this(theme, language, density, fontScale, highContrast, reduceMotion, chromeBackgroundId, sizeSystem, unitSystem,
                    mannequinSex, mannequinSkinTone, mannequinBuild, defaultCardSkin, lookDoDiaPanelVersion, clientUpdatedAt,
                    contentContainerColor, soundEnabled, hapticsEnabled, coreAesthetic, hypeCreatorOptOut, auraHype, null);
        }
        public Update(ThemeMode theme, UiLanguage language, UiDensity density, Integer fontScale, Boolean highContrast,
                      Boolean reduceMotion, String chromeBackgroundId, SizeSystem sizeSystem, UnitSystem unitSystem,
                      MannequinSex mannequinSex, String mannequinSkinTone, BodyBuild mannequinBuild,
                      String defaultCardSkin, HypeScorePanelVersion lookDoDiaPanelVersion, Instant clientUpdatedAt,
                      String contentContainerColor, Boolean soundEnabled, Boolean hapticsEnabled, String coreAesthetic,
                      Boolean hypeCreatorOptOut) {
            this(theme, language, density, fontScale, highContrast, reduceMotion, chromeBackgroundId, sizeSystem, unitSystem,
                    mannequinSex, mannequinSkinTone, mannequinBuild, defaultCardSkin, lookDoDiaPanelVersion, clientUpdatedAt,
                    contentContainerColor, soundEnabled, hapticsEnabled, coreAesthetic, hypeCreatorOptOut, null);
        }
    }

    /** DET-C06 — microestéticas "-core" do quiz "Qual é o seu core?" (vocabulário do arquétipo do DNA). */
    public static final List<String> CORES = PreferenceValueRules.CORES;

    @Transactional
    public Map<String, Object> update(CurrentUser user, Update u) {
        UserPreferences p = prefs(user);
        if (PreferenceValueRules.isStale(u.clientUpdatedAt(), p.getClientUpdatedAt())) {
            // sincronização entre dispositivos (RF23.CA02): a alteração mais recente vence.
            return get(user);
        }
        if (Boolean.TRUE.equals(u.auraImpersonation())) {
            if (auraPermissions == null) throw new ApiException(503, "AURA_PERMISSIONS_UNAVAILABLE", Msg.t("auraGate.locked.AURA_IMPERSONATION"));
            auraPermissions.require(user.id(), AuraPermissionsService.AuraType.AURA_IMPERSONATION);
        }
        if (u.auraImpersonation() != null) p.setAuraImpersonation(u.auraImpersonation());
        if (Boolean.TRUE.equals(u.auraHype())) {
            if (auraPermissions == null) throw new ApiException(503, "AURA_PERMISSIONS_UNAVAILABLE", Msg.t("auraGate.locked.AURA_DYNAMIC"));
            auraPermissions.require(user.id(), AuraPermissionsService.AuraType.AURA_DYNAMIC);
        }
        if (u.theme() != null) {
            p.setTheme(u.theme());
        }
        if (u.language() != null) {
            p.setLanguage(u.language());
        }
        if (u.currency() != null) {
            p.setCurrency(PreferenceValueRules.currency(u.currency())); // "" ou AUTO volta à moeda do idioma
        }
        if (u.navOrder() != null) {
            // {} ou sem grupos volta à ordem padrão do menu
            p.setNavOrderJson(u.navOrder().isEmpty() ? null : Json.write(PreferenceValueRules.navOrder(u.navOrder())));
        }
        if (u.density() != null) {
            p.setDensity(u.density());
        }
        if (u.fontScale() != null) {
            p.setFontScale(PreferenceValueRules.fontScale(u.fontScale()));
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
            p.setCoreAesthetic(PreferenceValueRules.coreAesthetic(u.coreAesthetic()));
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
            p.setContentContainerColor(PreferenceValueRules.containerColor(u.contentContainerColor())); // "" volta ao branco
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
            p.setMannequinSkinTone(PreferenceValueRules.skinTone(u.mannequinSkinTone()));
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
        if (u.auraHype() != null) p.setAuraHype(u.auraHype());
        if (u.hypeCreatorOptOut() != null && u.hypeCreatorOptOut() != p.isHypeCreatorOptOut()) {
            // P3-12 — sair (ou voltar) de "Criadores em alta": só o agregado de criador muda; as peças e looks continuam
            // com o próprio Hype. O cache do ranking troca de geração depois do commit (nunca serve o valor antigo).
            p.setHypeCreatorOptOut(u.hypeCreatorOptOut());
            invalidateHypeCacheAfterCommit();
        }
        p.setClientUpdatedAt(u.clientUpdatedAt() == null ? Instant.now() : u.clientUpdatedAt());
        audit.log(user, AuditActions.ALTERACAO_PREFERENCIAS, "preferences:" + user.id(), Map.of());
        return get(user);
    }

    /** Nova geração do HypeCache quando a transação confirmar (sem transação ativa, na hora). */
    private void invalidateHypeCacheAfterCommit() {
        if (hypeCache == null) {
            return;
        }
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    hypeCache.bump();
                }
            });
        } else {
            hypeCache.bump();
        }
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
        // avatar/capa: vazio remove; senão só um arquivo da própria pessoa (users/{id}/…), gravado pela URL canônica
        // (o valor atual reenviado sem mudança passa: contas antigas têm a foto do cadastro em pending/)
        if (cmd.avatarUrl() != null && !cmd.avatarUrl().equals(u.getAvatarUrl())) {
            u.setAvatarUrl(cmd.avatarUrl().isBlank() ? null
                    : media.requireOwnedMedia(u.getId(), cmd.avatarUrl(), Set.of(MediaService.MediaScope.OWNER), "avatarUrl").url());
        }
        if (cmd.coverUrl() != null && !cmd.coverUrl().equals(u.getCoverUrl())) {
            u.setCoverUrl(cmd.coverUrl().isBlank() ? null
                    : media.requireOwnedMedia(u.getId(), cmd.coverUrl(), Set.of(MediaService.MediaScope.OWNER), "coverUrl").url());
        }
        if (cmd.country() != null) {
            u.setCountry(PreferenceValueRules.country(cmd.country()));
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
            u.setLinksJson(Json.write(PreferenceValueRules.links(cmd.links())));
        }
        if (cmd.mannequinFace() != null) {
            Map<String, Object> face = PreferenceValueRules.mannequinFace(cmd.mannequinFace());
            preferences.findByUserId(u.getId()).ifPresent(p -> p.setMannequinFaceJson(Json.write(face)));
        }
        audit.log(user, AuditActions.ALTERACAO_PERFIL, "user:" + u.getId(), Map.of());
        return Views.user(u);
    }

    /** Mantido para os testes existentes; a regra está em {@link PreferenceValueRules#links}. */
    static List<Map<String, String>> validLinks(List<Map<String, String>> links) {
        return PreferenceValueRules.links(links);
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
        // só a foto da própria pessoa (ou a do cadastro, em pending/): nunca republica em users/ um arquivo de terceiros
        BufferedImage current = media.ownedMedia(u.getId(), u.getAvatarUrl(), Set.of(MediaService.MediaScope.OWNER, MediaService.MediaScope.PENDING))
                .flatMap(m -> media.readImage(m.url())).orElse(null);
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
