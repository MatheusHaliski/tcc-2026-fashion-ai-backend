package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.SchemeService.SchemeForm;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.enums.PhotoOrigin;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import org.springframework.context.ApplicationEventPublisher;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Ciclo de vida do look do dono: publicar, editar (RF9, com revalidação e revogação de selos), favorito/disponível
 * (RF31) e arquivar (exclusão, com a foto do look saindo de "Minhas Fotos").
 */
final class SchemeEditFlow {
    private final SchemeItemRepository schemeItems;
    private final BackgroundStudioService studio;
    private final SealService seals;
    private final ProjectionService projections;
    private final MediaService media;
    private final Guard guard;
    private final Audit audit;
    private final ApplicationEventPublisher events;
    private final SchemeReads reads;
    private final SchemeFormWriter writer;
    private final SchemeLookPhoto photo;

    SchemeEditFlow(SchemeItemRepository schemeItems, BackgroundStudioService studio, SealService seals, ProjectionService projections,
                   MediaService media, Guard guard, Audit audit, ApplicationEventPublisher events, SchemeReads reads,
                   SchemeFormWriter writer, SchemeLookPhoto photo) {
        this.schemeItems = schemeItems;
        this.studio = studio;
        this.seals = seals;
        this.projections = projections;
        this.media = media;
        this.guard = guard;
        this.audit = audit;
        this.events = events;
        this.reads = reads;
        this.writer = writer;
        this.photo = photo;
    }

    Map<String, Object> publish(CurrentUser user, UUID id, Visibility visibility) {
        guard.requireCanCreate(user);
        Scheme s = reads.owned(user, id);
        if (visibility != null) {
            s.setVisibility(visibility);
        }
        List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(id);
        if (items.isEmpty()) {
            throw ApiException.badRequest("SEM_PECAS", Msg.t("scheme.adicione_ao_menos_1_peca_2"));
        }
        writer.publishInternal(s, items);
        projections.scheme(s, items);
        audit.log(user, AuditActions.PUBLICACAO_ESQUEMA, "scheme:" + id, Map.of("visibility", s.getVisibility().name()));
        return Map.of("scheme", reads.view(user, s, items));
    }

    Map<String, Object> update(CurrentUser user, UUID id, SchemeForm form) {
        guard.requireCanCreate(user);
        Scheme s = reads.owned(user, id);
        Set<UUID> before = schemeItems.findBySchemeIdOrderBySortOrder(id).stream().map(si -> si.getWardrobeItem().getId())
                .collect(Collectors.toSet());
        writer.applyForm(s, form);
        Visibility oldVisibility = s.getVisibility();
        if (form.visibility() != null) {
            s.setVisibility(form.visibility());
        }
        List<SchemeItem> items = form.items() == null ? schemeItems.findBySchemeIdOrderBySortOrder(id) : writer.replaceItems(user, s, form.items());
        if (items.isEmpty()) {
            throw ApiException.badRequest("SEM_PECAS", Msg.t("scheme.o_esquema_precisa_de_ao"));
        }
        Set<UUID> after = items.stream().map(si -> si.getWardrobeItem().getId()).collect(Collectors.toSet());
        if (form.background() != null || Boolean.TRUE.equals(form.applyRecommendedDirection())) {
            studio.requireAuraAccess(user, form.background());
            studio.applyToScheme(s, form.background(), Boolean.TRUE.equals(form.applyRecommendedDirection()));
            photo.applyLookPhoto(user, s, form.background(), items);
        }
        if (!before.equals(after) && s.getStatus() == SchemeStatus.PUBLISHED) {
            seals.flagRevalidation(s);
            for (SchemeItem si : items) {
                if (si.getSnapshotJson() == null) {
                    si.setSnapshotJson(Json.write(Views.snapshot(si.getWardrobeItem())));
                }
            }
        }
        if (s.getVisibility() == Visibility.PRIVATE && oldVisibility != Visibility.PRIVATE) {
            // RF20.CA14 — esquema tornado privado revoga os selos.
            seals.revokeForScheme(s.getId(), Msg.t("scheme.esquema_tornado_privado"));
        }
        if (Boolean.TRUE.equals(form.publish()) && s.getStatus() != SchemeStatus.PUBLISHED) {
            writer.publishInternal(s, items);
        }
        projections.scheme(s, items);
        audit.log(user, AuditActions.EDICAO_ESQUEMA, "scheme:" + id, Map.of("itemsChanged", !before.equals(after)));
        if (!before.equals(after)) {
            events.publishEvent(new DomainEvents.SchemeSaved(user.id(), id, new ArrayList<>(after), s.getOrigin().name(), false));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("scheme", reads.view(user, s, items));
        out.put("revalidationPending", s.isRevalidationPending());
        return out;
    }

    Map<String, Object> toggles(CurrentUser user, UUID id, Boolean favorite, Boolean disponivel) {
        guard.requireCanCreate(user);
        Scheme s = reads.owned(user, id);
        if (favorite != null) {
            s.setFavorite(favorite);
        }
        if (disponivel != null) {
            s.setDisponivel(disponivel);
        }
        return Map.of("id", id, "favorite", s.isFavorite(), "disponivel", s.isDisponivel());
    }

    Map<String, Object> archive(CurrentUser user, UUID id) {
        guard.requireCanCreate(user);
        Scheme s = reads.owned(user, id);
        s.setStatus(SchemeStatus.ARCHIVED);
        seals.revokeForScheme(id, Msg.t("scheme.esquema_excluido_pelo_autor"));
        projections.removeScheme(id);
        // RF12.CA13: a foto do look sai de "Minhas Fotos" junto com ele (as antigas, sem vínculo, casam pela URL da capa)
        String cover = s.getCoverImageUrl() != null && s.getCoverImageUrl().contains("/users/" + user.id() + "/looks/") ? s.getCoverImageUrl() : null;
        int photosRemoved = media.retire(user.id(), id, Set.of(PhotoOrigin.SCHEME), cover == null ? List.of() : List.of(cover));
        audit.log(user, AuditActions.EDICAO_ESQUEMA, "scheme:" + id, Map.of("op", "archive", "photosRemoved", photosRemoved));
        return Map.of("id", id, "status", s.getStatus(), "photosRemoved", photosRemoved);
    }
}
