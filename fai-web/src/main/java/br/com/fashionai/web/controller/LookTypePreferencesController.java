package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.LookTypePreferencesService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/me/preferences/tipo-look")
public class LookTypePreferencesController {
    private final LookTypePreferencesService preferences;

    public LookTypePreferencesController(LookTypePreferencesService preferences) {
        this.preferences = preferences;
    }

    public record Update(UUID tipoLookId) { }

    @GetMapping
    public Map<String, Object> get(CurrentUser user) {
        return preferences.get(user);
    }

    @PutMapping
    public Map<String, Object> update(CurrentUser user, @RequestBody Update update) {
        return preferences.update(user, update.tipoLookId());
    }
}
