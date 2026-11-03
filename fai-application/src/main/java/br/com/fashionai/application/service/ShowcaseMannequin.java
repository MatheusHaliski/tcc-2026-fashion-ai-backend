package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.MannequinSex;
import br.com.fashionai.domain.model.enums.Model3dStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Look e peça no manequim 3D: o manequim da pessoa (sexo do cadastro RF1 → provador → peças → padrão; cabeça do Avatar 3D
 * do RF40 quando visível), as peças com o modelo do RF16 pronto como GLB (as demais como a foto recortada) e o resumo
 * do HypeScore v2 do look (público, ou pessoal para o dono).
 */
final class ShowcaseMannequin {
    private final SchemeItemRepository schemeItems;
    private final UserPreferencesRepository preferences;
    private final Avatar3dService avatars3d;
    private final ShowcaseHype hypes;
    private final HypeScoreConfig hypeConfig;

    ShowcaseMannequin(SchemeItemRepository schemeItems, UserPreferencesRepository preferences, Avatar3dService avatars3d,
                      ShowcaseHype hypes, HypeScoreConfig hypeConfig) {
        this.schemeItems = schemeItems;
        this.preferences = preferences;
        this.avatars3d = avatars3d;
        this.hypes = hypes;
        this.hypeConfig = hypeConfig;
    }

    Map<String, Object> look(Scheme s, CurrentUser viewer) {
        return look(s, viewer, hypes.of(HypeEntityType.SCHEME, List.of(s.getId())).get(s.getId()));
    }

    /** Look no manequim com o Hype v2 já carregado ({@code hype}: resumo dos cards; público, ou pessoal para o dono). */
    Map<String, Object> look(Scheme s, CurrentUser viewer, HypeScoreCurrent hype) {
        List<WardrobeItem> ws = schemeItems.findBySchemeIdOrderBySortOrder(s.getId()).stream().map(SchemeItem::getWardrobeItem)
                .filter(Objects::nonNull).toList();
        boolean own = viewer != null && viewer.id().equals(s.getUser().getId());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("schemeId", s.getId());
        out.put("title", s.getTitle());
        out.put("owner", Views.user(s.getUser()));
        out.put("hype", SearchHype.hypeSummary(hype, own, hypeConfig));
        out.put("likes", s.getLikeCount());       // popularidade, à parte do Hype
        out.put("mannequin", mannequin(s.getUser(), ws, viewer));
        out.put("pieces", ws.stream().map(ShowcaseMannequin::piece).toList());
        long ready = ws.stream().filter(w -> w.getModel3dStatus() == Model3dStatus.COMPLETED && w.getModel3dUrl() != null).count();
        out.put("ready3d", ready);
        out.put("missing3d", ws.size() - ready);
        out.put("canRequest", own && ws.stream().anyMatch(this::canRequest));
        return out;
    }

    boolean canRequest(WardrobeItem w) {
        return !w.isDefaultImage() && w.getImageUrl() != null && w.getModel3dStatus() != Model3dStatus.COMPLETED
                && w.getModel3dStatus() != Model3dStatus.QUEUED && w.getModel3dStatus() != Model3dStatus.PROCESSING;
    }

    static Map<String, Object> piece(WardrobeItem w) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", w.getId());
        m.put("name", w.getName());
        m.put("slot", MirrorService.slotOf(w));
        m.put("category", w.getCategory());
        m.put("subcategory", w.getSubcategory());
        m.put("imageUrl", w.getImageUrl());                 // recorte sem fundo: é o que "veste" o manequim
        m.put("studioUrl", w.getStudioImageUrl());
        m.put("colorHex", Taxonomy.hex(w.getColor()));
        m.put("model3dStatus", w.getModel3dStatus() == null ? null : w.getModel3dStatus().name());
        m.put("model3dUrl", w.getModel3dStatus() == Model3dStatus.COMPLETED ? w.getModel3dUrl() : null);
        m.put("defaultImage", w.isDefaultImage());
        return m;
    }

    /**
     * Manequim da pessoa: sexo do cadastro (RF1) → preferência do provador → sexo das peças → feminino padrão.
     * Com foto de perfil, a cabeça do manequim recebe a foto; sem foto, é o manequim padrão (cabeça lisa).
     */
    Map<String, Object> mannequin(User u, List<WardrobeItem> ws) {
        return mannequin(u, ws, null);
    }

    /**
     * Com o Avatar 3D (RF40) confirmado e visível para quem está vendo (público na Passarela, ou o próprio dono), a
     * cabeça é o busto da pessoa ({@code head=AVATAR}); senão continua a foto de perfil ou o manequim padrão.
     */
    Map<String, Object> mannequin(User u, List<WardrobeItem> ws, CurrentUser viewer) {
        Map<String, Object> m = mannequinBase(u, ws);
        if (u.getProfileType() != ProfileType.MARCA) {
            avatars3d.forMannequin(u.getId(), viewer == null ? null : viewer.id()).ifPresent(a -> {
                m.put("avatar", a);
                m.put("head", "AVATAR");
            });
        }
        return m;
    }

    private Map<String, Object> mannequinBase(User u, List<WardrobeItem> ws) {
        MannequinSex sex = u.getSex();
        String source = "cadastro";
        var prefs = preferences.findByUserId(u.getId());
        if (sex == null && prefs.isPresent() && prefs.get().getMannequinSex() != null) {
            sex = prefs.get().getMannequinSex();
            source = "provador";
        }
        if (sex == null) {
            long fem = ws.stream().filter(w -> "FEMININO".equalsIgnoreCase(w.getSex())).count();
            long mas = ws.stream().filter(w -> "MASCULINO".equalsIgnoreCase(w.getSex())).count();
            if (fem != mas) {
                sex = fem > mas ? MannequinSex.FEMININO : MannequinSex.MASCULINO;
                source = "pecas";
            } else {
                sex = MannequinSex.FEMININO;
                source = "padrao";
            }
        }
        String photo = u.getAvatarUrl();
        if (u.getProfileType() == ProfileType.MARCA) {
            photo = null;                                   // logo não vira rosto: marca desfila com o manequim padrão
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("sex", sex.name());
        m.put("sexSource", source);
        m.put("photoUrl", photo);
        // a foto de perfil não vai para a cabeça 3D (levava o fundo e a roupa para o rosto): o rosto só vem do Avatar 3D
        m.put("head", "PADRAO");
        m.put("skinTone", prefs.map(p -> p.getMannequinSkinTone()).orElse(null));
        m.put("build", prefs.map(p -> p.getMannequinBuild() == null ? null : p.getMannequinBuild().name()).orElse(null));
        m.put("face", prefs.map(p -> p.getMannequinFaceJson() == null ? null : br.com.fashionai.application.common.Json.map(p.getMannequinFaceJson())).orElse(null));
        return m;
    }
}
