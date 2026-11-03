package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.ShowcaseService.Kind;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/** My Stage 3D (aba Eras): a celebridade no palco com as cores das eras, vestindo o look de maior HypeScore v2. */
final class ShowcaseStage {
    private final ShowcaseGroupings base;
    private final CelebrityProfileRepository celebrities;
    private final ShowcaseMannequin mannequins;
    private final ShowcaseHype hypes;

    ShowcaseStage(ShowcaseGroupings base, CelebrityProfileRepository celebrities, ShowcaseMannequin mannequins, ShowcaseHype hypes) {
        this.base = base;
        this.celebrities = celebrities;
        this.mannequins = mannequins;
        this.hypes = hypes;
    }

    /**
     * My Stage 3D (aba Eras): a foto oficial da celebridade na cabeça do manequim, vestindo o look de maior HypeScore v2
     * (público para quem visita; sem Hype = o mais recente), no palco com as cores das eras.
     */
    Map<String, Object> stage(CurrentUser viewer, String slug, UUID schemeId) {
        User u = base.owner(slug, Kind.ERAS);
        List<Scheme> ss = base.visibleSchemes(viewer, u);
        boolean self = ShowcaseGroupings.self(viewer, u);
        Map<UUID, HypeScoreCurrent> hype = hypes.of(HypeEntityType.SCHEME, ss.stream().map(Scheme::getId).toList());
        // visibleSchemes já vem do mais recente para o mais antigo: a ordem estável deixa o recente na frente do empate
        List<Scheme> ranked = ss.stream().sorted(Comparator.comparing((Scheme s) -> SearchHype.scoreFor(hype.get(s.getId()), self),
                Comparator.nullsLast(Comparator.reverseOrder()))).toList();
        Scheme chosen = schemeId == null ? ranked.stream().findFirst().orElse(null)
                : ss.stream().filter(s -> s.getId().equals(schemeId)).findFirst().orElseThrow(() -> ApiException.notFound("Esquema"));
        String photo = celebrities.findByOwnerId(u.getId()).map(c -> c.getAvatarUrl()).filter(Objects::nonNull).orElse(u.getAvatarUrl());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("celebrity", Views.user(u));
        out.put("photoUrl", photo);
        out.put("look", chosen == null ? null : mannequins.look(chosen, viewer, hype.get(chosen.getId())));
        if (chosen == null) {
            Map<String, Object> m = mannequins.mannequin(u, List.of());
            m.put("photoUrl", photo);
            // a foto de perfil não vai para a cabeça 3D (levava o fundo e a roupa para o rosto): o rosto só vem do Avatar 3D
        m.put("head", "PADRAO");
            out.put("mannequin", m);
        }
        out.put("eras", base.groupingsOf(u, Kind.ERAS).stream().map(g -> Map.of("id", g.getId(), "label", g.getLabel(),
                "accentColor", g.getAccentColor() == null ? "#2D55C9" : g.getAccentColor())).toList());
        out.put("looks", ranked.stream().limit(12).map(s -> Map.of("id", s.getId(), "title", s.getTitle())).toList());
        return out;
    }
}
