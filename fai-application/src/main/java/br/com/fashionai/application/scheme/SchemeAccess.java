package br.com.fashionai.application.scheme;

import java.util.UUID;
import br.com.fashionai.application.ai.*;
import br.com.fashionai.application.common.*;
import br.com.fashionai.application.imaging.*;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.repository.*;
import br.com.fashionai.application.service.*;
import br.com.fashionai.application.service.SchemeService.*;

public final class SchemeAccess {
    private final SchemeRepository schemes;
    private final Guard guard;

    public SchemeAccess(SchemeRepository schemes, Guard guard) {
        this.schemes = schemes;
        this.guard = guard;
    }

    Scheme find(UUID id) {
        return schemes.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("entity.esquema")));
    }

    public Scheme owned(CurrentUser user, UUID id) {
        Scheme s = find(id);
        guard.requireOwner(user, s.getUser().getId(), "scheme:" + id);
        return s;
    }

    /** RF3.CA13 — a visibilidade do esquema prevalece sobre a do perfil quando for mais restritiva. */
    public void requireView(CurrentUser viewer, Scheme s) {
        Visibility effective = moreRestrictive(s.getVisibility(), s.getUser().getProfileVisibility());
        if (onlyForOwner(viewer, s)) {
            throw ApiException.notFound(Msg.t("entity.esquema"));
        }
        guard.requireView(viewer, s.getUser().getId(), effective, "scheme:" + s.getId());
    }

    public boolean canView(CurrentUser viewer, Scheme s) {
        if (onlyForOwner(viewer, s)) {
            return false;
        }
        return guard.canView(viewer, s.getUser().getId(), moreRestrictive(s.getVisibility(), s.getUser().getProfileVisibility()));
    }

    private static boolean onlyForOwner(CurrentUser viewer, Scheme s) {
        return s.getStatus() != SchemeStatus.PUBLISHED && (viewer == null || !viewer.id().equals(s.getUser().getId()));
    }

    public static Visibility moreRestrictive(Visibility a, Visibility b) {
        if (a == null) {
            return b;
        }
        if (b == null) {
            return a;
        }
        return a.ordinal() < b.ordinal() ? a : b;
    }
}
