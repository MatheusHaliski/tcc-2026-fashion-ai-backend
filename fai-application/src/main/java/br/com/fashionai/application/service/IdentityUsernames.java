package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Hashing;
import br.com.fashionai.domain.repository.UserRepository;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static br.com.fashionai.application.service.IdentityFieldRules.normalizeUsername;
import static br.com.fashionai.application.service.IdentityFieldRules.reservedUsername;

/** Sugestões de @ livres (a partir do nome ou de um @ já em uso), conferidas no repositório de usuários. */
final class IdentityUsernames {
    private final UserRepository users;

    IdentityUsernames(UserRepository users) {
        this.users = users;
    }

    String suggestUsername(String name) {
        String base = normalizeUsername(Hashing.slug(name).replace("-", "_"));
        if (base.length() < 3) {
            base = "fashion_" + base;
        }
        String candidate = base;
        int i = 1;
        while (reservedUsername(candidate) || users.existsByUsernameIgnoreCase(candidate)) {
            candidate = base + (i++);
        }
        return candidate;
    }

    List<String> usernameSuggestions(String taken) {
        List<String> out = new ArrayList<>();
        String base = normalizeUsername(taken);
        for (String suffix : new String[]{"_style", ".fai", "_" + LocalDate.now().getYear() % 100, "_oficial", "_looks"}) {
            String c = (base + suffix).substring(0, Math.min(30, (base + suffix).length()));
            if (!users.existsByUsernameIgnoreCase(c)) {
                out.add(c);
            }
            if (out.size() == 3) {
                break;
            }
        }
        return out;
    }
}
