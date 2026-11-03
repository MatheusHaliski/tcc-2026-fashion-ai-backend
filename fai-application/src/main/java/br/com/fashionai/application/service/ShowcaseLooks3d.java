package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.Model3dStatus;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Botão "Gerar 3D": o look de um esquema e uma peça sozinha no manequim (com as regras de visibilidade do esquema e da
 * peça) e o pedido do RF16 para todas as peças do dono que ainda não têm modelo 3D (cada uma vira um job).
 */
final class ShowcaseLooks3d {
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final WardrobeItemRepository pieces;
    private final SchemeService schemeService;
    private final Model3dService model3d;
    private final Guard guard;
    private final ShowcaseMannequin mannequins;

    ShowcaseLooks3d(SchemeRepository schemes, SchemeItemRepository schemeItems, WardrobeItemRepository pieces, SchemeService schemeService,
                    Model3dService model3d, Guard guard, ShowcaseMannequin mannequins) {
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.pieces = pieces;
        this.schemeService = schemeService;
        this.model3d = model3d;
        this.guard = guard;
        this.mannequins = mannequins;
    }

    Map<String, Object> look3d(CurrentUser viewer, UUID schemeId) {
        Scheme s = schemes.findById(schemeId).orElseThrow(() -> ApiException.notFound("Esquema"));
        if (s.getStatus() == SchemeStatus.ARCHIVED && (viewer == null || !viewer.id().equals(s.getUser().getId()))
                || !schemeService.canView(viewer, s)) {
            throw ApiException.notFound("Esquema");
        }
        return mannequins.look(s, viewer);
    }

    /** Uma peça sozinha no manequim (card de peça): o modelo do RF16 quando existe, senão a foto aplicada. */
    Map<String, Object> piece3d(CurrentUser viewer, UUID pieceId) {
        WardrobeItem w = pieces.findById(pieceId).orElseThrow(() -> ApiException.notFound(Msg.t("common.peca")));
        guard.requireView(viewer, w.getUser().getId(), SchemeService.moreRestrictive(w.getVisibility(), w.getUser().getProfileVisibility()), "piece:" + pieceId);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("pieceId", w.getId());
        out.put("title", w.getName());
        out.put("owner", Views.user(w.getUser()));
        out.put("mannequin", mannequins.mannequin(w.getUser(), List.of(w), viewer));
        out.put("pieces", List.of(ShowcaseMannequin.piece(w)));
        boolean own = viewer != null && viewer.id().equals(w.getUser().getId());
        out.put("canRequest", own && mannequins.canRequest(w));
        out.put("missing3d", w.getModel3dStatus() == Model3dStatus.COMPLETED ? 0 : 1);
        return out;
    }

    /** Dono pede o RF16 para todas as peças do esquema que ainda não têm modelo 3D (cada uma vira um job). */
    Map<String, Object> requestModels(CurrentUser user, UUID schemeId) {
        guard.requireCanCreate(user);
        Scheme s = schemeService.owned(user, schemeId);
        int requested = 0;
        List<Map<String, Object>> skipped = new ArrayList<>();
        for (SchemeItem si : schemeItems.findBySchemeIdOrderBySortOrder(s.getId())) {
            WardrobeItem w = si.getWardrobeItem();
            if (w == null || w.getModel3dStatus() == Model3dStatus.COMPLETED) {
                continue;
            }
            if (!w.getUser().getId().equals(user.id())) {
                skipped.add(Map.of("id", w.getId(), "name", w.getName(), "reason", Msg.t("showcase.peca_de_outra_pessoa")));
                continue;
            }
            try {
                model3d.request(w);
                requested++;
            } catch (ApiException ex) {
                skipped.add(Map.of("id", w.getId(), "name", w.getName(), "reason", ex.getMessage()));
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("requested", requested);
        out.put("skipped", skipped);
        out.put("look", mannequins.look(s, user));
        return out;
    }
}
