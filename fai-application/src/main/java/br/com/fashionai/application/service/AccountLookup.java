package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.UserRepository;

import java.util.Locale;

/** A conta de quem pede (404 se não existe) e o idioma dos e-mails e arquivos dela, comuns aos casos de uso da conta. */
final class AccountLookup {
    private final UserRepository users;
    private final UserPreferencesRepository preferences;

    AccountLookup(UserRepository users, UserPreferencesRepository preferences) {
        this.users = users;
        this.preferences = preferences;
    }

    User load(CurrentUser user) {
        return users.findById(user.id()).orElseThrow(() -> ApiException.notFound(Msg.t("common.usuario")));
    }

    /** Idioma dos e-mails e arquivos do usuário: a preferência salva (RF23) e, sem ela, o idioma da requisição. */
    Locale mailLocale(User u) {
        return preferences.findByUserId(u.getId()).map(p -> p.getLanguage() == null ? Msg.locale() : Msg.fromPreference(p.getLanguage().name())).orElseGet(Msg::locale);
    }
}
