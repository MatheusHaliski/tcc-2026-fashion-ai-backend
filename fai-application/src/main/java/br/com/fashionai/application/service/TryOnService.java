package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.ai.local.LocalSchemeComposer;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.imaging.MannequinGeometry;
import br.com.fashionai.application.imaging.TryOnCompositor;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Photo;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.UserPreferences;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.BodyBuild;
import br.com.fashionai.domain.model.enums.CreationMode;
import br.com.fashionai.domain.model.enums.MannequinSex;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.PhotoOrigin;
import br.com.fashionai.domain.model.enums.PhotoProcessingStatus;
import br.com.fashionai.domain.model.enums.SchemeOrigin;
import br.com.fashionai.domain.model.enums.SchemeSlot;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.awt.image.BufferedImage;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * RF18 — Provador 2D: manequim masculino/feminino lembrado entre sessões (CA01), camadas base → intermediária →
 * externa → acessório (CA02), mesma camada substitui e avisa (CA03), salvar como esquema com origem "Provador" (CA04),
 * remoção de fundo sob demanda ou aviso de sobreposição aproximada (CA05), tom de pele/porte salvos no perfil (CA06) e
 * limpar sem afetar o guarda-roupa (CA07). A renderização passa pela governança de IA (FASHN.ai → compositor local).
 */
@Service
public class TryOnService {
    private final WardrobeItemRepository pieces;
    private final UserPreferencesRepository preferences;
    private final UserRepository users;
    private final SchemeRepository schemes;
    private final WardrobeService wardrobe;
    private final SchemeService schemeService;
    private final TryOnCompositor compositor;
    private final MediaService media;
    private final AiEngine ai;
    private final br.com.fashionai.application.assets.AssetCatalogService assets;
    private final Avatar3dService avatars3d;

    public TryOnService(WardrobeItemRepository pieces, UserPreferencesRepository preferences, UserRepository users, SchemeRepository schemes,
                        WardrobeService wardrobe, SchemeService schemeService, TryOnCompositor compositor, MediaService media, AiEngine ai,
                        br.com.fashionai.application.assets.AssetCatalogService assets,
                        Avatar3dService avatars3d) {
        this.pieces = pieces;
        this.preferences = preferences;
        this.users = users;
        this.schemes = schemes;
        this.wardrobe = wardrobe;
        this.schemeService = schemeService;
        this.compositor = compositor;
        this.media = media;
        this.ai = ai;
        this.assets = assets;
        this.avatars3d = avatars3d;
    }

    /** Bytes da imagem da peça: storage de mídia ou, para a imagem padrão (RF4), o arquivo em /public/assets_pecas. */
    byte[] imageBytes(WardrobeItem w) {
        return media.read(w.getImageUrl()).or(() -> assets.publicFile(w.getImageUrl()).map(p -> {
            try {
                return java.nio.file.Files.readAllBytes(p);
            } catch (java.io.IOException e) {
                return null;
            }
        })).orElse(null);
    }

    UserPreferences prefs(UUID userId) {
        return preferences.findByUserId(userId).orElseThrow(() -> ApiException.notFound(Msg.t("common.preferencias")));
    }

