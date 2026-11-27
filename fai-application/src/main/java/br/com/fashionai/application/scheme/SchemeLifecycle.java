package br.com.fashionai.application.scheme;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import br.com.fashionai.application.ai.*;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.common.*;
import br.com.fashionai.application.dna.SchemeRemixPrototype;
import br.com.fashionai.application.imaging.*;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.repository.*;
import br.com.fashionai.application.service.*;
import br.com.fashionai.application.service.SchemeService.*;

public final class SchemeLifecycle {
    private final Guard guard;
    private final SealService seals;
    private final ProjectionService projections;
    private final MediaService media;
    private final Audit audit;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final WardrobeService wardrobe;
    private final SchemeAccess access;

    public SchemeLifecycle(Guard guard, SealService seals, ProjectionService projections, MediaService media, Audit audit,
                           SchemeRepository schemes, SchemeItemRepository schemeItems, WardrobeService wardrobe, SchemeAccess
                           access) {
        this.guard = guard;
        this.seals = seals;
        this.projections = projections;
        this.media = media;
        this.audit = audit;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.wardrobe = wardrobe;
        this.access = access;
    }

    public Map<String, Object> toggles(CurrentUser user, UUID id, Boolean favorite, Boolean disponivel) {
        guard.requireCanCreate(user);
        Scheme s = access.owned(user, id);
        if (favorite != null) {
            s.setFavorite(favorite);
        }
        if (disponivel != null) {
            s.setDisponivel(disponivel);
        }
        return Map.of("id", id, "favorite", s.isFavorite(), "disponivel", s.isDisponivel());
    }

    public Map<String, Object> archive(CurrentUser user, UUID id) {
        guard.requireCanCreate(user);
        Scheme s = access.owned(user, id);
        s.setStatus(SchemeStatus.ARCHIVED);
        seals.revokeForScheme(id, Msg.t("scheme.esquema_excluido_pelo_autor"));
        projections.removeScheme(id);
        // RF12.CA13: a foto do look sai de "Minhas Fotos" junto com ele (as antigas, sem vínculo, casam pela URL da capa)
        String cover = s.getCoverImageUrl() != null && s.getCoverImageUrl().contains("/users/" + user.id() + "/looks/") ? s.getCoverImageUrl() : null;
        int photosRemoved = media.retire(user.id(), id, Set.of(PhotoOrigin.SCHEME), cover == null ? List.of() : List.of(cover));
        audit.log(user, AuditActions.EDICAO_ESQUEMA, "scheme:" + id, Map.of("op", "archive", "photosRemoved", photosRemoved));
        return Map.of("id", id, "status", s.getStatus(), "photosRemoved", photosRemoved);
    }

    public Map<String, Object> remix(CurrentUser user, UUID sourceId) {
        guard.requireCanCreate(user);
        Scheme src = schemes.findById(sourceId).orElseThrow(() -> ApiException.notFound(Msg.t("entity.esquema")));
        access.requireView(user, src);
        if (!src.isDisponivel()) {
            throw ApiException.conflict("INDISPONIVEL", Msg.t("scheme.o_autor_marcou_este_look"));
        }
        List<SchemeItem> srcItems = schemeItems.findBySchemeIdOrderBySortOrder(sourceId);
        List<WardrobeItem> mine = wardrobe.eligible(user.id());
        SchemeRemixPrototype.PieceMapping mapping = SchemeRemixPrototype.mapPieces(srcItems, mine, src.getUser().getId().equals(user.id()));
        Map<String, Object> prefill = SchemeRemixPrototype.prefill(src, mapping.items());
        List<Map<String, Object>> missing = mapping.missing();
        return Map.of("prefill", prefill, "missingPieces", missing, "source", Map.of("id", src.getId(), "title", src.getTitle(),
                "owner", Views.user(src.getUser())), "next", "/create-look?remix=" + src.getId());
    }
}
