package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.DnaService.LifeForm;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserRepository;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Identidade de Vida (Camada 2): validação dos campos, geração do DNA, edição, visibilidade por campo e
 * estação da coloração pessoal.
 */
final class DnaLifeIdentity {
    static final Map<String, Integer> LIFE_LIMITS = Map.of("places", 3, "people", 3, "animals", 2, "objects", 4);

    private final UserRepository users;
    private final StyleDnaRepository dnas;
    private final DnaSynthesis synthesis;
    private final DnaIdentityPhrase identityPhrase;

    DnaLifeIdentity(UserRepository users, StyleDnaRepository dnas, DnaSynthesis synthesis, DnaIdentityPhrase identityPhrase) {
        this.users = users;
        this.dnas = dnas;
        this.synthesis = synthesis;
        this.identityPhrase = identityPhrase;
    }

    Map<String, List<String>> validateLife(Map<String, List<String>> raw) {
        Map<String, List<String>> out = new LinkedHashMap<>();
        Map<String, Object> errors = new LinkedHashMap<>();
        if (raw != null) {
            raw.forEach((k, v) -> {
                if (!LIFE_LIMITS.containsKey(k)) {
                    errors.put(k, Msg.t("dna.categoria_desconhecida"));
                    return;
                }
                List<String> clean = (v == null ? List.<String>of() : v).stream().map(s -> InputSanitizer.clean(s == null ? "" : s, 30))
                        .filter(s -> !s.isBlank()).distinct().toList();
                if (clean.size() > LIFE_LIMITS.get(k)) {
                    errors.put(k, Msg.t("dna.maximo_de_itens", LIFE_LIMITS.get(k)));
                }
                out.put(k, clean.stream().limit(LIFE_LIMITS.get(k)).toList());
            });
        }
        if (!errors.isEmpty()) {
            throw ApiException.badRequest("FORMULARIO_INVALIDO", Msg.t("dna.revise_a_identidade_de_vida"), errors);
        }
        return out;
    }

    Map<String, Object> generate(CurrentUser user, LifeForm form) {
        User owner = users.findById(user.id()).orElseThrow();
        StyleDna d = dnas.findByUserId(user.id()).orElseGet(() -> new StyleDna(owner));
        boolean skip = form == null || Boolean.TRUE.equals(form.skip()) || form.fields() == null || form.fields().values().stream().allMatch(l -> l == null || l.isEmpty());
        if (!skip) {
            d.setLifeIdentityJson(Json.write(validateLife(form.fields())));
            d.setLifePrivateFieldsJson(Json.write(form.privateFields() == null ? List.of() : form.privateFields()));
        }
        dnas.save(d);
        synthesis.synthesize(user, d, true, "GERACAO");
        Map<String, Object> out = new LinkedHashMap<>(DnaViews.view(d, true));
        if (skip) {
            out.put("notice", Msg.t("dna.card_gerado_so_com_a"));
        }
        return out;
    }

    /** CA05 — editar a Identidade de Vida regenera só a Frase; a Camada 1 permanece intacta. */
    Map<String, Object> updateLife(CurrentUser user, LifeForm form) {
        StyleDna d = dnas.findByUserId(user.id()).filter(x -> x.getSynthesizedAt() != null).orElseThrow(() -> ApiException.notFound(Msg.t("common.dna_de_estilo")));
        d.setLifeIdentityJson(Json.write(validateLife(form.fields())));
        d.setLifePrivateFieldsJson(Json.write(form.privateFields() == null ? List.of() : form.privateFields()));
        identityPhrase.phrase(user, d);
        d.setCardImageUrl(null);
        dnas.save(d);
        synthesis.snapshot(d, "EDICAO_VIDA");
        return DnaViews.view(d, true);
    }

    /** CA06 / RN07 — visibilidade por campo da Camada 2 no card exportado. */
    Map<String, Object> setPrivateFields(CurrentUser user, List<String> privateFields) {
        StyleDna d = dnas.findByUserId(user.id()).orElseThrow(() -> ApiException.notFound(Msg.t("common.dna_de_estilo")));
        d.setLifePrivateFieldsJson(Json.write(privateFields == null ? List.of() : privateFields));
        d.setCardImageUrl(null);
        dnas.save(d);
        return DnaViews.view(d, true);
    }

    /** DET-M05 — estação da coloração pessoal (opcional). */
    Map<String, Object> setColorSeason(CurrentUser user, String season) {
        StyleDna d = dnas.findByUserId(user.id()).orElseThrow(() -> ApiException.notFound(Msg.t("common.dna_de_estilo")));
        String s = season == null ? null : season.toUpperCase(Locale.ROOT);
        if (s != null && !Set.of("SPRING", "SUMMER", "AUTUMN", "WINTER").contains(s)) {
            throw ApiException.badRequest("ESTACAO_INVALIDA", Msg.t("dna.use_spring_summer_autumn_ou"));
        }
        d.setColorSeason(s);
        dnas.save(d);
        return DnaViews.view(d, true);
    }
}
