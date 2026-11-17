package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.TipoLook;
import br.com.fashionai.domain.model.UserPreferences;
import br.com.fashionai.domain.repository.TipoLookRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/** Tipo padrão do catálogo aplicado somente às novas criações da pessoa autenticada. */
@Service
public class LookTypePreferencesService {
    private final UserPreferencesRepository preferences;
    private final TipoLookRepository types;
    private final UserRepository users;

    public LookTypePreferencesService(UserPreferencesRepository preferences, TipoLookRepository types,
                                      UserRepository users) {
        this.preferences = preferences;
        this.types = types;
        this.users = users;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> get(CurrentUser user) {
        return view(defaultType(user.id()));
    }

    @Transactional
    public Map<String, Object> update(CurrentUser user, UUID tipoLookId) {
        TipoLook type = tipoLookId == null ? null : types.findById(tipoLookId)
                .orElseThrow(() -> ApiException.badRequest("TIPO_LOOK_INVALIDO", Msg.t("mirror.tipo_look_invalido")));
        UserPreferences prefs = preferences.findByUserId(user.id()).orElseGet(() ->
                new UserPreferences(users.findById(user.id())
                        .orElseThrow(() -> ApiException.notFound(Msg.t("common.usuario")))));
        prefs.setDefaultTipoLook(type);
        preferences.save(prefs);
        return view(type);
    }

    @Transactional(readOnly = true)
    public TipoLook defaultType(UUID userId) {
        return preferences.findByUserId(userId).map(UserPreferences::getDefaultTipoLook).orElse(null);
    }

    private static Map<String, Object> view(TipoLook type) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("tipoLook", Views.tipoLook(type));
        return result;
    }
}