    /** Estado inicial do provador: manequim lembrado, preferências de corpo e peças compatíveis por camada. */
    @Transactional(readOnly = true)
    public Map<String, Object> state(CurrentUser user, MannequinSex requested) {
        UserPreferences p = prefs(user.id());
        // identidade canônica: com Avatar 3D, o manequim É o avatar (sexo, corpo medido e pele); sem avatar, preferências
        Resolved id = resolve(user, p, requested);
        MannequinSex sex = id.sex();
        List<WardrobeItem> own = pieces.findByUserIdOrderByCreatedAtDesc(user.id()).stream()
                .filter(w -> w.getAvailabilityStatus() != br.com.fashionai.domain.model.enums.AvailabilityStatus.ARCHIVED).toList();
        if (own.isEmpty()) {
            throw new ApiException(422, "ACERVO_VAZIO", Msg.t("tryOn.cadastre_ao_menos_1_peca"), Map.of("href", "/add-piece"));
        }
        Map<String, List<Map<String, Object>>> byLayer = new LinkedHashMap<>();
        for (WardrobeItem w : own) {
            if (!MannequinGeometry.sexMatches(sex, w.getSex())) {
                continue;
            }
            SchemeSlot slot = LocalSchemeComposer.slotOf(w);
            String layer = MannequinGeometry.layerOf(slot).name();
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("piece", Views.piece(w, null, null));
            m.put("slot", slot.name());
            m.put("layer", layer);
            m.put("anchor", MannequinGeometry.anchorOf(slot, w.getSubcategory()));
            m.put("replacementKey", MannequinGeometry.replacementKey(slot, w.getSubcategory()));
            m.put("backgroundRemoved", w.getPhotoProcessingStatus() == PhotoProcessingStatus.COMPLETED && !w.isDefaultImage());
            byLayer.computeIfAbsent(layer, k -> new ArrayList<>()).add(m);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("mannequin", MannequinGeometry.describe(id.body(), p.getMannequinSkinTone(), id.identity().skinHex()));
        out.put("identity", id.identity());
        out.put("avatar", id.avatar());
        out.put("sex", sex.name());
        out.put("skinTones", MannequinGeometry.SKIN_TONES);
        out.put("builds", BodyBuild.values());
        out.put("layers", List.of("BASE", "INTERMEDIATE", "OUTER", "ACCESSORY"));
        out.put("pieces", byLayer);
        out.put("externalAvailable", compositor.externalAvailable() && ai.remoteEnabled());
        return out;
    }

    /** Manequim resolvido: corpo, sexo, identidade (origem dos dados) e a referência do avatar para o 3D da tela. */
    record Resolved(MannequinSex sex, MannequinGeometry.Body body, MannequinGeometry.Identity identity, Map<String, Object> avatar) {
    }

    /**
     * Digital double: o manequim do provador é o mesmo personagem do Avatar 3D do perfil — sexo do corpo do avatar,
     * proporções medidas/informadas e pele medida na foto. Só sem avatar valem o sexo escolhido, o porte e o tom de pele
     * das preferências (manequim genérico).
     */
    Resolved resolve(CurrentUser user, UserPreferences p, MannequinSex requested) {
        Map<String, Object> avatar = avatars3d.forMannequin(user.id(), user.id()).orElse(null);
        @SuppressWarnings("unchecked") Map<String, Object> model = avatar == null ? null : (Map<String, Object>) avatar.get("model");
        java.util.Optional<MannequinGeometry.Params> params = MannequinGeometry.paramsOf(model);
        if (params.isPresent()) {
            MannequinSex sex = MannequinGeometry.sexOf(model).orElse(p.getMannequinSex() == null ? MannequinSex.FEMININO : p.getMannequinSex());
            MannequinGeometry.Body body = MannequinGeometry.fromParams(sex, params.get());
            return new Resolved(sex, body, MannequinGeometry.identity(avatar, sex, p.getMannequinSkinTone(), true), avatar);
        }
        // sem avatar: o sexo é o do cadastro (RF1), como no manequim 3D do perfil — o provador não pede escolha de sexo
        MannequinSex profileSex = users.findById(user.id()).map(User::getSex).orElse(null);
        MannequinSex sex = profileSex != null ? profileSex : p.getMannequinSex() != null ? p.getMannequinSex() : requested != null ? requested : MannequinSex.FEMININO;
        return new Resolved(sex, MannequinGeometry.body(sex, p.getMannequinBuild()), MannequinGeometry.identity(avatar, sex, p.getMannequinSkinTone(), false), avatar);
    }

    /** CA01/CA06 — manequim, tom de pele e porte salvos no perfil (RF23). */
    @Transactional
    public Map<String, Object> savePreferences(CurrentUser user, MannequinSex sex, String skinTone, BodyBuild build) {
        UserPreferences p = prefs(user.id());
        if (sex != null) {
            p.setMannequinSex(sex);
        }
        if (skinTone != null) {
            if (!MannequinGeometry.SKIN_TONES.containsKey(skinTone)) {
                throw ApiException.badRequest("TOM_INVALIDO", Msg.t("tryOn.tons_disponiveis", MannequinGeometry.SKIN_TONES.keySet()));
            }
            p.setMannequinSkinTone(skinTone);
        }
        if (build != null) {
            p.setMannequinBuild(build);
        }
        preferences.save(p);
        return Map.of("sex", String.valueOf(p.getMannequinSex()), "skinTone", String.valueOf(p.getMannequinSkinTone()), "build", String.valueOf(p.getMannequinBuild()));
    }

    /** CA02/CA03 — resolve camadas: a última peça da mesma camada/âncora substitui a anterior e o sistema informa a troca. */
    static Map<String, Object> resolveLayers(List<WardrobeItem> ordered) {
        Map<String, WardrobeItem> byKey = new LinkedHashMap<>();
        List<String> replaced = new ArrayList<>();
        for (WardrobeItem w : ordered) {
            SchemeSlot slot = LocalSchemeComposer.slotOf(w);
            String key = MannequinGeometry.replacementKey(slot, w.getSubcategory());
            WardrobeItem previous = byKey.put(key, w);
            if (previous != null) {
                replaced.add(Msg.t("tryOn.substituiu_na_mesma_camada", w.getName(), previous.getName()));
            }
            if (slot == SchemeSlot.FULL_BODY) {
                byKey.entrySet().removeIf(e -> {
                    SchemeSlot s = LocalSchemeComposer.slotOf(e.getValue());
                    boolean conflict = s == SchemeSlot.TOP || s == SchemeSlot.BOTTOM;
                    if (conflict) {
                        replaced.add(Msg.t("tryOn.peca_inteira_substituiu", w.getName(), e.getValue().getName()));
                    }
                    return conflict;
                });
            }
        }
        return Map.of("pieces", new ArrayList<>(byKey.values()), "replaced", replaced);
    }

    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> render(CurrentUser user, MannequinSex sex, List<UUID> pieceIds) {
        if (pieceIds == null || pieceIds.isEmpty()) {
            throw ApiException.badRequest("SEM_PECAS", Msg.t("tryOn.leve_ao_menos_uma_peca"));
        }
        UserPreferences p = prefs(user.id());
        Resolved who = resolve(user, p, sex);
        MannequinSex s = who.sex();
        List<WardrobeItem> ordered = new ArrayList<>();
        for (UUID id : pieceIds) {
            WardrobeItem w = wardrobe.owned(user, id);
            if (!MannequinGeometry.sexMatches(s, w.getSex())) {
                throw ApiException.badRequest("SEXO_INCOMPATIVEL", Msg.t("tryOn.nao_e_compativel_com_o", w.getName(), s.name().toLowerCase()));
            }
            ordered.add(w);
        }
        Map<String, Object> resolved = resolveLayers(ordered);
        List<WardrobeItem> dressed = (List<WardrobeItem>) resolved.get("pieces");
        List<TryOnCompositor.Garment> garments = new ArrayList<>();
        for (WardrobeItem w : dressed) {
            byte[] bytes = imageBytes(w);
            BufferedImage img = bytes == null ? null : ImageOps.decode(bytes);
            boolean removed = w.getPhotoProcessingStatus() == PhotoProcessingStatus.COMPLETED && !w.isDefaultImage();
            BufferedImage cutout = img == null ? null : removed ? ImageOps.toArgb(img) : ImageOps.removeBackgroundLocal(img).image();
            garments.add(new TryOnCompositor.Garment(w.getId(), LocalSchemeComposer.slotOf(w), w.getSubcategory(), cutout, bytes, removed, w.getColor()));
        }
        MannequinGeometry.Body body = who.body();
        String skinHex = who.identity().skinHex();
        AiOutcome<TryOnCompositor.Result> outcome = ai.execute(user.id(), AiCapability.TRY_ON,
                List.of(Msg.t("tryOn.pecas_do_proprio_acervo_recortes", (garments.size())), "manequim " + s.name().toLowerCase() + " · " + who.identity().source()), null, null,
                List.of(new AiEngine.RemoteStep<>() {
                    public String provider() {
                        return "fashn";
                    }

                    public String model() {
                        return "fashn-tryon";
                    }

                    public boolean available() {
                        return compositor.externalAvailable();
                    }

                    public AiEngine.RemoteResult<TryOnCompositor.Result> call() {
                        TryOnCompositor.Result r = compositor.render(body, skinHex, garments, true);
                        return new AiEngine.RemoteResult<>(r, r.costUsd(), r.placements().size() + " camadas");
                    }
                }), () -> compositor.render(body, skinHex, garments, false));
        TryOnCompositor.Result r = outcome.value();
        User owner = users.findById(user.id()).orElseThrow();
        MediaStoragePort.StoredObject stored = media.put("users/" + user.id() + "/tryon/" + System.currentTimeMillis() + ".png", r.png(), "image/png");
        Photo photo = media.register(owner, PhotoOrigin.TRY_ON, null, stored, null, null, r.png(), MannequinGeometry.WIDTH, MannequinGeometry.HEIGHT, null,
                ModerationStatus.APPROVED, Map.of("pieces", dressed.stream().map(w -> w.getId().toString()).toList(), "sex", s.name()));
        List<String> warnings = new ArrayList<>(r.warnings());
        warnings.addAll((List<String>) resolved.get("replaced"));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("imageUrl", stored.url());
        out.put("photoId", photo.getId());
        out.put("pieceIds", dressed.stream().map(WardrobeItem::getId).toList());
        out.put("placements", r.placements());
        out.put("warnings", warnings);
        out.put("replaced", resolved.get("replaced"));
        out.put("stages", r.stages());
        out.put("costUsd", r.costUsd());
        out.put("totalMs", r.totalMs());
        out.put("fallbackUsed", outcome.fallbackUsed() || r.fallbackUsed());
        out.put("explanation", outcome.explanation());
        out.put("quota", outcome.quota());
        out.put("message", outcome.userMessage());
        return out;
    }

    /** CA04 — composição do provador vira esquema com origem "Provador". */
    @Transactional
    public Map<String, Object> saveAsScheme(CurrentUser user, List<UUID> pieceIds, String title, String tryOnUrl) {
        if (pieceIds == null || pieceIds.isEmpty()) {
            throw ApiException.badRequest("SEM_PECAS", Msg.t("tryOn.nao_ha_pecas_no_manequim"));
        }
        List<WardrobeItem> ordered = pieceIds.stream().map(id -> wardrobe.owned(user, id)).toList();
        @SuppressWarnings("unchecked") List<WardrobeItem> dressed = (List<WardrobeItem>) resolveLayers(ordered).get("pieces");
        List<SchemeService.ItemForm> items = new ArrayList<>();
        int i = 0;
        for (WardrobeItem w : dressed) {
            items.add(new SchemeService.ItemForm(w.getId(), LocalSchemeComposer.slotOf(w), i, i, null, null, null, null, null, null));
            i++;
        }
        LocalSchemeComposer.Composition c = LocalSchemeComposer.toComposition(dressed, List.of(), List.of(), null, 0);
        SchemeService.SchemeForm form = new SchemeService.SchemeForm(title == null || title.isBlank() ? Msg.t("tryOn.provador", c.title()) : InputSanitizer.clean(title, 120),
                null, c.occasions(), c.styles(), null, null, null, null, items, CreationMode.MANUAL, SchemeOrigin.PROVADOR, null, null, Boolean.TRUE,
                null, null, null, null, Boolean.FALSE, null);
        Views.SchemeView view = (Views.SchemeView) schemeService.create(user, form).get("scheme");
        if (tryOnUrl != null && !tryOnUrl.isBlank()) {
            Scheme s = schemes.findById(view.id()).orElseThrow();
            s.setVirtualTryOnUrl(tryOnUrl);
        }
        return Map.of("schemeId", view.id(), "origin", "PROVADOR");
    }
}
