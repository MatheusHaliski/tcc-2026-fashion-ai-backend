package br.com.fashionai.application.scheme;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import br.com.fashionai.application.ai.*;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.common.*;
import br.com.fashionai.application.imaging.*;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.repository.*;
import br.com.fashionai.application.service.*;
import br.com.fashionai.application.service.SchemeService.*;

public final class SchemePublication {
    private final Guard guard;
    private final SchemeItemRepository schemeItems;
    private final ProjectionService projections;
    private final Audit audit;
    private final SchemeAccess access;
    private final SchemeQueries queries;

    public SchemePublication(Guard guard, SchemeItemRepository schemeItems, ProjectionService projections, Audit audit,
                             SchemeAccess access, SchemeQueries queries) {
        this.guard = guard;
        this.schemeItems = schemeItems;
        this.projections = projections;
        this.audit = audit;
        this.access = access;
        this.queries = queries;
    }

    public Map<String, Object> publish(CurrentUser user, UUID id, Visibility visibility) {
        guard.requireCanCreate(user);
        Scheme s = access.owned(user, id);
        if (visibility != null) {
            s.setVisibility(visibility);
        }
        List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(id);
        if (items.isEmpty()) {
            throw ApiException.badRequest("SEM_PECAS", Msg.t("scheme.adicione_ao_menos_1_peca_2"));
        }
        publishInternal(s, items);
        projections.scheme(s, items);
        audit.log(user, AuditActions.PUBLICACAO_ESQUEMA, "scheme:" + id, Map.of("visibility", s.getVisibility().name()));
        return Map.of("scheme", queries.view(user, s, items));
    }

    void publishInternal(Scheme s, List<SchemeItem> items) {
        s.setStatus(SchemeStatus.PUBLISHED);
        if (s.getPublishedAt() == null) {
            s.setPublishedAt(Instant.now());
        }
        s.setCommunityIndexed(s.getVisibility() == Visibility.PUBLIC);
        for (SchemeItem si : items) {
            // RF7.CA03 — snapshot da peça no momento da publicação.
            si.setSnapshotJson(Json.write(Views.snapshot(si.getWardrobeItem())));
        }
        projections.published(s);
    }
}
